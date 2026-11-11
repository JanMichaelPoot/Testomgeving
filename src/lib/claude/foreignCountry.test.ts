import { describe, expect, it, vi } from "vitest";
import { buildOnlinePrompt, buildResearchPrompt, researchSeeds, type LocalOption, type ResearchCache } from "@/lib/claude/localResearch";

// A place outside the Netherlands (the start page's country dropdown): the searches are about that country, in its own language, and its
// answers never share a cache key with a Dutch place of the same name.

const NOW = new Date("2026-11-11T10:00:00+01:00");
const opt = (name: string): LocalOption => ({ name, city: "Lyon", url: null, note: "x", until: null, rating: null });

describe("research for a place abroad", () => {
  it("talks about the chosen country, not the Netherlands", () => {
    const online = buildOnlinePrompt(["yoga"], "Lyon, Auvergne-Rhône-Alpes, Frankrijk", "nl", NOW, "France");
    expect(online).toContain("someone in\nFrance");
    expect(online).not.toContain("Netherlands");
    expect(online).toContain('"France" for a national organisation');
    const local = buildResearchPrompt(["yoga"], "Lyon", "city", "en", NOW, true, [], "France");
    expect(local).toContain("local language of the country");
    expect(local).not.toContain("Nederland");
  });

  it("keeps the Dutch prompts as they were", () => {
    expect(buildOnlinePrompt(["yoga"], "Utrecht", "nl", NOW)).toContain("Netherlands");
    expect(buildResearchPrompt(["yoga"], "Utrecht", "city", "nl", NOW, true)).toContain("in Dutch");
  });

  it("keeps the answers of Lyon in France apart from a Lyon elsewhere and from the Dutch place keys", async () => {
    const keys: string[] = [];
    const cache: ResearchCache = {
      get: async (_ids, place) => {
        keys.push(place);
        return new Map();
      },
      put: async (_entries, place) => {
        keys.push(place);
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const search = vi.fn(async (ids: string[], ..._rest: unknown[]) => new Map(ids.map((id) => [id, [opt("Studio")]])));
    const base = { location: "Lyon", searchDistance: "city", locale: "nl" as const, now: NOW, cache, search, verify: false as const, activityIds: ["yoga"] };
    await researchSeeds({ ...base, country: "FR" });
    await researchSeeds({ ...base, country: "NL" });
    await researchSeeds({ ...base, country: "FR", mode: "online" });
    const fr = keys.filter((k) => k.startsWith("fr:"));
    expect(fr.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.startsWith("lyon|"))).toBe(true);
    expect(keys.some((k) => k.startsWith("online:fr|"))).toBe(true);
    // The country (name and code) reaches the search call.
    expect(search.mock.calls[0][7]).toBe("France");
    expect(search.mock.calls[0][8]).toBe("FR");
  });
});
