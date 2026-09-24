import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { resolveIdeaByKey } from "@/lib/ideaKeys";

// Which idea the first-action reminder e-mail should nudge about: the one
// the buyer said they'd do ("Dit ga ik doen" on /plan, see
// window_plans.committed_idea_key), otherwise — nothing chosen, or a stored
// key that no longer resolves — the first idea, exactly as before this
// existed. Returns null only when the plan has no ideas at all.
export function pickReminderIdea(
  ideas: IdeaBookEntry[],
  wildcard: IdeaBookEntry | null,
  committedIdeaKey: string | null | undefined
): IdeaBookEntry | null {
  return resolveIdeaByKey(committedIdeaKey, ideas, wildcard) ?? ideas[0] ?? null;
}
