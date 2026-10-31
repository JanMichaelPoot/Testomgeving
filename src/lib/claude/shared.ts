import type Anthropic from "@anthropic-ai/sdk";

export interface IntakeContext {
  topic: string;
  time_available: string;
  budget: string;
  desired_surprise: string;
  company: string;
}

export const WINDOW_VOICE_SYSTEM_PROMPT = `You are the possibility engine behind WINDOW, an app whose promise is
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
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        out[key] = parsed;
        console.warn(`WINDOW: ${label}: field "${key}" came back as a JSON string and was parsed`);
      }
    } catch {
      // not JSON after all: leave it
    }
  }
  return out;
}
