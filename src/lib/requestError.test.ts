import { describe, expect, it } from "vitest";
import { cleanPath, describeRequestError, scrub } from "@/lib/requestError";

const NOW = new Date("2026-11-23T10:00:00Z");

describe("describeRequestError", () => {
  it("describes where and what, in one line that can be searched", () => {
    const err = Object.assign(new Error("boom"), { digest: "abc123" });
    const line = describeRequestError(err, { path: "/plan?checkout_session_id=cs_test_123&x=1", method: "GET" }, { routePath: "/plan", routeType: "render", routerKind: "App Router", renderSource: "server-rendering" }, NOW);
    expect(line).toMatchObject({ level: "error", event: "request_error", at: "2026-11-23T10:00:00.000Z", method: "GET", path: "/plan", routePath: "/plan", routeType: "render", name: "Error", message: "boom", digest: "abc123" });
    expect(JSON.parse(JSON.stringify(line)).event).toBe("request_error");
  });

  it("never carries the query string, a long token segment, an e-mail address or a key", () => {
    expect(cleanPath("/plan?checkout_session_id=cs_test_secret#frag")).toBe("/plan");
    expect(cleanPath("/shared/0123456789abcdef0123456789abcdef0123456789abcdef")).toBe("/shared/01234567…");
    expect(scrub("failed for jan@example.nl with sk_live_abcdefghijklmnop and cs_test_abcdefghijkl")).toBe("failed for [email] with [token] and [token]");
    const line = describeRequestError(new Error("cannot mail jan@example.nl"), { path: "/api/x?email=jan@example.nl", method: "POST" }, {}, NOW);
    expect(JSON.stringify(line)).not.toContain("jan@example.nl");
  });

  it("keeps the message short and the stack to a few lines, and copes with a thrown string or nothing", () => {
    const long = new Error("x".repeat(1000));
    const line = describeRequestError(long, { path: "/", method: "GET" }, {}, NOW);
    expect(line.message.length).toBe(300);
    expect((line.stack ?? "").split(" | ").length).toBeLessThanOrEqual(6);
    expect(describeRequestError("just a string", { path: "/", method: "GET" }, {}, NOW)).toMatchObject({ name: "Error", message: "just a string", digest: null, stack: null });
    expect(describeRequestError(undefined, { path: "/", method: "GET" }, {}, NOW).message).toBe("undefined");
  });
});
