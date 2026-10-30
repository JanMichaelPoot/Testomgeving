import { describe, expect, it } from "vitest";
import { makeFollowUpToken, readFollowUpToken } from "./token";
import { activityIdsOf, followUpCookies, AVOID_COOKIE, SEASON_COOKIE } from "./avoid";
import { buildFollowUpEmail } from "@/lib/email/followUp";
import { editionDate, editionMonth, parseSeason, seasonOfMonth, seasonalEditionEnabled } from "@/lib/seasonEdition";

const KEY = "test-secret";
const PLAN = "3f2b1c4e-8a7d-4e6f-9b0a-1c2d3e4f5a6b";

describe("follow-up links", () => {
  it("carry the id of the book and a signature that only verifies for the same purpose and secret", () => {
    const token = makeFollowUpToken("open", PLAN, KEY);
    expect(readFollowUpToken("open", token, KEY)).toBe(PLAN);
    expect(readFollowUpToken("unsub", token, KEY)).toBeNull();
    expect(readFollowUpToken("open", token, "another-secret")).toBeNull();
  });

  it("refuse a changed id, a changed signature and anything that is not a token", () => {
    const token = makeFollowUpToken("open", PLAN, KEY);
    const [, sig] = token.split(".");
    expect(readFollowUpToken("open", `00000000-0000-4000-8000-000000000000.${sig}`, KEY)).toBeNull();
    expect(readFollowUpToken("open", `${PLAN}.${sig.slice(0, -1)}x`, KEY)).toBeNull();
    for (const bad of [null, undefined, "", "nodot", `${PLAN}`, "not-a-uuid.abc", `${PLAN}.`]) expect(readFollowUpToken("open", bad, KEY)).toBeNull();
  });

  it("are the same for the same book every time (so a mail can be rebuilt)", () => {
    expect(makeFollowUpToken("unsub", PLAN, KEY)).toBe(makeFollowUpToken("unsub", PLAN.toUpperCase(), KEY));
  });
});

describe("what the link leaves behind", () => {
  it("is the id of the received book, and a season only when the seasonal edition is on", () => {
    delete process.env.SEASONAL_EDITION;
    expect(followUpCookies(PLAN, "winter").map((c) => c.name)).toEqual([AVOID_COOKIE]);
    process.env.SEASONAL_EDITION = "1";
    expect(followUpCookies(PLAN, "winter").map((c) => c.name)).toEqual([AVOID_COOKIE, SEASON_COOKIE]);
    expect(followUpCookies(PLAN, null).map((c) => c.name)).toEqual([AVOID_COOKIE]);
    delete process.env.SEASONAL_EDITION;
  });

  it("takes the activity ids out of a stored book, only real ones and each once", () => {
    const ids = activityIdsOf({
      ideas_json: [{ activity_id: "hardlopen" }, { activity_id: "hardlopen" }, { activity_id: "does-not-exist" }, { title: "no id" }, null],
      wildcard_json: { activity_id: "zwemmen" },
    });
    expect(ids).toEqual(["hardlopen", "zwemmen"]);
    expect(activityIdsOf({})).toEqual([]);
  });
});

describe("the follow-up e-mail", () => {
  const input = { locale: "nl" as const, openUrl: "https://www.windowinto.nl/nieuw-venster?t=abc", unsubscribeUrl: "https://www.windowinto.nl/afmelden?t=def", siteUrl: "http://localhost:3000" };

  it("asks one thing, links the fresh intake and the unsubscribe, and says why they get it", () => {
    const mail = buildFollowUpEmail(input);
    expect(mail.subject).toBe("Tijd voor een nieuw venster?");
    expect(mail.html).toContain(input.openUrl);
    expect(mail.html).toContain(input.unsubscribeUrl);
    expect(mail.text).toContain(input.openUrl);
    expect(mail.text).toContain(input.unsubscribeUrl);
    expect(mail.text).toMatch(/toestemming/);
    expect(mail.text).toMatch(/KvK/);
    expect(mail.html + mail.text).not.toMatch(/\{\w+\}/);
  });

  it("exists in English too", () => {
    const mail = buildFollowUpEmail({ ...input, locale: "en" });
    expect(mail.subject).toBe("Time for a new window?");
    expect(mail.text).toMatch(/agreed/);
  });
});

describe("seasonal edition", () => {
  it("is off unless the flag says so", () => {
    expect(seasonalEditionEnabled(undefined)).toBe(false);
    expect(seasonalEditionEnabled("")).toBe(false);
    expect(seasonalEditionEnabled("0")).toBe(false);
    expect(seasonalEditionEnabled('"1"')).toBe(true);
    expect(seasonalEditionEnabled("true")).toBe(true);
  });

  it("reads only the four seasons", () => {
    expect(parseSeason("winter")).toBe("winter");
    for (const bad of ["Winter", "", null, undefined, 3, "monsoon"]) expect(parseSeason(bad)).toBeNull();
    expect(seasonOfMonth(12)).toBe("winter");
    expect(seasonOfMonth(3)).toBe("spring");
  });

  it("writes for today when it already is that season, otherwise for the middle of the next one", () => {
    expect(editionMonth("winter", 1)).toBe(1);
    expect(editionMonth("winter", 10)).toBe(1);
    expect(editionMonth("summer", 10)).toBe(7);
    const october = new Date("2026-10-30T10:00:00Z");
    expect(editionDate("autumn", october)).toBe(october);
    // Winter asked for in October: 15 January, next year.
    expect(editionDate("winter", october).toISOString().slice(0, 10)).toBe("2027-01-15");
    // Summer asked for in October: 15 July, also next year (this one has passed).
    expect(editionDate("summer", october).toISOString().slice(0, 10)).toBe("2027-07-15");
    // Spring asked for in January: 15 April of the same year.
    expect(editionDate("spring", new Date("2026-01-10T10:00:00Z")).toISOString().slice(0, 10)).toBe("2026-04-15");
  });
});
