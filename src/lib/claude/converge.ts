import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  WINDOW_VOICE_SYSTEM_PROMPT,
  extractToolInput,
  formatIntake,
  type IntakeContext,
} from "@/lib/claude/shared";

export interface CandidateInput {
  id: string;
  lens: string;
  title: string;
  description: string;
}

export interface CandidateSelection {
  idea_id: string;
  why_it_fits: string;
}

const SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

You are now narrowing down, not generating. The person has already liked
these possibilities — your job is to help them see which ones are truly
worth turning into a real, paid-for plan, and why each one specifically
fits their stated situation.`;

export async function selectCandidates(
  ideas: CandidateInput[],
  intake: IntakeContext
): Promise<CandidateSelection[]> {
  const maxCandidates = Math.min(3, ideas.length);

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${formatIntake(intake)}

The person liked these possibilities:
${ideas
  .map((idea) => `- [id: ${idea.id}] (${idea.lens}) ${idea.title} — ${idea.description}`)
  .join("\n")}

Choose exactly ${maxCandidates} of these (by id) as the final candidates —
the ones most worth turning into a real plan. For each, write 1-2 sentences
on why it specifically fits their situation. Call the select_candidates
tool exactly once.`,
      },
    ],
    tools: [
      {
        name: "select_candidates",
        description: "Return the chosen candidate ideas with why they fit.",
        input_schema: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              minItems: maxCandidates,
              maxItems: maxCandidates,
              items: {
                type: "object",
                properties: {
                  idea_id: {
                    type: "string",
                    enum: ideas.map((idea) => idea.id),
                  },
                  why_it_fits: { type: "string" },
                },
                required: ["idea_id", "why_it_fits"],
              },
            },
          },
          required: ["candidates"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "select_candidates" },
  });

  const { candidates } = extractToolInput<{
    candidates: CandidateSelection[];
  }>(message, "select_candidates");

  return candidates;
}
