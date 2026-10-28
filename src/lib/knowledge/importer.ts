import { createHash } from "node:crypto";
import type { Activity } from "@/lib/discovery/types";
import { buildIndex, matchRecord, newAliasesFor } from "@/lib/knowledge/match";
import { normalizeRecord } from "@/lib/knowledge/normalize";
import { autoReject, queueScore } from "@/lib/knowledge/screen";
import type { ImportResult, Merge, ProposalFile, QueueEntry, RawRecord, RejectedEntry } from "@/lib/knowledge/types";
import { normalizeName } from "@/lib/discovery/names";

// The whole import as one pure function: records + library + earlier decisions in, merges + review queue +
// rejections out. No file or network access here, so it is deterministic and the same call twice gives the same
// answer (B3 rule 3). Nothing it returns is an activity: merges only add names and a link to existing ones.

export const DEFAULT_QUEUE_CAP = 80;

export interface ImportInput {
  records: RawRecord[];
  library: Activity[];
  proposals?: ProposalFile | null;
  /** The review queue as it was last written; decisions in it survive a new run. */
  previousQueue?: QueueEntry[];
  queueCap?: number;
}

export function runImport(input: ImportInput): ImportResult {
  const source_id = input.records[0]?.source_id ?? input.proposals?.source_id ?? "";
  const cap = input.queueCap ?? DEFAULT_QUEUE_CAP;
  const index = buildIndex(input.library);
  const previous = new Map((input.previousQueue ?? []).map((e) => [e.source_record_id, e]));

  const merges: Merge[] = [];
  const candidates: QueueEntry[] = [];
  const rejected: RejectedEntry[] = [];
  const reject = (r: RawRecord, reason: RejectedEntry["reason"], note?: string) =>
    rejected.push({ source_id: r.source_id, source_record_id: r.source_record_id, labels: r.labels, reason, ...(note ? { note } : {}) });

  for (const raw of input.records) {
    const rec = normalizeRecord(raw);
    const decided = previous.get(raw.source_record_id)?.decision ?? null;
    const m = matchRecord(rec, index);

    if (m.kind === "linked") {
      merges.push({ source_record_id: raw.source_record_id, activityId: m.activityId, tier: m.tier, ...(m.lang ? { lang: m.lang } : {}), addAliases: { nl: [], en: [] }, alreadyLinked: true });
      continue;
    }
    if (m.kind === "merge") {
      merges.push({
        source_record_id: raw.source_record_id,
        activityId: m.activityId,
        tier: m.tier,
        lang: m.lang,
        addAliases: newAliasesFor(rec, index),
        alreadyLinked: false,
      });
      continue;
    }
    // A reviewer said "this is activity X": a merge like any other, with the names the record adds.
    if (decided && decided.startsWith("merge:") && index.byId.has(decided.slice(6))) {
      const activityId = decided.slice(6);
      merges.push({ source_record_id: raw.source_record_id, activityId, tier: "reviewed", addAliases: newAliasesFor(rec, index), alreadyLinked: false });
      continue;
    }
    if (decided === "reject") {
      reject(raw, "reviewer_reject");
      continue;
    }

    const key = normalizeName(raw.labels.en ?? raw.labels.nl);
    const auto = autoReject(rec);
    if (auto) {
      reject(raw, auto);
      continue;
    }
    const proposedReject = input.proposals?.reject[key];
    if (proposedReject) {
      reject(raw, "proposal_reject", proposedReject);
      continue;
    }
    const accept = input.proposals?.accept[key];
    const unsure = input.proposals?.unsure[key];
    // A proposed merge only counts when the activity it names exists.
    const mergeProposal = input.proposals?.merge?.[key];
    const mergeInto = mergeProposal && index.byId.has(mergeProposal.into) ? mergeProposal : undefined;
    const verdict = accept ? "accept" : mergeInto ? "merge" : unsure ? "unsure" : undefined;
    const proposal = accept
      ? { verdict: "accept" as const, domain: accept.domain, ...(accept.note ? { note: accept.note } : {}) }
      : mergeInto
        ? { verdict: "merge" as const, into: mergeInto.into, domain: index.byId.get(mergeInto.into)!.domain, ...(mergeInto.note ? { note: mergeInto.note } : {}) }
        : unsure
          ? { verdict: "unsure" as const, ...(unsure.domain ? { domain: unsure.domain } : {}), ...(unsure.note ? { note: unsure.note } : {}) }
          : undefined;
    candidates.push({
      source_id: raw.source_id,
      source_record_id: raw.source_record_id,
      labels: raw.labels,
      descriptions: raw.descriptions,
      reason: m.kind === "ambiguous" ? "ambiguous_name" : m.kind === "similar" ? "similar_existing" : "new_candidate",
      candidates: m.kind === "ambiguous" || m.kind === "similar" ? m.candidates : [],
      ...(proposal ? { proposal } : {}),
      score: queueScore(rec, verdict),
      needs_nl_label: !raw.labels.nl,
      ...(!raw.labels.nl && input.proposals?.nl_labels?.[key] ? { nl_suggestion: input.proposals.nl_labels[key] } : {}),
      decision: decided,
    });
  }

  // The cap keeps the best-scoring entries. A decision already taken is never dropped by the cap.
  // A proposal's kind decides the order (accept, unsure, merge, no opinion); the score only orders within a kind. So a long
  // English label can never push a proposed new activity under the cap.
  const TIER = { accept: 0, unsure: 1, merge: 2 } as const;
  const tier = (e: QueueEntry) => (e.proposal ? TIER[e.proposal.verdict] : 3);
  candidates.sort((a, b) => tier(a) - tier(b) || b.score - a.score || Number(a.source_record_id.slice(1)) - Number(b.source_record_id.slice(1)));
  const queue: QueueEntry[] = [];
  for (const e of candidates) {
    if (queue.length < cap || e.decision !== null) queue.push(e);
    else reject({ source_id: e.source_id, source_record_id: e.source_record_id, labels: e.labels, descriptions: e.descriptions }, "below_queue_cap");
  }

  const byRecord = (a: { source_record_id: string }, b: { source_record_id: string }) =>
    Number(a.source_record_id.slice(1)) - Number(b.source_record_id.slice(1));
  return { source_id, records: input.records.length, merges: merges.sort(byRecord), queue, rejected: rejected.sort(byRecord) };
}

/**
 * Writes the merges into activities: the source link plus any new names. Idempotent: a record that is already linked
 * adds nothing, and an alias is added once. Returns new objects; the input is not touched.
 */
export function applyMerges(activities: Activity[], merges: Merge[], source_id: string): Activity[] {
  const byActivity = new Map<string, Merge[]>();
  for (const m of merges) {
    if (m.alreadyLinked) continue;
    byActivity.set(m.activityId, [...(byActivity.get(m.activityId) ?? []), m]);
  }
  return activities.map((a) => {
    const list = byActivity.get(a.id);
    if (!list) return a;
    const next: Activity = { ...a };
    const links = [...(a.source_links ?? [])];
    const aliases = { nl: [...(a.aliases?.nl ?? [])], en: [...(a.aliases?.en ?? [])] };
    for (const m of list) {
      if (!links.some((l) => l.source_id === source_id && l.source_record_id === m.source_record_id)) {
        links.push({ source_id, source_record_id: m.source_record_id });
      }
      for (const lang of ["nl", "en"] as const) {
        for (const alias of m.addAliases[lang]) {
          if (!aliases[lang].some((x) => normalizeName(x) === normalizeName(alias))) aliases[lang].push(alias);
        }
      }
    }
    next.source_links = links;
    if (aliases.nl.length || aliases.en.length) next.aliases = aliases;
    return next;
  });
}

/** A short hash of what an import produced, so the log only gets a line when something actually changed. */
export function fingerprint(result: ImportResult): string {
  // alreadyLinked and addAliases differ between a first and a second run of the same import; the outcome does not.
  const merges = result.merges.map(({ source_record_id, activityId, tier, lang }) => ({ source_record_id, activityId, tier, lang }));
  return createHash("sha256").update(JSON.stringify({ ...result, merges })).digest("hex").slice(0, 16);
}

// --- report ------------------------------------------------------------------------------------------

export interface ReportInput {
  result: ImportResult;
  library: Activity[];
  domainLabels: Record<string, string>;
  sourceName: string;
}

const REASON_NL: Record<string, string> = {
  no_label: "geen label",
  unsafe_or_restricted: "onveilig of niet toegestaan",
  technical_term: "vakterm, geen activiteit",
  too_generic: "te algemeen",
  label_too_long: "label te lang",
  proposal_reject: "voorgesteld om af te wijzen (zie opmerking)",
  reviewer_reject: "afgewezen door de beoordelaar",
  below_queue_cap: "onder de grens van de reviewwachtrij",
};

export function buildReport({ result, library, domainLabels, sourceName }: ReportInput): string {
  const byId = new Map(library.map((a) => [a.id, a]));
  const domainOf = (id: string) => byId.get(id)?.domain ?? "?";
  const rows = new Map<string, { merged: number; review: number }>();
  const row = (d: string) => rows.get(d) ?? { merged: 0, review: 0 };
  for (const m of result.merges) rows.set(domainOf(m.activityId), { ...row(domainOf(m.activityId)), merged: row(domainOf(m.activityId)).merged + 1 });
  for (const q of result.queue) {
    const d = q.proposal?.domain ?? (q.candidates[0] ? domainOf(q.candidates[0]) : "(geen domein)");
    rows.set(d, { ...row(d), review: row(d).review + 1 });
  }
  const label = (d: string) => domainLabels[d] ?? d;
  const lines: string[] = [];
  lines.push(`# Import ${result.source_id}: ${sourceName}`, "");
  lines.push(`Records in de bron: **${result.records}** · samengevoegd met een bestaande activiteit: **${result.merges.length}** · in review: **${result.queue.length}** · afgewezen: **${result.rejected.length}** · rechtstreeks toegevoegd als activiteit: **0** (niets gaat live zonder review).`, "");
  lines.push("## Per domein", "", "| Domein | Samengevoegd | In review |", "|---|---|---|");
  for (const d of [...rows.keys()].sort()) lines.push(`| ${label(d)} | ${rows.get(d)!.merged} | ${rows.get(d)!.review} |`);
  // Built from the library AFTER the merges were written, so a first and a second run print the same report.
  lines.push("", "## Samengevoegd", "", "| Record | Activiteit | Hoe | Bijnamen van de activiteit |", "|---|---|---|---|");
  for (const m of result.merges) {
    const a = byId.get(m.activityId);
    const names = [...(a?.aliases?.nl ?? []).map((n) => `nl: ${n}`), ...(a?.aliases?.en ?? []).map((n) => `en: ${n}`)].join(", ") || "-";
    lines.push(`| ${m.source_record_id} | ${m.activityId} | ${m.tier}${m.lang ? ` (${m.lang})` : ""} | ${names} |`);
  }
  const byReason = new Map<string, number>();
  for (const r of result.rejected) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
  lines.push("", "## Afgewezen, per reden", "", "| Reden | Aantal |", "|---|---|");
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${REASON_NL[reason] ?? reason} | ${n} |`);
  lines.push("", "## Reviewwachtrij", "", "| Record | EN | NL | Reden | Lijkt op | Voorstel | Score |", "|---|---|---|---|---|---|---|");
  for (const q of result.queue) {
    lines.push(
      `| ${q.source_record_id} | ${q.labels.en ?? "-"} | ${q.labels.nl ?? (q.nl_suggestion ? `${q.nl_suggestion} (vertaald voorstel)` : "(ontbreekt)")} | ${q.reason} | ${q.candidates.join(", ") || "-"} | ${q.proposal ? `${q.proposal.verdict}${q.proposal.into ? ` -> ${q.proposal.into}` : q.proposal.domain ? ` (${q.proposal.domain})` : ""}` : "-"} | ${q.score} |`,
    );
  }
  lines.push("", "## Afgewezen, per record", "", "| Record | EN | NL | Reden | Opmerking |", "|---|---|---|---|---|");
  for (const r of result.rejected) lines.push(`| ${r.source_record_id} | ${r.labels.en ?? "-"} | ${r.labels.nl ?? "-"} | ${REASON_NL[r.reason] ?? r.reason} | ${r.note ?? ""} |`);
  lines.push("");
  return lines.join("\n");
}
