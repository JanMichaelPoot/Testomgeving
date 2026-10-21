// Pure checks for the tester questionnaire (fase 8, extended in R2.4), shared by the form and the server action.
export type WouldPay = "yes" | "maybe" | "no";

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
  doubt: string;
}

export const DOUBT_MAX = 1000;

export function testFeedbackEnabled(raw: string | undefined): boolean {
  return raw === "1";
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
  const doubt = typeof input.doubt === "string" ? input.doubt.trim().slice(0, DOUBT_MAX) : "";
  if (flowScore === null && profileScore === null && doorsScore === null && doorPick === null && wouldPay === null && doubt === "") return null;
  return { flowScore, profileScore, doorsScore, doorPick, doorKind, wouldPay, doubt };
}
