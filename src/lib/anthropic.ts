import Anthropic from "@anthropic-ai/sdk";

// .trim() guards against a stray trailing newline/whitespace from pasting
// the key into a dashboard env var field — that produces a byte-for-byte
// wrong key (and a confusing "API key is invalid" response) even though
// the visible value looks correct.
export const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

export const CLAUDE_MODEL = "claude-sonnet-5";
