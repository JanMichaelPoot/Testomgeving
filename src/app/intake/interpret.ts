"use server";

import { getLocale } from "@/lib/language";
import { buildFacts, type InterpretRequest } from "@/lib/discovery/interpretFacts";
import { callModel } from "@/lib/claude/qualityRepair";
import { CLAUDE_MODEL } from "@/lib/anthropic";
import {
  INTERPRET_TOOL,
  createCache,
  createLimiter,
  factsKey,
  interpretSystemPrompt,
  interpretUserPrompt,
  validateBlocks,
  type InterpretBlocks,
  type InterpretFacts,
} from "@/lib/discovery/interpretation";
import { requestIpHash } from "@/lib/testQuota";

// The model-written version of the three blocks of the results page. The visitor already has the fixed text when this runs, so every
// way this can fail (no key, a limit, an error, an answer that fails the checks) simply leaves that text in place.
//
// Cost: one small model call (a few hundred tokens in and out, about half a cent) per distinct set of choices. The same choices are
// answered from a cache, and a connection may ask for only a handful of readings per ten minutes; both are remembered per server instance
// only (no database), which bounds the cost without a migration. See docs/centrale-intake.md.

export type InterpretResult = { ok: true; blocks: InterpretBlocks } | { ok: false; reason: "disabled" | "limit" | "invalid" | "failed" };

const cache = createCache<InterpretBlocks>();
const perConnection = createLimiter(8, 10 * 60 * 1000);
const overall = createLimiter(400, 60 * 60 * 1000);

export async function interpretProfile(req: InterpretRequest): Promise<InterpretResult> {
  if (process.env.WINDOW_INTERPRETATION === "0" || !(process.env.ANTHROPIC_API_KEY ?? "").trim()) return { ok: false, reason: "disabled" };
  const locale = await getLocale();
  let facts: InterpretFacts | null;
  try {
    facts = buildFacts(req, locale);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!facts) return { ok: false, reason: "invalid" };

  const key = factsKey(facts);
  const cached = cache.get(key);
  if (cached) return { ok: true, blocks: cached };

  let who = "unknown";
  try {
    who = (await requestIpHash()) ?? "unknown";
  } catch {
    // no readable address (a local run): everyone shares one bucket, which is fine for a limit that only bounds cost.
  }
  if (!perConnection.take(who) || !overall.take("all")) return { ok: false, reason: "limit" };

  const raw = await callModel({
    // The writing model, not the cheap one: this text sits on the page that sells the book, and the cheap model slipped on its Dutch in the
    // first real test. The cost is still about half a cent per distinct set of choices.
    model: process.env.WINDOW_INTERPRETATION_MODEL || CLAUDE_MODEL,
    system: interpretSystemPrompt(facts),
    user: interpretUserPrompt(facts),
    tool: { name: INTERPRET_TOOL.name, description: INTERPRET_TOOL.description, schema: INTERPRET_TOOL.schema as unknown as Record<string, unknown> },
    maxTokens: 450,
  });
  const blocks = validateBlocks(raw, facts);
  if (!blocks) {
    console.warn(`WINDOW: interpretation dropped (${raw ? "failed the checks" : "no answer"})`);
    return { ok: false, reason: "failed" };
  }
  cache.set(key, blocks);
  return { ok: true, blocks };
}
