import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ANALYTICS_EVENTS, FORBIDDEN_PROPERTY_WORDS } from "@/lib/analyticsEvents";

// Reads every trackEvent("name", { ... }) call in the source and checks it against the catalogue:
// the event must be listed, and it may only carry the properties listed for it.

const SRC = path.join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

/** The index just after the bracket that closes the one at `open` (strings are skipped). */
function closing(text: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i + 1;
    }
  }
  throw new Error("unbalanced brackets");
}

/** The top-level property names of an object literal: `{ a: 1, b, [c]: 2 }` -> a, b. */
function topLevelKeys(literal: string): string[] {
  const body = literal.slice(1, -1);
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < body.length && body[i] !== c; i++) if (body[i] === "\\") i++;
      continue;
    }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) {
      entries.push(body.slice(start, i));
      start = i + 1;
    }
  }
  entries.push(body.slice(start));
  return entries
    .map((e) => e.replace(/\/\/.*$/gm, "").trim())
    .filter(Boolean)
    .map((e) => (e.match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/) ?? e.match(/^\[(.+?)\]\s*:/))?.[1] ?? `<<${e}>>`);
}

interface Call {
  file: string;
  name: string;
  keys: string[];
}

function findCalls(): { calls: Call[]; unreadable: string[] } {
  const calls: Call[] = [];
  const unreadable: string[] = [];
  for (const file of sourceFiles(SRC)) {
    // The definitions, and the catalogue (its comments mention the functions).
    if (file.endsWith(path.join("posthog", "client.ts")) || file.endsWith(path.join("posthog", "server.ts")) || file.endsWith("analyticsEvents.ts")) continue;
    const text = readFileSync(file, "utf8");
    // trackEvent("name", { props }) in the browser and trackServerEvent("name", { props }, id) on the server.
    for (const match of text.matchAll(/\b(trackEvent|trackServerEvent)\(/g)) {
      const open = match.index! + match[1].length;
      const end = closing(text, open);
      const args = text.slice(open + 1, end - 1).trim();
      const nameMatch = args.match(/^"([a-z_]+)"\s*(,|$)/);
      const rel = path.relative(SRC, file);
      if (!nameMatch) {
        unreadable.push(`${rel}: ${args.slice(0, 60)}`);
        continue;
      }
      const rest = args.slice(nameMatch[0].length).trim();
      calls.push({ file: rel, name: nameMatch[1], keys: rest.startsWith("{") ? topLevelKeys(rest.slice(0, closing(rest, 0) - 0)) : rest ? [`<<${rest}>>`] : [] });
    }
  }
  return { calls, unreadable };
}

describe("analytics events", () => {
  const { calls, unreadable } = findCalls();

  it("finds the calls (the scan itself works)", () => {
    expect(calls.length).toBeGreaterThan(40);
    // Sanity checks on the reader: a shorthand property, a nested expression and a call without properties.
    expect(calls.find((c) => c.name === "plan_viewed")!.keys).toEqual(["planId"]);
    expect(calls.find((c) => c.name === "profile_agreed")!.keys).toEqual(["adjusted"]);
    expect(calls.find((c) => c.name === "profile_viewed")!.keys).toEqual([]);
    // The server-side call is read too (its properties end where the object ends, the id after it is not one).
    expect(calls.find((c) => c.name === "payment_succeeded")!.keys).toEqual(["is_gift", "amount_cents"]);
  });

  it("only sends events with a literal name, so none can slip past this test", () => {
    expect(unreadable).toEqual([]);
  });

  it("only sends events that are in the catalogue", () => {
    const unknown = calls.filter((c) => !(c.name in ANALYTICS_EVENTS)).map((c) => `${c.file}: ${c.name}`);
    expect(unknown).toEqual([]);
  });

  it("only sends the properties the catalogue allows for that event", () => {
    const wrong = calls.flatMap((c) => {
      const allowed: readonly string[] = (ANALYTICS_EVENTS as Record<string, { props: readonly string[] }>)[c.name]?.props ?? [];
      return c.keys.filter((k) => !allowed.includes(k)).map((k) => `${c.file}: ${c.name} sends "${k}"`);
    });
    expect(wrong).toEqual([]);
  });

  it("has no event in the catalogue that nothing sends, and no property that nothing uses", () => {
    const sent = new Map<string, Set<string>>();
    for (const c of calls) sent.set(c.name, new Set([...(sent.get(c.name) ?? []), ...c.keys]));
    const dead = Object.keys(ANALYTICS_EVENTS).filter((n) => !sent.has(n));
    expect(dead).toEqual([]);
    const unused = Object.entries(ANALYTICS_EVENTS).flatMap(([name, spec]) => spec.props.filter((p) => !sent.get(name)?.has(p)).map((p) => `${name}.${p}`));
    expect(unused).toEqual([]);
  });

  it("has no property whose name suggests personal text (booleans start with has_)", () => {
    const risky = Object.entries(ANALYTICS_EVENTS).flatMap(([name, spec]) =>
      spec.props
        .filter((p) => !p.startsWith("has_"))
        .filter((p) => p.toLowerCase().split(/[_]|(?=[A-Z])/).some((w) => (FORBIDDEN_PROPERTY_WORDS as readonly string[]).includes(w)))
        .map((p) => `${name}.${p}`),
    );
    expect(risky).toEqual([]);
  });

  it("is written up for people: docs/analytics-events.md has a table row for every event, naming every property", () => {
    const doc = readFileSync(path.join(process.cwd(), "docs", "analytics-events.md"), "utf8");
    const missing = Object.entries(ANALYTICS_EVENTS).flatMap(([name, spec]) => {
      const line = doc.split("\n").find((l) => l.startsWith(`| \`${name}\``));
      if (!line) return [name];
      return spec.props.filter((p) => !line.includes(p)).map((p) => `${name}.${p}`);
    });
    expect(missing).toEqual([]);
  });
});
