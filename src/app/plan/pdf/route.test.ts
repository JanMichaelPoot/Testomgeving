// Fix round "plan links": the PDF comes from our own address; whatever goes wrong, the reader gets our branded page, never a storage address
// or a JSON error.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const find = vi.fn();
const bytes = vi.fn();
vi.mock("@/lib/planAccess", async () => {
  const query = (key: { checkoutSessionId: string | null; testSessionId: string | null }, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (key.checkoutSessionId) p.set("checkout_session_id", key.checkoutSessionId);
    if (key.testSessionId) p.set("test_session_id", key.testSessionId);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };
  return {
    findViewablePlan: (...a: unknown[]) => find(...a),
    planPdfBytes: (...a: unknown[]) => bytes(...a),
    planQuery: query,
    planKeyFrom: (get: (n: string) => string | null) => ({ checkoutSessionId: get("checkout_session_id"), testSessionId: get("test_session_id") }),
  };
});

const { GET } = await import("./route");
const request = (query: string) => new NextRequest(`https://windowinto.nl/plan/pdf?${query}`);

beforeEach(() => {
  find.mockReset();
  bytes.mockReset();
});

describe("/plan/pdf", () => {
  it("streams the PDF from our own address, private and without passing the key on", async () => {
    find.mockResolvedValue({ id: "p1", language: "en" });
    bytes.mockResolvedValue(new TextEncoder().encode("%PDF-1.7"));
    const res = await GET(request("checkout_session_id=cs_1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await res.text()).toBe("%PDF-1.7");
  });

  it("downloads when asked and makes the file again when asked", async () => {
    find.mockResolvedValue({ id: "p1", language: "nl" });
    bytes.mockResolvedValue(new Uint8Array([1]));
    const res = await GET(request("checkout_session_id=cs_1&download=1&rebuild=1"));
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(bytes.mock.calls[0][1]).toBe(true);
  });

  it.each([
    ["an unknown or unpaid link", () => find.mockResolvedValue(null)],
    ["a missing file that cannot be made again", () => (find.mockResolvedValue({ id: "p1", language: "nl" }), bytes.mockResolvedValue(null))],
    ["an unexpected failure", () => find.mockRejectedValue(new Error('{"statusCode":"400","message":"querystring must have required property \'token\'"}'))],
  ])("sends %s to the branded page", async (_name, arrange) => {
    arrange();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(request("checkout_session_id=cs_1"));
    expect(res.status).toBe(303);
    const target = new URL(res.headers.get("location")!);
    expect(target.host).toBe("windowinto.nl");
    expect(target.pathname).toBe("/plan/boek");
    expect(target.searchParams.get("probleem")).toBe("1");
    expect(await res.text()).not.toMatch(/statusCode|supabase|token/);
  });
});
