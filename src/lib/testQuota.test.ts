import { describe, expect, it } from "vitest";
import { decide, firstIp, hashIp, isExemptIp, parseExemptIps, parseLimit } from "@/lib/testQuota";

describe("parseLimit", () => {
  it("reads a positive whole number, and nothing else switches the limit on", () => {
    expect(parseLimit("2")).toBe(2);
    expect(parseLimit(' "3" ')).toBe(3);
    for (const bad of [undefined, "", "0", "-1", "abc", "1.5"]) expect(parseLimit(bad)).toBeNull();
  });
});

describe("firstIp", () => {
  it("takes the visitor, the first address of the chain, and falls back to x-real-ip", () => {
    expect(firstIp("203.0.113.9, 10.0.0.1, 10.0.0.2")).toBe("203.0.113.9");
    expect(firstIp(null, "198.51.100.4")).toBe("198.51.100.4");
    expect(firstIp("", null)).toBeNull();
    expect(firstIp(undefined)).toBeNull();
  });
});

describe("hashIp", () => {
  it("is stable for an address, differs per address and per secret, and does not contain the address", () => {
    const a = hashIp("203.0.113.9", "s1");
    expect(hashIp("203.0.113.9", "s1")).toBe(a);
    expect(hashIp("203.0.113.10", "s1")).not.toBe(a);
    expect(hashIp("203.0.113.9", "s2")).not.toBe(a);
    expect(a).not.toContain("203");
    expect(a).toHaveLength(40);
  });
});

describe("decide", () => {
  const base = { limit: 2, used: 0, owner: false, ipHash: "h", sessionAlreadyCounted: false };
  it("lets a connection make books until the limit is used", () => {
    expect(decide({ ...base, used: 0 }).allowed).toBe(true);
    expect(decide({ ...base, used: 1 }).allowed).toBe(true);
    expect(decide({ ...base, used: 2 }).allowed).toBe(false);
    expect(decide({ ...base, used: 5 }).allowed).toBe(false);
  });

  it("never stops the owner, nor a session whose book was already counted, nor when there is no limit or no address", () => {
    expect(decide({ ...base, used: 9, owner: true }).allowed).toBe(true);
    expect(decide({ ...base, used: 2, sessionAlreadyCounted: true }).allowed).toBe(true);
    expect(decide({ ...base, used: 9, limit: null }).allowed).toBe(true);
    expect(decide({ ...base, used: 9, ipHash: null }).allowed).toBe(true);
  });
});

describe("exempt addresses", () => {
  it("reads a list separated by commas, semicolons or spaces, ignoring quotes, blanks and case", () => {
    expect(parseExemptIps('"162.120.187.203, 2001:DB8::1;10.0.0.1  "')).toEqual(["162.120.187.203", "2001:db8::1", "10.0.0.1"]);
    expect(parseExemptIps(undefined)).toEqual([]);
    expect(parseExemptIps("  ")).toEqual([]);
  });

  it("matches exactly, so a neighbouring address stays limited", () => {
    const list = parseExemptIps("162.120.187.203");
    expect(isExemptIp("162.120.187.203", list)).toBe(true);
    expect(isExemptIp(" 162.120.187.203 ", list)).toBe(true);
    expect(isExemptIp("162.120.187.20", list)).toBe(false);
    expect(isExemptIp("162.120.187.2031", list)).toBe(false);
    expect(isExemptIp(null, list)).toBe(false);
    expect(isExemptIp("162.120.187.203", [])).toBe(false);
  });
});
