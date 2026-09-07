"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { getLocale, type Locale } from "@/lib/language";

// The rich profile ("DNA") collected by the intake wizard. Stored whole in
// intake_answers.raw_json — see supabase/migrations/0001_init.sql for why
// intake data stays keyed off session_id rather than a user identity.
//
// Every chip/slider field stores a stable, English internal value (e.g.
// "gift", "35-44") rather than the localized label shown on screen — see
// src/lib/i18n/dictionaries.ts's `Option` type — so switching the site
// language never changes what's actually persisted.
export interface IntakeAnswers {
  situation: string;
  purpose: string;
  purposeFollowUp: string;
  ageCategory: string;
  location: string;
  searchDistance: string;
  practicalToWild: string;
  surpriseLevel: string;
  timeAvailable: string;
  budget: string;
  effort: string;
  solutionTypes: string[];
  mustHaves: string;
  preferences: string;
  company: string;
}

// The locale is not answered by the user in the wizard — it's whatever the
// site's language toggle was set to at the moment they submitted, captured
// server-side so a later toggle-flip can't retroactively change a book
// that's already mid-generation. See src/app/plan/data.ts.
export type StoredIntake = IntakeAnswers & { locale: Locale };

export async function submitIntake(answers: IntakeAnswers) {
  const supabase = createServiceRoleClient();
  const locale = await getLocale();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ status: "started" })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Could not start a session");
  }

  const stored: StoredIntake = { ...answers, locale };

  const { error: answersError } = await supabase
    .from("intake_answers")
    .insert({
      session_id: session.id,
      raw_json: { ...stored },
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

  redirect("/checkout");
}
