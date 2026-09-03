"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export interface IntakeAnswers {
  topic: string;
  time_available: string;
  budget: string;
  desired_surprise: string;
  company: string;
}

export async function submitIntake(answers: IntakeAnswers) {
  const supabase = createServiceRoleClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ status: "diverging" })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Could not start a session");
  }

  const { error: answersError } = await supabase.from("intake_answers").insert({
    session_id: session.id,
    topic: answers.topic,
    time_available: answers.time_available,
    budget: answers.budget,
    desired_surprise: answers.desired_surprise,
    company: answers.company,
    raw_json: { ...answers },
  });

  if (answersError) {
    throw new Error(answersError.message);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect("/ideas");
}
