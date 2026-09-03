import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";

export const LENSES = ["practical", "unusual", "ambitious", "playful"] as const;
export type Lens = (typeof LENSES)[number];

export interface GeneratedPossibility {
  lens: Lens;
  title: string;
  description: string;
}

export interface IntakeContext {
  topic: string;
  time_available: string;
  budget: string;
  desired_surprise: string;
  company: string;
}

const IDEA_COUNT = 10;

const SYSTEM_PROMPT = `You are the possibility engine behind WINDOW, an app whose promise is
"You don't need another answer. Sometimes you need to see another possibility."

Voice: intelligent, curious, warm, lightly mischievous — like a premium
travel magazine, never a productivity dashboard. Never preachy, never
generic listicle language ("Have you tried..."). Write in English.

Every possibility is written through exactly one lens:
- practical: grounded, doable today, low friction
- unusual: a genuine left-turn — something the person likely hasn't considered
- ambitious: a bigger, bolder version that stretches their stated time/budget
- playful: light, a little silly, built for delight rather than achievement

Each possibility needs a short, evocative title (max ~8 words) and a 2-3
sentence description that makes the person feel the specific texture of
doing this — not a vague benefit statement.`;

function extractToolInput<T>(message: Anthropic.Message, toolName: string): T {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === toolName
  );

  if (!toolUse) {
    throw new Error("Claude did not return the expected structured response.");
  }

  return toolUse.input as T;
}

function formatIntake(intake: IntakeContext): string {
  return `Situation: ${intake.topic}
Time available: ${intake.time_available}
Budget: ${intake.budget}
Desired level of surprise: ${intake.desired_surprise}
Company: ${intake.company}`;
}

export async function generatePossibilities(
  intake: IntakeContext
): Promise<GeneratedPossibility[]> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${formatIntake(intake)}

Propose exactly ${IDEA_COUNT} possibilities, spread across all four lenses
(at least two of each). Call the propose_possibilities tool exactly once
with all of them.`,
      },
    ],
    tools: [
      {
        name: "propose_possibilities",
        description: "Return the full set of proposed possibilities.",
        input_schema: {
          type: "object",
          properties: {
            possibilities: {
              type: "array",
              minItems: IDEA_COUNT,
              maxItems: IDEA_COUNT,
              items: {
                type: "object",
                properties: {
                  lens: { type: "string", enum: LENSES },
                  title: { type: "string" },
                  description: { type: "string" },
                },
                required: ["lens", "title", "description"],
              },
            },
          },
          required: ["possibilities"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "propose_possibilities" },
  });

  const { possibilities } = extractToolInput<{
    possibilities: GeneratedPossibility[];
  }>(message, "propose_possibilities");

  return possibilities;
}

export type RefineDirection = "weirder" | "more_practical";

const DIRECTION_PROMPTS: Record<RefineDirection, string> = {
  weirder:
    "Push this idea further from the ordinary — make it stranger, more surprising, more delightful. It's allowed to feel a little unreasonable.",
  more_practical:
    "Ground this idea — make it simpler, cheaper, and easier to actually do this week, without losing what made it appealing.",
};

export async function refinePossibility(
  idea: { title: string; description: string },
  direction: RefineDirection,
  intake: IntakeContext
): Promise<{ title: string; description: string }> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${formatIntake(intake)}

Current possibility:
Title: ${idea.title}
Description: ${idea.description}

${DIRECTION_PROMPTS[direction]}

Call the refine_possibility tool exactly once with the reshaped version.`,
      },
    ],
    tools: [
      {
        name: "refine_possibility",
        description: "Return the reshaped possibility.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["title", "description"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "refine_possibility" },
  });

  return extractToolInput<{ title: string; description: string }>(
    message,
    "refine_possibility"
  );
}
