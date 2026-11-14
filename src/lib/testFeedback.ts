// Pure checks for the tester questionnaire (fase 8, extended in R2.4), shared by the form and the server action.
export type WouldPay = "yes" | "maybe" | "no";

/** Did the e-mail with the book arrive: in the inbox, in the spam folder, or not at all. */
export const MAIL_STATUSES = ["inbox", "spam", "missing"] as const;
export type MailStatus = (typeof MAIL_STATUSES)[number];

export const DOOR_KINDS = ["natural", "discovery", "unexpected", "stretch", "wildcard"] as const;
export type DoorKind = (typeof DOOR_KINDS)[number];

/** Six ideas and the wildcard. */
export const MAX_DOOR_PICK = 7;

export interface TestFeedbackInput {
  flowScore: number | null;
  /** "Did you feel understood by 'Zo kijken wij door jouw venster'?" 1-5. */
  profileScore: number | null;
  /** "Did you get why you received these doors?" 1-5. */
  doorsScore: number | null;
  /** Position of the idea they would really do (1-7), 0 = none of them, null = not answered. Never the title. */
  doorPick: number | null;
  /** The kind of that door; only present together with a pick of 1-7. */
  doorKind: DoorKind | null;
  wouldPay: WouldPay | null;
  /** "Did the places and providers in your book fit your surroundings?" 1-5. */
  placesScore: number | null;
  mailStatus: MailStatus | null;
  doubt: string;
}

export const DOUBT_MAX = 1000;

/**
 * On for "1", and for the other ways people write a switch in a dashboard ("true", "yes", "on", with stray
 * spaces or quotes). Anything else, including "0", "false" and empty, is off.
 */
export function testFeedbackEnabled(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/** The page with the questionnaire of one book, for the e-mail; null when the questionnaire is switched off (NEXT_PUBLIC_TEST_FEEDBACK). */
export function feedbackLink(siteUrl: string, planId: string, env: string | undefined = process.env.NEXT_PUBLIC_TEST_FEEDBACK): string | null {
  return testFeedbackEnabled(env) ? `${siteUrl}/feedback/${planId}?utm_source=window_mail&utm_medium=email` : null;
}

/** The ideas a tester can pick in the questionnaire: numbered the way the reveal shows them (door order, the wildcard last). Only the number and the kind of door go to the analytics, never the title. */
export function feedbackDoorsFor<T extends { door?: string; title: string }>(ordered: readonly T[], wildcard: { title: string } | null | undefined): { number: number; kind: DoorKind; title: string }[] {
  const kind = (d: string | undefined): DoorKind => ((DOOR_KINDS as readonly string[]).includes(d ?? "") ? (d as DoorKind) : "natural");
  return [
    ...ordered.map((idea, i) => ({ number: i + 1, kind: kind(idea.door), title: idea.title })),
    ...(wildcard ? [{ number: ordered.length + 1, kind: "wildcard" as const, title: wildcard.title }] : []),
  ];
}

const score = (v: unknown): number | null => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : null);

/** Cleaned input, or null when there is nothing worth storing. */
export function cleanTestFeedback(input: Partial<TestFeedbackInput>): TestFeedbackInput | null {
  const flowScore = score(input.flowScore);
  const profileScore = score(input.profileScore);
  const doorsScore = score(input.doorsScore);
  const doorPick = Number.isInteger(input.doorPick) && input.doorPick! >= 0 && input.doorPick! <= MAX_DOOR_PICK ? input.doorPick! : null;
  const doorKind = doorPick !== null && doorPick >= 1 && (DOOR_KINDS as readonly string[]).includes(input.doorKind as string) ? (input.doorKind as DoorKind) : null;
  const wouldPay = input.wouldPay === "yes" || input.wouldPay === "maybe" || input.wouldPay === "no" ? input.wouldPay : null;
  const placesScore = score(input.placesScore);
  const mailStatus = (MAIL_STATUSES as readonly string[]).includes(input.mailStatus as string) ? (input.mailStatus as MailStatus) : null;
  const doubt = typeof input.doubt === "string" ? input.doubt.trim().slice(0, DOUBT_MAX) : "";
  if (flowScore === null && profileScore === null && doorsScore === null && doorPick === null && wouldPay === null && placesScore === null && mailStatus === null && doubt === "") return null;
  return { flowScore, profileScore, doorsScore, doorPick, doorKind, wouldPay, placesScore, mailStatus, doubt };
}
