import type { IntakeAnswers } from "@/app/intake/actions";
import type { WindowPane, WindowPaneKey } from "@/components/window/WindowFrame";
import type { AssociationCard } from "@/lib/discovery/associationProfile";
import { domainImage } from "@/lib/discovery/paths";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// What the window shows for a set of answers ("Het venster", fase 4). Pure, so the wizard
// (browser) and checkout, the waiting screen and /plan (server) draw exactly the same window.

type Answers = Partial<
  Pick<IntakeAnswers, "interestDomains" | "surpriseMe" | "associations" | "location" | "timeAvailable" | "budget" | "company">
>;

export interface PaneLibrary {
  cards: Pick<AssociationCard, "id" | "round" | "label" | "image">[];
  domains: { id: string; label: string }[];
}

export function buildVensterPanes(
  answers: Answers,
  lib: PaneLibrary,
  dict: Dictionary["venster"],
  opts: { active?: WindowPaneKey; hrefs?: Partial<Record<WindowPaneKey, string>> } = {},
): WindowPane[] {
  const chosen = answers.associations ?? [];
  const card = new Map(lib.cards.map((c) => [c.id, c]));
  const domainLabel = new Map(lib.domains.map((d) => [d.id, d.label]));
  const imagesOf = (round: AssociationCard["round"]) =>
    chosen
      .map((id) => card.get(id))
      .filter((c): c is PaneLibrary["cards"][number] => !!c && c.round === round)
      .map((c) => ({ src: c.image, alt: c.label }));

  const worlds = (answers.interestDomains ?? []).map((id) => ({ src: domainImage(id), alt: domainLabel.get(id) ?? id }));
  const panes: WindowPane[] = [
    {
      key: "worlds",
      label: dict.panes.worlds,
      images: worlds,
      ...(answers.surpriseMe && worlds.length === 0 ? { placeholder: dict.panes.surprise } : {}),
    },
    { key: "places", label: dict.panes.places, images: imagesOf("places") },
    { key: "moments", label: dict.panes.moments, images: imagesOf("moments") },
    { key: "senses", label: dict.panes.senses, images: imagesOf("senses") },
  ];
  return panes.map((p) => ({
    ...p,
    ...(opts.active === p.key ? { active: true } : {}),
    ...(opts.hrefs?.[p.key] ? { href: opts.hrefs[p.key] } : {}),
  }));
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
