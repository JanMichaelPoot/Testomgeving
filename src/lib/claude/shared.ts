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

  return toolUse.input as T;
}
