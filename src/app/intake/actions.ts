"use server";

import { currentBudget } from "@/lib/budgetOptions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME, getSessionId } from "@/lib/session";
import { replaceIntake } from "@/lib/intakeEdit";
import { checkTestQuota } from "@/lib/testQuota";
import { getLocale, type Locale } from "@/lib/language";
import { sanitizeDiscoveryAnswers } from "@/lib/discovery/answers";
import { applyImageIntake } from "@/lib/discovery/imageIntake";

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
  // A behavioral scenario question ("a free Saturday opens up — what do you
  // do?") rather than a direct self-rating — see src/lib/characterProfile.ts
  // for why this reads as a more honest character signal than asking
  // "are you spontaneous?" outright.
  freeTimePattern: string;
  practicalToWild: string;
  timeAvailable: string;
  budget: string;
  effort: string;
  solutionTypes: string[];
  mustHaves: string;
  preferences: string;
  // Who this window is for — multi-select, since it's common for more than
  // one to apply at once (e.g. "for me" and "my family will join in too").
  company: string[];
  // The single open question the WindowInto brief asks to weigh heavily in
  // generation ("what would you secretly love to do more of?") — optional,
  // since forcing it would read as an interview, but strongly invited via
  // suggestion chips.
  personalReflection: string;
  // Added by the visual card wizard (docs/discovery-taxonomy.md). Optional so
  // sessions and drafts from the legacy wizard stay valid. Ids refer to
  // src/lib/discovery; they are re-validated on the server in submitIntake.
  interests?: string[];
  interestDomains?: string[];
  // Explicit "how do you like to do this" answers (SocialFormat ids, or "any"/"varies").
  socialFormats?: string[];
  // True when they asked to be surprised instead of picking interests.
  surpriseMe?: boolean;
  // Added by the image intake ("Het venster", WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md).
  // Which intake produced these answers; absent for the legacy and card wizards.
  intakeVariant?: "associations";
  // Ids of the association images chosen (src/lib/discovery/associations.json).
  associations?: string[];
  // Tags added under "Niet helemaal" when the reflection did not fit.
  associationCorrections?: string[];
  // The four sliders of "Zo kijken wij door jouw venster": where the person moved an axis away
  // from what their images said (-1 .. 1). Only the axes they touched. Sanitised on the server.
  axesOverride?: { social?: number; energy?: number; setting?: number; novelty?: number };
  // For a gift: the recipient's first name, for the cover and the greeting. Optional.
  recipientName?: string;
}

// The locale is not answered by the user in the wizard — it's whatever the
// site's language toggle was set to at the moment they submitted, captured
// server-side so a later toggle-flip can't retroactively change a book
// that's already mid-generation. See src/app/plan/data.ts.
export type StoredIntake = IntakeAnswers & { locale: Locale };

/**
 * Stores the answers (a new session, or the answers of the session in the cookie when editing) and sets the session cookie.
 * Shared by `submitIntake` (the older wizards, which continue on /checkout) and `saveIntake` (the image intake, which pays on
 * the same page).
 */
async function persistIntake(answers: IntakeAnswers, opts: { edit?: boolean } = {}): Promise<void> {
  const supabase = createServiceRoleClient();
  const locale = await getLocale();

  // The card wizard's ids come from the browser: keep only real ones.
  const discovery = sanitizeDiscoveryAnswers(answers);
  let stored: StoredIntake = {
    ...answers,
    ...discovery,
    // The card wizard no longer asks for the kind of possibility up front.
    solutionTypes: answers.solutionTypes?.length ? answers.solutionTypes : ["activity"],
    // "Gratis" is no longer a choice (D5): an old tab or draft that still sends it gets the lowest band.
    budget: currentBudget(answers.budget),
    locale,
  };
  // The image intake asks for images instead of activities and dials: translate them here,
  // once, so every later step (checkout, engine, prompt, PDF) reads the same answers.
  if (answers.intakeVariant === "associations") stored = applyImageIntake(stored, locale);

  // Changing choices before paying (fase 5): the answers of the session in the cookie are
  // replaced in place. If that is no longer possible (nothing stored, or the book is
  // already being made or paid for) this falls through and starts a fresh session, so a
  // person never loses their input.
  if (opts.edit) {
    const existing = await getSessionId();
    if (existing && (await replaceIntake(supabase, existing, stored))) return;
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ status: "started" })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Could not start a session");
  }

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
}

export async function submitIntake(answers: IntakeAnswers, opts: { edit?: boolean } = {}) {
  await persistIntake(answers, opts);
  redirect("/checkout");
}

/**
 * The image intake pays on its last screen (improvement plan D3): the answers are stored right before the payment starts, and
 * the page stays where it is. Returns whether the visitor may go on; a connection that has used its test books is refused.
 */
export async function saveIntake(answers: IntakeAnswers, opts: { edit?: boolean } = {}): Promise<{ ok: true } | { ok: false; reason: "limit" }> {
  const existing = await getSessionId();
  const quota = await checkTestQuota(createServiceRoleClient(), existing);
  if (!quota.allowed) return { ok: false, reason: "limit" };
  await persistIntake(answers, opts);
  return { ok: true };
}
