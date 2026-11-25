import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCheckins, type CheckinCandidate, type CheckinStore } from "@/lib/checkin/run";
import { emailHash } from "@/lib/checkin/optout";
import { makeFollowUpToken, readFollowUpToken } from "@/lib/followup/token";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-24T09:30:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

function candidate(over: Partial<CheckinCandidate> = {}): CheckinCandidate {
  return { id: "11111111-2222-3333-4444-555555555555", sessionId: "sess-1", language: "nl", email: "buyer@example.com", createdAt: ago(10), reminderSentAt: ago(6), chosenIdeaTitle: null, ...over };
}

function fakeStore(list: CheckinCandidate[], over: Partial<CheckinStore> = {}): CheckinStore & { claimed: string[]; released: string[] } {
  const claimed: string[] = [];
  const released: string[] = [];
  return {
    claimed,
    released,
    listCandidates: async () => list,
    hasRealOrder: async () => true,
    isOptedOut: async () => false,
    claim: async (id) => {
      if (claimed.includes(id)) return false;
      claimed.push(id);
      return true;
    },
    release: async (id) => {
      released.push(id);
    },
    ...over,
  };
}

const send = vi.fn();
const deps = () => ({ send, siteUrl: "https://windowinto.nl", now: NOW, token: (purpose: string, id: string) => `${purpose}-${id}` });

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe("runCheckins (Step 243)", () => {
  it("sends one mail with three signed answer links and an opt-out link", async () => {
    const store = fakeStore([candidate()]);
    const res = await runCheckins(store, deps());
    expect(res).toEqual({ considered: 1, sent: 1, failed: 0, skipped: 0 });
    const call = send.mock.calls[0][0];
    expect(call.to).toBe("buyer@example.com");
    expect(call.answerUrls.done).toBe("https://windowinto.nl/terugkoppeling?t=checkin-11111111-2222-3333-4444-555555555555&a=done");
    expect(call.answerUrls.planned).toContain("&a=planned");
    expect(call.answerUrls.not).toContain("&a=not");
    expect(call.optoutUrl).toBe("https://windowinto.nl/afmelden?c=checkin-out-11111111-2222-3333-4444-555555555555");
  });

  it("passes on the idea the buyer chose, and none otherwise", async () => {
    await runCheckins(fakeStore([candidate({ chosenIdeaTitle: "Mahjong leren spelen" })]), deps());
    expect(send.mock.calls[0][0].ideaTitle).toBe("Mahjong leren spelen");
    send.mockClear();
    await runCheckins(fakeStore([candidate()]), deps());
    expect(send.mock.calls[0][0].ideaTitle).toBeNull();
  });

  it("leaves a book alone that is not due yet (the reminder went out two days ago)", async () => {
    const res = await runCheckins(fakeStore([candidate({ reminderSentAt: ago(2) })]), deps());
    expect(res).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing to a buyer who opted out, or when that cannot be read", async () => {
    await runCheckins(fakeStore([candidate()], { isOptedOut: async () => true }), deps());
    await runCheckins(fakeStore([candidate()], { isOptedOut: async () => null }), deps());
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing for a book without a real paid order (a free test order)", async () => {
    const res = await runCheckins(fakeStore([candidate()], { hasRealOrder: async () => false }), deps());
    expect(res.skipped).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("claims the right to send first, so a second run does not send again", async () => {
    const store = fakeStore([candidate()]);
    await runCheckins(store, deps());
    const second = await runCheckins(store, deps());
    expect(send).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ sent: 0, skipped: 1 });
  });

  it("gives the claim back when sending fails, so the next run tries again", async () => {
    send.mockRejectedValue(new Error("mail down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = fakeStore([candidate()]);
    const res = await runCheckins(store, deps());
    expect(res).toMatchObject({ sent: 0, failed: 1 });
    expect(store.released).toEqual([candidate().id]);
    spy.mockRestore();
  });

  it("reports each mail it sent, once", async () => {
    const onSent = vi.fn();
    await runCheckins(fakeStore([candidate(), candidate({ id: "99999999-2222-3333-4444-555555555555", email: "b@example.com" })]), { ...deps(), onSent });
    expect(onSent).toHaveBeenCalledTimes(2);
  });

  it("lets an error of the store through (a missing migration), for the caller to report", async () => {
    const store = fakeStore([], {
      listCandidates: async () => {
        throw new Error("check-in candidates could not be read (has migration 0032 been run?)");
      },
    });
    await expect(runCheckins(store, deps())).rejects.toThrow("0032");
  });
});

describe("the tokens and the opt-out hash", () => {
  const key = "test-key";
  const plan = "11111111-2222-3333-4444-555555555555";

  it("a check-in token opens only the check-in page, and the opt-out token only the opt-out", () => {
    const answer = makeFollowUpToken("checkin", plan, key);
    expect(readFollowUpToken("checkin", answer, key)).toBe(plan);
    expect(readFollowUpToken("checkin-out", answer, key)).toBeNull();
    expect(readFollowUpToken("unsub", answer, key)).toBeNull();
    expect(readFollowUpToken("open", answer, key)).toBeNull();
    expect(readFollowUpToken("checkin", makeFollowUpToken("unsub", plan, key), key)).toBeNull();
  });

  it("recognises one address in any capitalisation, and never contains it", () => {
    const hash = emailHash("Buyer@Example.com ", key);
    expect(hash).toBe(emailHash("buyer@example.com", key));
    expect(hash).not.toContain("buyer");
    expect(hash).not.toBe(emailHash("buyer@example.com", "another-key"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
