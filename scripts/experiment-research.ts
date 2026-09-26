// Experiment: what does the local-research pass cost with different settings, and does
// it still find real, linkable options? Same prompt as generateIdeaBook's research pass,
// run once per variant on one sample profile. Costs real money (about $0.05-0.16 per
// variant). Findings are written up in docs/discovery-api-costs.md.
//
//   npx tsx scripts/experiment-research.ts baseline dynamic haiku two
import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim() });

const SYSTEM = `You are a meticulous local-options researcher for WINDOW, a
possibility-discovery app. Your only job here is to use web search to find
REAL, CURRENTLY OPERATING businesses, venues, routes, events, or platforms
that concretely match the profile below — always verify with a search,
never rely on memory or a plausible-sounding guess. Write your findings in
Dutch as a compact, scannable research brief, not prose.`;

const USER = `Location: Utrecht
Search distance: city
Situation: Ik zoek iets creatiefs voor de zaterdag, ik werk de hele week achter een scherm
Purpose: self
Purpose detail: Iets met mijn handen
Time available: halfday
Budget: 25
Open to these kinds of possibilities: activity
Must-haves (hard constraints): none stated
Preferences (soft nudges): Liefst met andere mensen
Company: friends

Search for concrete, real, currently-operating options relevant to this
person's location and search distance, their situation/purpose, budget,
time available, and the kinds of possibilities they're open to. Cover a
spread of different activity types rather than depth on just one. For each
theme you find something for, list 2-3 real named options: the
business/venue/route/event/platform's name, its city, a one-line
description of what it is, and its website URL exactly as it appears in
your search results (only include a URL you actually saw in the results —
never guess one). If you cannot verify anything real for a theme, say so
explicitly rather than inventing a name.`;

// USD per million tokens
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

interface Variant {
  model: string;
  tool: string;
  maxUses: number;
  note: string;
}
const VARIANTS: Record<string, Variant> = {
  baseline: { model: "claude-sonnet-5", tool: "web_search_20250305", maxUses: 4, note: "today: Sonnet 5, basic search, 4 searches" },
  dynamic: { model: "claude-sonnet-5", tool: "web_search_20260209", maxUses: 4, note: "Sonnet 5, dynamic-filtering search, 4 searches" },
  haiku: { model: "claude-haiku-4-5-20251001", tool: "web_search_20250305", maxUses: 4, note: "Haiku 4.5, basic search, 4 searches" },
  two: { model: "claude-sonnet-5", tool: "web_search_20250305", maxUses: 2, note: "Sonnet 5, basic search, 2 searches" },
};

async function run(name: string) {
  const v = VARIANTS[name];
  const t0 = Date.now();
  const message = await client.messages.create({
    model: v.model,
    max_tokens: 4000,
    ...(v.model === "claude-sonnet-5" ? { output_config: { effort: "medium" } } : {}),
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: USER }],
    tools: [
      // Cast: the SDK's tool union does not list every dated server-tool version.
      { type: v.tool, name: "web_search", max_uses: v.maxUses, user_location: { type: "approximate", city: "Utrecht", country: "NL" } } as never,
    ],
  } as never);
  const u = message.usage as unknown as {
    input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
  const p = PRICES[v.model];
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  const cost =
    (u.input_tokens / 1e6) * p.input + (u.output_tokens / 1e6) * p.output +
    ((u.cache_creation_input_tokens ?? 0) / 1e6) * p.input * 1.25 + ((u.cache_read_input_tokens ?? 0) / 1e6) * p.input * 0.1 + searches * 0.01;
  const text = message.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
  const urls = new Set(text.match(/https?:\/\/[^\s)>\]]+/g) ?? []);
  console.log(
    `${name.padEnd(9)} ${v.note}\n  ${Math.round((Date.now() - t0) / 1000)}s  in ${u.input_tokens}  out ${u.output_tokens}  cacheW ${u.cache_creation_input_tokens ?? 0}  cacheR ${u.cache_read_input_tokens ?? 0}  searches ${searches}  = $${cost.toFixed(3)}\n  brief: ${text.length} chars, ${urls.size} distinct URLs, stop ${message.stop_reason}`,
  );
  return { name, text };
}

async function main() {
  const names = process.argv.slice(2).filter((n) => VARIANTS[n]);
  for (const n of names.length ? names : ["baseline"]) {
    try {
      const r = await run(n);
      console.log("  " + r.text.split("\n").slice(0, Number(process.env.SHOW_LINES ?? 6)).join("\n  ") + "\n");
    } catch (err) {
      console.log(`${n} FAILED: ${err instanceof Error ? err.message.slice(0, 300) : String(err)}\n`);
    }
  }
}
main();
