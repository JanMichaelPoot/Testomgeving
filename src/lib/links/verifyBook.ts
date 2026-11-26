// The last check before a book is saved (fix round "plan links"). Everything a reader could open or rely on is looked at once more, free of any
// model call:
//  - every place link answers 2xx and suits the reader (language, country, audience); a place that does not is left out;
//  - every web address written in the text must be one of those places, or pass the same check itself;
//  - a step that points at a refused address or a refused provider becomes a search instruction in the reader's language, never a dead or foreign link;
//  - an exact price that is not on a checked page becomes a range marked as an estimate (prices.ts).
// Replacements by the model happen earlier, in the research: a refused address is passed to the broader and the online search round, which look
// for another place. This is the safety net after them, and for the classic pipeline.
//
// Server-only (it fetches pages).

import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { checkPage, type Fetcher } from "@/lib/claude/verifyUrls";
import type { RejectedLink } from "@/lib/claude/localResearch";
import { LAYER_LIMITS, type IdeaPlace } from "@/lib/claude/ideaLayers";
import { findWebAddresses, hostKey, normalizeUrl } from "@/lib/links/normalizeUrl";
import type { FitPolicy } from "@/lib/links/pageFit";
import { guardPrices } from "@/lib/links/prices";
import { getActivity } from "@/lib/discovery/library";
import { isOnlineCity } from "@/lib/maps";

export interface BookCheckContext {
  language: "nl" | "en";
  /** The reader's country (ISO code, upper case). */
  country: string;
  adultsOnly: boolean;
  /** The place the reader searched around ("Utrecht"); empty when unknown. */
  place: string;
  /** For tests. */
  fetcher?: Fetcher;
  timeoutMs?: number;
}

export interface BookCheckReport {
  /** How many addresses were opened. */
  checked: number;
  rejected: RejectedLink[];
  /** Fields that were rewritten because they pointed at something refused ("idea1.first_action"). */
  rewritten: string[];
  /** Exact prices that were turned into a labelled estimate. */
  prices: string[];
}

/** A safe next step that needs no link: search it yourself, near your own place. */
export function searchInstruction(activity: string, place: string, language: "nl" | "en", online: boolean): string {
  if (online) return language === "nl" ? `Zoek online op "${activity} voor beginners" en kies zelf een aanbieder die in jouw land levert.` : `Search online for "${activity} for beginners" and pick a provider yourself that serves your country.`;
  const where = place ? (language === "nl" ? `${activity} ${place}` : `${activity} ${place}`) : activity;
  return language === "nl" ? `Zoek op Google Maps op "${where}" en kies zelf een plek in de buurt.` : `Search Google Maps for "${where}" and pick a place nearby yourself.`;
}

const followUp = (language: "nl" | "en") =>
  language === "nl" ? "Neem contact op met de plek die je aanspreekt en vraag wanneer je als beginner kunt komen." : "Contact the one you like and ask when you can come as a beginner.";

const theProvider = (language: "nl" | "en") => (language === "nl" ? "een aanbieder" : "a provider");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The name of a place as a whole phrase in a text. Very short names would match ordinary words and are not looked for. */
const mentions = (text: string, name: string) => name.trim().length >= 5 && new RegExp(`(?<![\\p{L}\\p{N}])${escape(name.trim())}(?![\\p{L}\\p{N}])`, "iu").test(text);

export async function verifyBook(book: GeneratedIdeaBook, ctx: BookCheckContext): Promise<{ book: GeneratedIdeaBook; report: BookCheckReport }> {
  const report: BookCheckReport = { checked: 0, rejected: [], rewritten: [], prices: [] };
  const seen = new Map<string, ReturnType<typeof checkPage>>();
  const open = (url: string, name: string | null, localVenue: boolean) => {
    const key = `${url}|${name ?? ""}|${localVenue}`;
    let found = seen.get(key);
    if (!found) {
      report.checked++;
      const policy: FitPolicy = { country: ctx.country, language: ctx.language, localVenue, adultsOnly: ctx.adultsOnly };
      found = checkPage(url, name, { fetcher: ctx.fetcher, timeoutMs: ctx.timeoutMs ?? 5000, policy });
      seen.set(key, found);
    }
    return found;
  };

  const entries = [...book.ideas, book.wildcard];
  const labelOf = (index: number) => (index < book.ideas.length ? `idea${index + 1}` : "wildcard");

  // 1. The places of every idea.
  const placeResults = await Promise.all(
    entries.map(async (entry, index) => {
      const kept: IdeaPlace[] = [];
      const gone: IdeaPlace[] = [];
      const pages: string[] = [];
      await Promise.all(
        (entry.places ?? []).map(async (place, position) => {
          if (!place.url) {
            kept[position] = place;
            return;
          }
          const result = await open(place.url, place.name, !isOnlineCity(place.city));
          if (result.ok) {
            kept[position] = { ...place, url: result.page.url };
            pages.push(result.page.html);
          } else {
            gone.push(place);
            report.rejected.push({ activityId: entry.activity_id ?? labelOf(index), url: place.url, reason: result.reason });
          }
        }),
      );
      return { kept: kept.filter(Boolean), gone, pages };
    }),
  );
  const keptHosts = new Set(placeResults.flatMap((r) => r.kept.flatMap((p) => (p.url ? [hostKey(p.url)] : []))));

  const checkedEntries = await Promise.all(
    entries.map(async (entry, index): Promise<IdeaBookEntry> => {
      const { kept, gone, pages } = placeResults[index];
      const label = labelOf(index);
      const activity = entry.activity_id ? getActivity(entry.activity_id)?.label[ctx.language] : undefined;
      const activityName = (activity ?? entry.title).toLowerCase();
      const online = kept.length === 0 && (entry.places ?? []).length > 0 && (entry.places ?? []).every((p) => isOnlineCity(p.city));
      const instruction = searchInstruction(activityName, ctx.place, ctx.language, online);
      // A refused provider that is also a kept one (another branch) is not refused.
      const goneNames = gone.map((p) => p.name).filter((name) => !kept.some((k) => k.name === name));

      // 2. Addresses written in the text.
      const texts = [...entry.details, entry.first_action, entry.intro, entry.why_it_fits, entry.next_step ?? "", entry.feels_like ?? "", ...entry.requirements, ...(entry.sizes ?? []).map((s) => s.description), ...kept.map((p) => p.note)];
      const badAddresses = new Set<string>();
      await Promise.all(
        texts.flatMap((t) => findWebAddresses(t)).map(async (found) => {
          if (keptHosts.has(hostKey(found.url))) return;
          const result = await open(found.url, null, !online);
          if (result.ok) pages.push(result.page.html);
          else if (!badAddresses.has(found.text)) {
            badAddresses.add(found.text);
            report.rejected.push({ activityId: entry.activity_id ?? label, url: normalizeUrl(found.url) ?? found.url, reason: result.reason });
          }
        }),
      );

      const pointsAtRefused = (text: string) => findWebAddresses(text).some((f) => badAddresses.has(f.text)) || goneNames.some((name) => mentions(text, name));

      // A sentence that only mentions a refused address or provider keeps its meaning with a neutral phrase.
      const neutral = (text: string, field: string) => {
        let out = text;
        for (const found of findWebAddresses(text).reverse()) {
          if (badAddresses.has(found.text)) out = out.slice(0, found.index) + theProvider(ctx.language) + out.slice(found.index + found.text.length);
        }
        for (const name of goneNames) if (mentions(out, name)) out = out.replace(new RegExp(escape(name), "gi"), theProvider(ctx.language));
        if (out !== text) report.rewritten.push(`${label}.${field}`);
        return out;
      };

      // 3. Prices: only what stands on a checked page stays exact.
      const money = (text: string, maxLength?: number) => {
        const guarded = guardPrices(text, pages, ctx.language, maxLength);
        report.prices.push(...guarded.changed.map((c) => `${label}: ${c}`));
        return guarded.text;
      };

      let replacedSteps = 0;
      const details = entry.details.map((step, i) => {
        if (!pointsAtRefused(step)) return money(step);
        report.rewritten.push(`${label}.details.${i + 1}`);
        return replacedSteps++ === 0 ? instruction : followUp(ctx.language);
      });
      let firstAction = entry.first_action;
      if (pointsAtRefused(firstAction)) {
        report.rewritten.push(`${label}.first_action`);
        firstAction = instruction;
      } else firstAction = money(firstAction);

      const droppedLocation = !!entry.location && goneNames.some((name) => mentions(name, entry.location!.name) || mentions(entry.location!.name, name));
      const places = kept.map((p) => ({ ...p, note: money(neutral(p.note, "places.note")) }));

      return {
        ...entry,
        title: neutral(entry.title, "title"),
        intro: money(neutral(entry.intro, "intro")),
        why_it_fits: money(neutral(entry.why_it_fits, "why_it_fits")),
        details,
        first_action: firstAction,
        requirements: entry.requirements.map((r) => money(neutral(r, "requirements"))),
        practical: { ...entry.practical, estimated_cost: money(entry.practical.estimated_cost) },
        location: droppedLocation ? null : entry.location,
        ...(entry.places ? { places: places.length ? places : undefined } : {}),
        ...(entry.next_step !== undefined ? { next_step: money(neutral(entry.next_step, "next_step"), LAYER_LIMITS.next_step) } : {}),
        ...(entry.feels_like !== undefined ? { feels_like: neutral(entry.feels_like, "feels_like") } : {}),
        ...(entry.sizes
          ? {
              sizes: entry.sizes.map((s) => ({
                ...s,
                description: money(neutral(s.description, "sizes.description"), LAYER_LIMITS.size_description),
                estimated_cost: money(s.estimated_cost, LAYER_LIMITS.size_cost),
              })),
            }
          : {}),
      };
    }),
  );

  return { book: { ...book, ideas: checkedEntries.slice(0, book.ideas.length), wildcard: checkedEntries[book.ideas.length] }, report };
}
