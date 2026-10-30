import type { IntakeAnswers } from "@/app/intake/actions";
import type { AssociationCard } from "@/lib/discovery/associationProfile";
import { activityImage, domainImage } from "@/lib/discovery/paths";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { WINDOW_MAX_PANES, type WindowItem } from "@/lib/windowLayout";

// What the window shows for a set of answers (the generative window, src/lib/windowLayout.ts). Pure, so the wizard
// (browser), the waiting screen and /plan (server), the PDF cover and the share images all draw exactly the same window
// from the same ordered choices.

type Answers = Partial<
  Pick<IntakeAnswers, "interestDomains" | "surpriseMe" | "associations" | "location" | "timeAvailable" | "budget" | "company" | "interests" | "intakeFlow">
>;

export interface PaneLibrary {
  cards: Pick<AssociationCard, "id" | "round" | "label" | "image" | "tagWeights" | "axes">[];
  domains: { id: string; label: string }[];
  /** Two-page intake: the activities of page 2, to draw the chosen ones. */
  activities?: { id: string; label: string; tags: readonly string[] }[];
}

/** 1 (familiar) .. 7 (far out) from the novelty axis (-1..1) of an image. */
export function levelFromNovelty(novelty: number): number {
  const v = Math.round(1 + ((Math.max(-1, Math.min(1, novelty)) + 1) / 2) * 6);
  return Math.max(1, Math.min(7, v));
}

/**
 * The window's items in the order the person chose them: the directions first, then the images in the order they were
 * tapped. Weight = how much of the profile's overall tag mass the image carries (the more it shares with the rest of the
 * choices, the more central it is), scaled so the strongest is 1; a direction counts 0.8 (an explicit choice).
 */
export function buildWindowItems(answers: Answers, lib: PaneLibrary, dict: Dictionary["venster"]): WindowItem[] {
  const card = new Map(lib.cards.map((c) => [c.id, c]));
  const domainLabel = new Map(lib.domains.map((d) => [d.id, d.label]));
  const chosen = (answers.associations ?? []).map((id) => card.get(id)).filter((c): c is PaneLibrary["cards"][number] => !!c);

  const profile = new Map<string, number>();
  for (const c of chosen) for (const [tag, w] of Object.entries(c.tagWeights)) profile.set(tag, (profile.get(tag) ?? 0) + w);
  const mass = (c: PaneLibrary["cards"][number]) => {
    const entries = Object.entries(c.tagWeights);
    const total = entries.reduce((n, [, w]) => n + w, 0);
    return total > 0 ? entries.reduce((n, [tag, w]) => n + w * (profile.get(tag) ?? 0), 0) / total : 0;
  };
  const max = Math.max(0, ...chosen.map(mass));

  // Two pages: the window holds the images of page 1 and the activities chosen on page 2 (there is no direction screen).
  const twoPages = answers.intakeFlow === "images2";
  const items: WindowItem[] = (twoPages ? [] : answers.interestDomains ?? []).map((id) => ({
    id: `w:${id}`,
    kind: "worlds",
    image: domainImage(id),
    label: domainLabel.get(id) ?? id,
    weight: 0.8,
    level: 3,
    tags: [id],
  }));
  if (!twoPages && answers.surpriseMe && items.length === 0) {
    items.push({ id: "w:surprise", kind: "worlds", label: dict.panes.surprise, placeholder: dict.panes.surprise, weight: 0.5, level: 4, tags: ["surprise"] });
  }
  for (const c of chosen) {
    items.push({
      id: c.id,
      kind: twoPages ? "images" : c.round,
      image: c.image,
      label: c.label,
      weight: max > 0 ? Math.round((mass(c) / max) * 100) / 100 : 0.5,
      level: levelFromNovelty(c.axes.novelty),
      tags: Object.keys(c.tagWeights),
    });
  }
  if (twoPages) {
    const activity = new Map((lib.activities ?? []).map((a) => [a.id, a]));
    for (const id of answers.interests ?? []) {
      const a = activity.get(id);
      if (!a) continue;
      items.push({ id: `a:${id}`, kind: "picks", image: activityImage(id), label: a.label, weight: 0.8, level: 3, tags: [...a.tags] });
    }
  }
  return items;
}

/** The address of the downloadable picture of this window (ids only, no text). Null when there is nothing to draw. */
export function windowImageHref(answers: Answers): string | null {
  // Two pages: no direction panes, and the chosen activities follow the images as a:<id>.
  const twoPages = answers.intakeFlow === "images2";
  const ids = [
    ...(twoPages ? [] : answers.interestDomains ?? []).map((d) => `w:${d}`),
    ...(answers.associations ?? []),
    ...(twoPages ? answers.interests ?? [] : []).map((id) => `a:${id}`),
  ].slice(0, WINDOW_MAX_PANES * 2);
  const surprise = answers.surpriseMe && !twoPages && (answers.interestDomains ?? []).length === 0;
  if (ids.length === 0 && !surprise) return null;
  const query = new URLSearchParams();
  if (ids.length) query.set("c", ids.join(","));
  if (surprise) query.set("s", "1");
  return `/api/window-image?${query.toString()}`;
}

/** The window sill: the text answers in one short line ("Laren · Een halve dag · Tot €25 · met een partner"). */
export function buildSill(answers: Answers, intake: Dictionary["intake"], venster: Dictionary["venster"]): string {
  const label = (options: { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label;
  const place = (answers.location ?? "").split(",")[0].trim();
  // "Alleen ik" stands on its own; everyone else reads as "met ...".
  const alone = (answers.company ?? []).includes("alone");
  const company = (answers.company ?? [])
    .filter((v) => v !== "alone")
    .map((v) => label(intake.company.options, v))
    .filter((x): x is string => !!x)
    .map((x) => x.toLowerCase());
  const parts = [
    place,
    answers.timeAvailable ? label(intake.timeAvailable.options, answers.timeAvailable) : undefined,
    answers.budget ? label(intake.budget.options, answers.budget) : undefined,
    company.length ? `${venster.sill.with} ${company.join(" & ")}` : alone ? label(intake.company.options, "alone") : undefined,
  ].filter((x): x is string => !!x);
  return parts.join(" · ");
}
