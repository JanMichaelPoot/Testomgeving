import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  WINDOW_VOICE_SYSTEM_PROMPT,
  extractToolInput,
  formatIntake,
  type IntakeContext,
} from "@/lib/claude/shared";

export interface GeneratedWindowPlan {
  title: string;
  why_it_fits: string;
  steps: string[];
  first_action: string;
  cost_estimate: string;
  time_estimate: string;
}

const SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has now paid to turn one possibility into a real, executable
plan — this is the "Window Plan." No more browsing: give them something
they could start acting on within the hour.`;

export async function generateWindowPlan(
  idea: { lens: string; title: string; description: string },
  intake: IntakeContext
): Promise<GeneratedWindowPlan> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${formatIntake(intake)}

Chosen possibility (${idea.lens}): ${idea.title}
${idea.description}

Turn this into a Window Plan:
- title: a sharpened, final version of the title (can match the original)
- why_it_fits: 2-3 sentences on why this specifically fits their situation
- steps: 4-7 concrete, sequential, doable steps — no vague verbs like
  "plan" or "consider", say exactly what to do
- first_action: the one small thing they could do in the next hour
- cost_estimate: a short range, e.g. "€15-30"
- time_estimate: a short phrase, e.g. "One afternoon"

Call the create_window_plan tool exactly once.`,
      },
    ],
    tools: [
      {
        name: "create_window_plan",
        description: "Return the finished Window Plan.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            why_it_fits: { type: "string" },
            steps: {
              type: "array",
              minItems: 4,
              maxItems: 7,
              items: { type: "string" },
            },
            first_action: { type: "string" },
            cost_estimate: { type: "string" },
            time_estimate: { type: "string" },
          },
          required: [
            "title",
            "why_it_fits",
            "steps",
            "first_action",
            "cost_estimate",
            "time_estimate",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "create_window_plan" },
  });

  return extractToolInput<GeneratedWindowPlan>(message, "create_window_plan");
}
