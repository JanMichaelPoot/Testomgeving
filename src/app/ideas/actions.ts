"use server";

import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { refinePossibility, type RefineDirection } from "@/lib/claude/ideas";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function getOwnedIdea(ideaId: string, supabase: ServiceClient) {
  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new Error("No active session.");
  }

  const { data: idea, error } = await supabase
    .from("ideas")
    .select("id, session_id, title, description")
    .eq("id", ideaId)
    .single();

  if (error || !idea || idea.session_id !== sessionId) {
    throw new Error("That idea could not be found in this session.");
  }

  return idea;
}

export async function likeIdea(ideaId: string) {
  const supabase = createServiceRoleClient();
  await getOwnedIdea(ideaId, supabase);

  const { error } = await supabase
    .from("ideas")
    .update({ status: "liked" })
    .eq("id", ideaId);

  if (error) throw new Error(error.message);
}

export async function skipIdea(ideaId: string) {
  const supabase = createServiceRoleClient();
  await getOwnedIdea(ideaId, supabase);

  const { error } = await supabase
    .from("ideas")
    .update({ status: "skipped" })
    .eq("id", ideaId);

  if (error) throw new Error(error.message);
}

export async function reshapeIdea(ideaId: string, direction: RefineDirection) {
  const supabase = createServiceRoleClient();
  const idea = await getOwnedIdea(ideaId, supabase);

  const { data: intake } = await supabase
    .from("intake_answers")
    .select("*")
    .eq("session_id", idea.session_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reshaped = await refinePossibility(
    { title: idea.title, description: idea.description },
    direction,
    {
      topic: intake?.topic ?? "",
      time_available: intake?.time_available ?? "",
      budget: intake?.budget ?? "",
      desired_surprise: intake?.desired_surprise ?? "",
      company: intake?.company ?? "",
    }
  );

  const { error } = await supabase
    .from("ideas")
    .update({
      title: reshaped.title,
      description: reshaped.description,
      status: "refined",
    })
    .eq("id", ideaId);

  if (error) throw new Error(error.message);

  return reshaped;
}
