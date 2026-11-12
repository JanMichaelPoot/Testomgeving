import type Anthropic from "@anthropic-ai/sdk";

export interface IntakeContext {
  topic: string;
  time_available: string;
  budget: string;
  desired_surprise: string;
  company: string;
}

export const WINDOW_VOICE_SYSTEM_PROMPT = `You are the possibility engine behind WindowInto, an app whose promise is
"You don't need another answer. Sometimes you need to see another possibility."

Voice: intelligent, curious, warm, lightly mischievous — like a premium
travel magazine, never a productivity dashboard. Never preachy, never
generic listicle language ("Have you tried..."). Write in English.`;

export function formatIntake(intake: IntakeContext): string {
  return `Situation: ${intake.topic}
Time available: ${intake.time_available}
Budget: ${intake.budget}
Desired level of surprise: ${intake.desired_surprise}
Company: ${intake.company}`;
}

export function extractToolInput<T>(
  message: Anthropic.Message,
  toolName: string
): T {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === toolName
  );

  if (!toolUse) {
    throw new Error("Claude did not return the expected structured response.");
  }

  return repairStringifiedFields(toolUse.input, toolName) as T;
}

/**
 * Closes what a model forgot to close in the middle of a JSON text: a "]" or "}" that arrives while another bracket is still open
 * ("[{...}, {..." followed by "]") gets the missing closers put in front of it. Nothing else is touched: a text that simply ends too
 * early, or has a closer with nothing open, is not repaired (null), because then something larger is wrong and a retry is the honest answer.
 */
export function insertMissingClosers(text: string): string | null {
  const stack: string[] = [];
  let out = "";
  let inString = false;
  let escaped = false;
  let inserted = 0;
  for (const ch of text) {
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") stack.push("]");
    else if (ch === "{") stack.push("}");
    else if (ch === "]" || ch === "}") {
      if (!stack.includes(ch)) return null;
      while (stack[stack.length - 1] !== ch) {
        out += stack.pop();
        if (++inserted > 3) return null;
      }
      stack.pop();
    }
    out += ch;
  }
  return inserted > 0 && stack.length === 0 && !inString ? out : null;
}

/**
 * Models now and then return a list or an object of a tool call as a JSON *string* ("ideas": "[{...}]") instead of as the list itself.
 * That used to cost a whole retry of a paid call ("ideas: no list"), so a top-level string that parses to an array or object is
 * turned back into one. Anything else is left exactly as it came, and every repair is logged.
 */
export function repairStringifiedFields(input: unknown, label = "tool"): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (!/^[[{]/.test(text)) continue;
    const attempts = [text];
    // valid JSON followed by stray text (a trailing remark): try again up to the last closing bracket
    const close = text.lastIndexOf(text[0] === "[" ? "]" : "}");
    if (close > 0 && close < text.length - 1) attempts.push(text.slice(0, close + 1));
    let failure = "";
    const closed = insertMissingClosers(text);
    if (closed) attempts.push(closed);
    for (const attempt of attempts) {
      try {
        const parsed: unknown = JSON.parse(attempt);
        if (parsed && typeof parsed === "object") {
          out[key] = parsed;
          console.warn(`WINDOW: ${label}: field "${key}" came back as a JSON string and was parsed${attempt === text ? "" : attempt === closed ? " (a missing closing bracket was put back)" : " (stray text after it was dropped)"}`);
          break;
        }
      } catch (err) {
        // Not JSON after all: leave it, but say why (the first failure: a position and the characters around it), because a failed repair costs a whole retry.
        const at = Number(/position (\d+)/.exec(err instanceof Error ? err.message : "")?.[1]);
        const around = Number.isFinite(at) ? JSON.stringify(attempt.slice(Math.max(0, at - 40), at + 40)) : "";
        if (attempt === attempts[0]) failure = `${err instanceof Error ? err.message : String(err)}; length ${attempt.length}; around: ${around}`;
      }
    }
    if (failure && typeof out[key] === "string" && /^(\[\s*\{|\{\s*")/.test(text)) console.warn(`WINDOW: ${label}: field "${key}" is a string that is not valid JSON (${failure})`);
  }
  return out;
}
