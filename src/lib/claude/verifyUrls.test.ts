import { describe, expect, it, vi } from "vitest";
import { isPublicWebAddress, verifyOptionUrls, type Fetcher } from "@/lib/claude/verifyUrls";
import type { LocalOption } from "@/lib/claude/localResearch";

const opt = (name: string, url: string | null): LocalOption => ({ name, city: "Utrecht", url, note: "", until: null });

/** A fetcher that answers per URL: a number is a status, an Error is thrown. */
function fetcherFor(answers: Record<string, number | Error>): Fetcher & ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    const a = answers[url];
    if (a === undefined) throw new Error(`unexpected request to ${url}`);
    if (a instanceof Error) throw a;
    return { status: a };
  }) as never;
}

const dns = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND nope.nl" } });

describe("isPublicWebAddress", () => {
  it("accepts public http(s) websites only", () => {
    expect(isPublicWebAddress("https://www.steckutrecht.nl/workshops")?.hostname).toBe("www.steckutrecht.nl");
    for (const bad of ["ftp://x.nl", "javascript:alert(1)", "http://localhost:3000", "http://127.0.0.1/", "https://192.168.0.1/x", "http://[::1]/", "https://printer.local/", "https://intranet/", "nonsense"]) {
      expect(isPublicWebAddress(bad), bad).toBeNull();
    }
  });
});

describe("verifyOptionUrls", () => {
  it("keeps options without a website, and options whose website answers or redirects", async () => {
    const f = fetcherFor({ "https://a.nl/": 200, "https://b.nl/x": 301 });
    const r = await verifyOptionUrls([opt("none", null), opt("A", "https://a.nl/"), opt("B", "https://b.nl/x")], f);
    expect(r.kept.map((o) => o.name)).toEqual(["none", "A", "B"]);
    expect(r.dropped).toEqual([]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("drops a host that does not exist", async () => {
    const r = await verifyOptionUrls([opt("Ghost", "https://nope.nl/")], fetcherFor({ "https://nope.nl/": dns() }));
    expect(r.kept).toEqual([]);
    expect(r.dropped).toEqual([{ option: expect.objectContaining({ name: "Ghost" }), reason: "host_does_not_exist" }]);
  });

  it("drops an address that is not a public website without calling it", async () => {
    const f = fetcherFor({});
    const r = await verifyOptionUrls([opt("Inside", "http://169.254.169.254/latest"), opt("Local", "http://localhost/")], f);
    expect(r.kept).toEqual([]);
    expect(r.dropped.map((d) => d.reason)).toEqual(["not_a_public_website", "not_a_public_website"]);
    expect(f).not.toHaveBeenCalled();
  });

  it("keeps the option with the site's front page when only the page is gone", async () => {
    const f = fetcherFor({ "https://club.nl/oud": 404, "https://club.nl/": 200 });
    const r = await verifyOptionUrls([opt("Club", "https://club.nl/oud")], f);
    expect(r.kept).toEqual([expect.objectContaining({ name: "Club", url: "https://club.nl/" })]);
  });

  it("drops the option when the page and the whole site are gone", async () => {
    const f = fetcherFor({ "https://weg.nl/x": 404, "https://weg.nl/": 410 });
    const r = await verifyOptionUrls([opt("Weg", "https://weg.nl/x")], f);
    expect(r.kept).toEqual([]);
    expect(r.dropped[0].reason).toBe("page_gone");
  });

  it("does not punish what it cannot know: robots blocked, rate limited, errors, timeouts", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const f = fetcherFor({ "https://a.nl/": 403, "https://b.nl/": 429, "https://c.nl/": 503, "https://d.nl/": timeout });
    const r = await verifyOptionUrls([opt("A", "https://a.nl/"), opt("B", "https://b.nl/"), opt("C", "https://c.nl/"), opt("D", "https://d.nl/")], f);
    expect(r.kept).toHaveLength(4);
  });

  it("asks again with GET when a server refuses HEAD, and never follows redirects", async () => {
    const calls: { method: string; redirect: string }[] = [];
    const f: Fetcher = async (_url, init) => {
      calls.push({ method: init.method, redirect: init.redirect });
      return { status: init.method === "HEAD" ? 405 : 200 };
    };
    const r = await verifyOptionUrls([opt("Picky", "https://picky.nl/")], f);
    expect(r.kept).toHaveLength(1);
    expect(calls).toEqual([
      { method: "HEAD", redirect: "manual" },
      { method: "GET", redirect: "manual" },
    ]);
  });
});
