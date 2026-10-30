import { after } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateIdeaBook, type GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { generateIdeaBookFromSeeds, shouldUseEngine } from "@/lib/claude/generateFromSeeds";
import { loadShownBefore, recordShown } from "@/lib/discovery/historyStore";
import { renderIdeaBookPdf, type IdeaBookPdfContext } from "@/lib/pdf/ideaBook";
import { buildSill, buildWindowItems } from "@/lib/vensterPanes";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { DOMAINS } from "@/lib/discovery/library";
import { paneActivities } from "@/lib/discovery/concretePool";
import { sendIdeaBookEmail } from "@/lib/email/windowPlan";
import { recordAuditLogEntry } from "@/lib/auditLog";
import { computeCharacterProfile, type CharacterProfile } from "@/lib/characterProfile";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { WINDOW_PLAN_PRICE } from "@/lib/pricing";
import { getSignedPdfUrl } from "@/lib/pdfAccess";
import type { Locale } from "@/lib/language";
import type { StoredIntake } from "@/app/intake/actions";
import type { Database, ProgressMeta, ProgressStage } from "@/types/database";
import { mergeProgressMeta, stageDurations } from "@/lib/progressStage";
import { localizeBook } from "@/lib/claude/localizeBook";
import { checkTestQuota, recordTestBook } from "@/lib/testQuota";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { buildAssociationSources, type AssociationSources } from "@/lib/discovery/associations";
import { buildIdeaThreads, threadSentence } from "@/lib/ideaThread";
import { knowledgeWritingV2Enabled } from "@/lib/knowledgeFlags";
import { WILDCARD_KEY, ideaKey } from "@/lib/ideaKeys";
import { trackServerEvent } from "@/lib/posthog/server";

// Re-exported so existing callers (src/app/plan/page.tsx) can keep
// importing every plan-related helper from this one module; the
// implementation itself lives in src/lib/pdfAccess.ts so it can be unit
// tested without pulling in this file's much heavier import graph
// (Claude/PDF generation, Resend, audit logging).
export { getSignedPdfUrl };

type WindowPlanRow = Database["public"]["Tables"]["window_plans"]["Row"];
type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export class PlanNotReadyError extends Error {
  constructor(
    message: string,
    public reason: "unpaid" | "generating" | "failed" | "limit",
    // For "generating": how far the book has come (null = just started), shown on the
    // waiting screen. See 0016_progress_stage.sql.
    public stage: ProgressStage | null = null,
    // The session the book belongs to, so the waiting screen can show the person's window.
    public sessionId: string | null = null,
    // For "generating": what the waiting screen needs besides the stage: when the generation
    // started (the pending row's own timestamp, so the timer is real time), the numbers the
    // pipeline recorded, and the order number for the "taking long" message.
    public info: GeneratingInfo | null = null,
  ) {
    super(message);
  }
}

export type GeneratingInfo = { startedAt: string | null; meta: ProgressMeta | null; orderRef: string | null };

// A generation that is still in flight, with the step it has reached.
type Generating = { generating: true; stage: ProgressStage | null; meta: ProgressMeta | null; startedAt: string | null };

function generatingError(g: Generating, sessionId: string, orderRef: string | null = null): PlanNotReadyError {
  return new PlanNotReadyError(STILL_GENERATING, "generating", g.stage, sessionId, {
    startedAt: g.startedAt,
    meta: g.meta,
    orderRef,
  });
}

function limitReached(sessionId: string): PlanNotReadyError {
  return new PlanNotReadyError("The test limit for this connection has been reached.", "limit", null, sessionId);
}

function isGenerating(value: unknown): value is Generating {
  return typeof value === "object" && value !== null && "generating" in value;
}

const STILL_GENERATING = "We're still putting your Idea Book together — this usually takes 1 to 2 minutes.";

// Best effort in the sense that a failed write never stops a paid book from being made, but
// never silent: every failure is logged as an error. The numbers (progress_meta, migration 0018)
// are written together with the stage; if that column is missing the stage is still written
// on its own, so the waiting screen keeps moving.
// A mail that could not be sent leaves no trace except a log line on the host. Keep the reason with the plan
// (progress_meta.email_error, no migration needed) so it can be read from the database and shown in the admin.
async function recordEmailError(supabase: ServiceRoleClient, planId: string, err: unknown): Promise<void> {
  try {
    const { data } = await supabase.from("window_plans").select("progress_meta").eq("id", planId).single();
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    await supabase
      .from("window_plans")
      .update({ progress_meta: mergeProgressMeta(data?.progress_meta, { email_error: message }) })
      .eq("id", planId);
  } catch (inner) {
    console.error("WINDOW: could not record the e-mail error:", inner);
  }
}

async function setProgressStage(
  supabase: ServiceRoleClient,
  planId: string,
  stage: ProgressStage,
  meta?: ProgressMeta,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("window_plans")
      .update(meta ? { progress_stage: stage, progress_meta: meta } : { progress_stage: stage })
      .eq("id", planId);
    if (!error) return;
    if (meta) {
      console.error(`WINDOW: could not record progress "${stage}" with numbers (run migration 0018?): ${error.message}`);
      const retry = await supabase.from("window_plans").update({ progress_stage: stage }).eq("id", planId);
      if (!retry.error) return;
      console.error(`WINDOW: could not record progress stage "${stage}" (run migration 0016?): ${retry.error.message}`);
      return;
    }
    console.error(`WINDOW: could not record progress stage "${stage}" (run migration 0016?): ${error.message}`);
  } catch (err) {
    console.error(`WINDOW: could not record progress stage "${stage}":`, err);
  }
}

// Thrown by startPlanGeneration when its own "pending" insert loses a race
// to a concurrent request for the same session (caught via the unique
// constraint from migration 0012) — signals the caller to re-resolve
// against whatever that other request produced instead of treating this
// as a hard failure.
class ConcurrentGenerationError extends Error {}

// Thrown by finishPlanGeneration when its own final "mark as ready" update
// loses the same unique-index race, from the other side: this attempt did
// all the (costly) work and only collides at the very last save step,
// because a newer attempt for the same session already claimed the active
// slot while this one was still running. Not a real failure — the newer
// attempt's own background task already owns delivering the result (and
// its own confirmation e-mail) — so this is handled as a quiet no-op by
// its caller rather than logged/treated like finishPlanGeneration's other
// error paths.
class SupersededGenerationError extends Error {}

// The Postgres/PostgREST error code for a unique-constraint violation —
// see migration 0012_prevent_concurrent_plan_generation.sql.
const UNIQUE_VIOLATION_CODE = "23505";

// A "pending" row older than this is assumed to belong to a crashed/failed
// attempt (e.g. the server process died mid-generation, or was killed by
// the platform's own function timeout) rather than one that's still
// genuinely in flight — regenerate instead of waiting forever.
//
// Deliberately set above src/app/plan/page.tsx's `maxDuration` (120s) —
// real generations (Claude + web-search research pass + PDF render) have
// been observed taking close to that ceiling themselves. A threshold at
// or below the platform's own hard timeout meant a merely-slow-but-still-
// running generation could get reclassified as "stale" by a concurrent
// request while genuinely still in flight; when that original attempt
// then finished and tried to save its own result, it collided with
// whatever newer attempt had since claimed the session's active slot
// (migration 0012's unique index) — see SupersededGenerationError below
// for how that collision is now handled gracefully rather than logged as
// an alarming failure. Setting this above the platform ceiling means a
// row still "pending" past it can only belong to a task the platform has
// already killed — it can no longer still be racing to finish.
const PENDING_TIMEOUT_MS = 150_000;

async function findExistingPlan(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<WindowPlanRow | null> {
  const { data } = await supabase
    .from("window_plans")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

// Resolves what to do with whatever row (if any) already exists for this
// session: a "ready" row is returned as-is, a fresh "pending" row means a
// generation is already in flight (surfaced as a friendly wait-and-refresh
// message instead of starting a second, fully redundant Claude call + PDF
// render + upload), a stale "pending" row is reclassified as "failed" and
// treated as nothing — safe to regenerate — and an already-"failed" row is
// surfaced as a terminal "failed" state rather than silently regenerated.
// That last case used to fall through to "safe to regenerate" too, which
// meant a hard, persistent failure (e.g. the Anthropic account running out
// of credits) triggered a brand new, fully redundant generation attempt on
// every GeneratingScreen poll, forever, with no visible error — see
// retryPlanGeneration in actions.ts for the explicit, user-triggered way to
// actually retry now.
//
// The stale-pending reclassification is itself required for migration
// 0012's partial unique index (one active row per session) to work at
// all: without it, a stale pending row would sit there as "pending"
// forever, and a fresh insert for that same session would keep losing the
// unique-index race to a row nothing is actually working on anymore.
async function resolveExistingPlan(
  supabase: ServiceRoleClient,
  existing: WindowPlanRow | null
): Promise<WindowPlanRow | Generating | "failed" | null> {
  if (!existing) return null;
  if (existing.status === "ready") return existing;
  if (existing.status === "pending") {
    const age = Date.now() - new Date(existing.created_at).getTime();
    if (age < PENDING_TIMEOUT_MS) {
      return {
        generating: true,
        stage: existing.progress_stage ?? null,
        meta: existing.progress_meta ?? null,
        startedAt: existing.created_at,
      };
    }
    await supabase.from("window_plans").update({ status: "failed" }).eq("id", existing.id);
    return null;
  }
  if (existing.status === "failed") return "failed";
  return null;
}

// Called when startPlanGeneration's own "pending" insert lost the unique-
// index race to a concurrent request for the same session (see migration
// 0012 and ConcurrentGenerationError) — re-resolves against whatever that
// other request produced instead of treating the race itself as a hard
// failure. A ready plan from the other request is returned as-is;
// anything else (including a "failed" row — that other request's own
// problem, not this one's to surface as terminal) just becomes the
// familiar "still generating, refresh in a moment" wait state.
async function resolveAfterConcurrentInsert(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<WindowPlanRow | Generating> {
  const resolved = await resolveExistingPlan(supabase, await findExistingPlan(supabase, sessionId));
  return resolved && resolved !== "failed" ? resolved : { generating: true, stage: null, meta: null, startedAt: null };
}

// Shared by generateAndSavePlan and getCharacterProfileForSession (Fase 4)
// — both need the same raw stored answers for a session, just for
// different purposes (generation vs. re-deriving the character profile for
// display after the fact).
async function fetchStoredIntake(
  supabase: ServiceRoleClient,
  sessionId: string
): Promise<StoredIntake | null> {
  const { data: intake } = await supabase
    .from("intake_answers")
    .select("raw_json")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return intake ? (intake.raw_json as unknown as StoredIntake) : null;
}

// "Verleiding" Fase 2 — just the intake answers the /plan echo header quotes
// back (see src/lib/planEcho.ts). Deliberately a narrow projection instead of
// the whole stored profile, and never throws: the echo is decoration, so a
// failed read must not take the buyer's Idea Book down with it.
export async function getIntakeEchoForSession(sessionId: string): Promise<{
  situation?: string;
  location?: string;
  timeAvailable?: string;
  budget?: string;
  company?: string[];
  // The image intake ("Het venster"): which images, for whom, and the optional open answer.
  intakeVariant?: string;
  associations?: string[];
  purpose?: string;
  personalReflection?: string;
} | null> {
  try {
    const intake = await fetchStoredIntake(createServiceRoleClient(), sessionId);
    if (!intake) return null;
    return {
      situation: intake.situation,
      location: intake.location,
      timeAvailable: intake.timeAvailable,
      budget: intake.budget,
      company: Array.isArray(intake.company) ? intake.company : [],
      intakeVariant: intake.intakeVariant,
      associations: Array.isArray(intake.associations) ? intake.associations : [],
      purpose: intake.purpose,
      personalReflection: intake.personalReflection,
    };
  } catch (err) {
    console.error("Failed to load intake echo:", err);
    return null;
  }
}

// Fase 4 (New Result Experience) — the /plan page's Discovery Profile
// screen needs the character profile too, but only for display, well after
// generateAndSavePlan has already run and returned. Rather than adding a
// new column to persist it (window_plans has no character_profile_json
// today), this just re-derives it from the same stored intake answers —
// computeCharacterProfile is pure and cheap, so recomputing it on read is
// simpler and safer than keeping a second, easy-to-drift copy in storage.
export async function getCharacterProfileForSession(
  sessionId: string
): Promise<CharacterProfile | null> {
  const supabase = createServiceRoleClient();
  const profile = await fetchStoredIntake(supabase, sessionId);
  return profile ? computeCharacterProfile(profile) : null;
}

// Bumped whenever renderIdeaBookPdf's output changes in a way worth being
// able to tell apart later (layout, legal footer text, included sections) —
// stored per plan in window_plans.pdf_version so a support/admin lookup can
// tell which template generation a given customer's PDF actually reflects.
// Not tied to LEGAL_VERSIONS — this versions the *document*, not the
// consent copy.
// 2: idea pages rebuilt as magazine spreads (experience profile, schedule,
// takeaways, "make it yours", investment/location cards) — see
// src/lib/pdf/ideaContent.ts.
// 3: "Het venster" — Newsreader + Plus Jakarta Sans instead of Noto, gold instead of orange,
// the person's own window on the cover (image intake), activity photos per idea.
const PDF_VERSION = 6;

// The cover window of an image-intake book (null otherwise): same panes as on the site.
function coverWindowFor(profile: StoredIntake, locale: Locale): IdeaBookPdfContext["window"] {
  if (profile.intakeVariant !== "associations") return undefined;
  const dict = getDictionary(locale);
  const items = buildWindowItems(
    profile,
    { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })), activities: paneActivities(locale) },
    dict.venster,
  );
  return {
    items,
    sill: buildSill(profile, dict.intake, dict.venster),
    recipientName: profile.purpose === "gift" ? profile.recipientName : undefined,
    dateLabel: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Amsterdam",
    }).format(new Date()),
  };
}

// Explicit request: every test-mode generation (the "Betaling overslaan"
// bypass, never a real purchase) also sends the real order-confirmation
// e-mail template to this fixed personal inbox, so what a real buyer
// receives can be reviewed without needing an actual payment. Not an
// environment variable — this is a developer convenience for this one
// project, not configuration that should vary per deployment.
const TEST_MODE_EMAIL_RECIPIENT = "pootjm@hotmail.com";

interface PlanGenerationContext {
  pendingRow: WindowPlanRow;
  profile: StoredIntake;
  characterProfile: CharacterProfile;
  locale: Locale;
  bookTitle: string;
}

// Inserts the "pending" row and returns everything the slow work below
// needs — split out from that slow work itself (finishPlanGeneration) so
// the two getOrCreate* functions below can do this fast part inline (so a
// concurrent request immediately sees a real "pending" row) and hand the
// slow part to `after()` instead of awaiting it in the same request. A
// page reload in the next ~90s finds this row and waits (see
// resolveExistingPlan) instead of kicking off a second, fully redundant
// generation.
async function startPlanGeneration(
  supabase: ServiceRoleClient,
  sessionId: string,
  // The order (payments.id) this generation belongs to, when there is one.
  // null for the no-payment test-mode bypass (getOrCreateTestWindowPlan) —
  // there is no order to link. Recorded on this very first "pending"
  // insert, not only the final "ready" update, so even a row that ends up
  // "failed" stays traceable to the order that triggered it for admin
  // debugging (Fase 3 Task: Admin order-detail).
  paymentId: string | null,
  // The test phase limit (src/lib/testQuota.ts): the keyed hash of the visitor's address, remembered with this
  // session once the book has really been started. null when there is no limit or no address to count.
  quotaIpHash: string | null = null,
): Promise<PlanGenerationContext> {
  const profile = await fetchStoredIntake(supabase, sessionId);

  if (!profile) {
    throw new Error("The intake profile for this session could not be found.");
  }

  // The locale was captured server-side at intake time (see
  // src/app/intake/actions.ts) rather than answered in the wizard, so the
  // book always matches what the user actually saw, even if they toggle
  // the site language afterwards.
  const locale = profile.locale ?? "nl";
  const dict = getDictionary(locale);
  const bookTitle = dict.plan.eyebrow;

  // Fase 3 (Possibility/Door Engine): computed once here and threaded into
  // both the generation call below (drives door balance/tone) and the
  // return value, so callers reuse it for audit logging instead of
  // recomputing it from the same profile a second time.
  const characterProfile = computeCharacterProfile(profile);

  const { data: pendingRow, error: pendingError } = await supabase
    .from("window_plans")
    .insert({
      session_id: sessionId,
      title: bookTitle,
      language: locale,
      status: "pending",
      payment_id: paymentId,
    })
    .select("*")
    .single();

  if (pendingError?.code === UNIQUE_VIOLATION_CODE) {
    throw new ConcurrentGenerationError();
  }

  if (pendingError || !pendingRow) {
    throw new Error(pendingError?.message ?? "Could not start generating the Idea Book.");
  }

  await recordTestBook(supabase, quotaIpHash, sessionId);

  return { pendingRow, profile, characterProfile, locale, bookTitle };
}

// The actual slow work — a Claude call (including its own live web-search
// research pass), a PDF render, and a storage upload, easily 60-100+
// seconds combined. Always called from inside an `after()` callback (see
// the two getOrCreate* functions below), never awaited directly in a
// request handler: a single request blocking that long risks the
// serverless function's own timeout on top of leaving the buyer staring at
// a blank tab with zero feedback the whole time — see GeneratingScreen.tsx
// for the polling UI this setup makes possible instead.
async function finishPlanGeneration(
  supabase: ServiceRoleClient,
  ctx: PlanGenerationContext
): Promise<{ plan: WindowPlanRow; generated: GeneratedIdeaBook; pdfBytes: Uint8Array }> {
  const { pendingRow, profile, characterProfile, locale, bookTitle } = ctx;

  try {
    const generateStartedAt = Date.now();
    // When each step finished, for the one timing line per book (see stageDurations).
    const stageMarks: Record<string, number> = {};
    // People who used the card wizard's interest step get the selection engine + grouped, cached
    // research pipeline; everyone else the classic one. If the seed pipeline fails for any reason
    // the paid book is still delivered through the classic pipeline.
    let generated: GeneratedIdeaBook;
    let progressMeta: ProgressMeta = {};
    if (shouldUseEngine(profile)) {
      try {
        // Only devices that opted in on the checkout page have a history (empty otherwise).
        const history = await loadShownBefore(supabase, pendingRow.session_id);
        generated = (
          await generateIdeaBookFromSeeds(profile, locale, characterProfile, {
            sessionId: pendingRow.session_id,
            history,
            onProgress: (stage, meta) => {
              // Every step adds its numbers to the earlier ones; one write holds them all.
              progressMeta = mergeProgressMeta(progressMeta, meta);
              stageMarks[stage] = Date.now();
              return setProgressStage(supabase, pendingRow.id, stage, progressMeta);
            },
          })
        ).book;
        await recordShown(
          supabase,
          pendingRow.session_id,
          [...generated.ideas, generated.wildcard].flatMap((idea) => (idea.activity_id ? [idea.activity_id] : [])),
        );
      } catch (err) {
        console.error("WINDOW: seed pipeline failed, falling back to the classic generation", err);
        generated = await generateIdeaBook(profile, locale, characterProfile);
      }
    } else {
      generated = await generateIdeaBook(profile, locale, characterProfile);
    }
    generated = localizeBook(generated, locale);
    console.log(`WINDOW: generateIdeaBook (Claude, total) took ${Date.now() - generateStartedAt}ms`);
    stageMarks.written = Date.now();
    await setProgressStage(supabase, pendingRow.id, "written");

    // The thread per door (R2.2): which images and tags lie behind each idea from the library,
    // kept with the book and said in one line on the PDF page. Image intake only.
    let associationSources: AssociationSources | null = null;
    const threadLines: Record<string, string> = {};
    if (profile.intakeVariant === "associations") {
      const all = [...generated.ideas, generated.wildcard];
      const built = buildAssociationSources(all, profile.associations ?? [], profile.intakeFlow === "images2" ? profile.interests ?? [] : []);
      if (Object.keys(built.sources).length + Object.keys(built.sourceTags).length > 0) {
        associationSources = built;
        const copy = getDictionary(locale).venster;
        const threads = buildIdeaThreads(generated.ideas, generated.wildcard, built, locale, { showPath: knowledgeWritingV2Enabled() });
        all.forEach((idea, i) => {
          const key = i < generated.ideas.length ? ideaKey(i) : WILDCARD_KEY;
          const line = threadSentence(threads[key], copy.thread, copy.profile.and);
          if (line && idea.activity_id) threadLines[idea.activity_id] = line;
        });
      }
    }

    const pdfStartedAt = Date.now();
    const pdfBytes = await renderIdeaBookPdf(generated, bookTitle, locale, {
      company: profile.company,
      budget: profile.budget,
      timeAvailable: profile.timeAvailable,
      window: coverWindowFor(profile, locale),
      threadLines,
    });
    console.log(`WINDOW: renderIdeaBookPdf took ${Date.now() - pdfStartedAt}ms`);
    stageMarks.rendered = Date.now();
    await setProgressStage(supabase, pendingRow.id, "rendered");

    const pdfPath = `${pendingRow.session_id}/idea-book.pdf`;

    const uploadStartedAt = Date.now();
    const { error: uploadError } = await supabase.storage
      .from("window-plans")
      .upload(pdfPath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    console.log(`WINDOW: storage upload took ${Date.now() - uploadStartedAt}ms`);
    console.log(
      `WINDOW: seconds per step: ${JSON.stringify(stageDurations(generateStartedAt, stageMarks, ["selected", "researched", "written", "rendered"]))}, total ${(
        (Date.now() - generateStartedAt) /
        1000
      ).toFixed(1)}s`,
    );

    // Compliance/security fix (Fase 3, PDF-downloadbeveiliging): the
    // `window-plans` bucket is private as of 0011_private_pdf_storage.sql,
    // so a public URL would just 400. `window_plans.pdf_url` now holds the
    // bare storage object path instead — never a directly-fetchable URL —
    // and getSignedPdfUrl() below turns it into a short-lived signed URL
    // on demand, freshly minted on every /plan render (see plan/page.tsx).
    const pdfUrl = uploadError ? null : pdfPath;

    const readyUpdate = {
      status: "ready" as const,
      profile_summary: generated.profile_summary,
      must_haves: generated.must_haves,
      preferences: generated.preferences,
      ideas_json: generated.ideas,
      wildcard_json: generated.wildcard as unknown as Record<string, unknown>,
      labels_json: generated.labels,
      pdf_url: pdfUrl,
      generated_at: new Date().toISOString(),
      pdf_version: PDF_VERSION,
    };
    const saveReady = (extra: Record<string, unknown>) =>
      supabase.from("window_plans").update({ ...readyUpdate, ...extra }).eq("id", pendingRow.id).select("*").single();
    let { data: updated, error: updateError } = await saveReady(associationSources ? { association_sources: associationSources } : {});
    if (isMissingColumnError(updateError) && associationSources) {
      // Migration 0019 has not been run yet: the book is still saved, only without its thread.
      console.error(`WINDOW: could not save the thread per door (run migration 0019?): ${updateError?.message}`);
      ({ data: updated, error: updateError } = await saveReady({}));
    }

    if (updateError?.code === UNIQUE_VIOLATION_CODE) {
      throw new SupersededGenerationError();
    }

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Could not save the Idea Book.");
    }

    return { plan: updated, generated, pdfBytes };
  } catch (err) {
    if (err instanceof SupersededGenerationError) {
      // Deliberately don't touch this row's status here — a concurrent
      // attempt already owns the session's active slot (and, most likely,
      // already reclassified this very row as "failed" itself via
      // resolveExistingPlan's stale-pending handling; overwriting it again
      // adds nothing and risks racing that other write).
      throw err;
    }
    await supabase.from("window_plans").update({ status: "failed" }).eq("id", pendingRow.id);
    throw err;
  }
}

// Called from the /plan Server Component on every visit. Generation only
// happens once per session — subsequent visits (page refresh, the emailed
// link) just read back the saved row.
export async function getOrCreateWindowPlan(
  checkoutSessionId: string
): Promise<WindowPlanRow> {
  const checkoutSession = await getStripe().checkout.sessions.retrieve(
    checkoutSessionId
  );

  if (checkoutSession.payment_status !== "paid") {
    throw new PlanNotReadyError(
      "We haven't confirmed your payment yet. If you just completed checkout, refresh in a moment.",
      "unpaid"
    );
  }

  const sessionId = checkoutSession.metadata?.session_id;

  if (!sessionId) {
    throw new Error("This checkout session is missing expected metadata.");
  }

  const supabase = createServiceRoleClient();

  // The order this plan belongs to — looked up by the Stripe Checkout
  // Session id every payments row is keyed on (see checkout/actions.ts).
  // Best-effort: a missing order shouldn't block generation, since the
  // payment itself has already been confirmed via Stripe above; it just
  // means window_plans.payment_id stays null for that row.
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id, order_number, amount, currency, created_at")
    .eq("stripe_payment_id", checkoutSessionId)
    .maybeSingle();

  const existingPlan = await resolveExistingPlan(supabase, await findExistingPlan(supabase, sessionId));
  if (isGenerating(existingPlan)) {
    throw generatingError(existingPlan, sessionId, paymentRow?.order_number ?? null);
  }
  if (existingPlan === "failed") {
    throw new PlanNotReadyError(
      "Something went wrong while creating your Idea Book. Your payment is safe — try again below.",
      "failed"
    );
  }
  if (existingPlan) return existingPlan;

  // The "pending" insert is fast and awaited here, so a concurrent request
  // (or this same buyer hitting refresh) reliably sees it and waits rather
  // than starting a second generation. The slow part — Claude, the PDF
  // render, the upload, and the order-confirmation e-mail — runs in
  // `after()`, i.e. *after* this function throws PlanNotReadyError below
  // and the page has already responded with GeneratingScreen. See
  // startPlanGeneration/finishPlanGeneration's own comments for why this
  // can't just be awaited inline.
  const quota = await checkTestQuota(supabase, sessionId);
  if (!quota.allowed) throw limitReached(sessionId);

  let ctx;
  try {
    ctx = await startPlanGeneration(supabase, sessionId, paymentRow?.id ?? null, quota.ipHash);
  } catch (err) {
    if (err instanceof ConcurrentGenerationError) {
      const resolved = await resolveAfterConcurrentInsert(supabase, sessionId);
      if (isGenerating(resolved)) {
        throw generatingError(resolved, sessionId, paymentRow?.order_number ?? null);
      }
      return resolved;
    }
    throw err;
  }

  // A paid book has started (the pending row above is unique per session, so this runs once per order): the
  // server-side count of real payments, next to the browser's checkout_pay_clicked. Nothing personal goes along.
  after(() =>
    trackServerEvent(
      "payment_succeeded",
      { is_gift: !!checkoutSession.metadata?.gift_recipient_email, amount_cents: checkoutSession.amount_total ?? 0 },
      sessionId,
    ),
  );

  after(async () => {
    try {
      const { plan, generated, pdfBytes } = await finishPlanGeneration(supabase, ctx);
      let emailDelivered = false;

      const customerEmail = checkoutSession.customer_details?.email;
      if (customerEmail) {
        const { data: user } = await supabase
          .from("users")
          .upsert({ email: customerEmail }, { onConflict: "email" })
          .select("id")
          .single();

        if (user) {
          await supabase
            .from("sessions")
            .update({ user_id: user.id })
            .eq("id", sessionId);
        }

        // A gift redirects only where the Idea Book itself is delivered —
        // the buyer still pays with their own card and gets Stripe's own
        // receipt at their own email regardless, and stays the account on
        // file above.
        const giftRecipientEmail = checkoutSession.metadata?.gift_recipient_email;
        const deliveryEmail = giftRecipientEmail || checkoutSession.metadata?.delivery_email || customerEmail;

        // Captured once here rather than re-derived from Stripe later —
        // the scheduled first-action reminder (see
        // api/cron/first-action-reminder) needs a delivery address days
        // after this checkout session is created, and re-fetching every
        // plan's Stripe session on a cron run would be both slower and a
        // needless dependency on Stripe staying reachable.
        await supabase
          .from("window_plans")
          .update({ recipient_email: deliveryEmail })
          .eq("id", plan.id);

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
        try {
          // A confirmation e-mail that can't state what was actually
          // ordered is worse than none — if the order record is somehow
          // missing, treat it the same as any other delivery failure
          // (caught below) rather than sending a confirmation with blank
          // order details.
          if (!paymentRow) {
            throw new Error(
              `No payments row found for checkout session ${checkoutSessionId}; cannot send an order confirmation.`
            );
          }

          await sendIdeaBookEmail({
            to: deliveryEmail,
            title: plan.title,
            book: generated,
            pdfBytes,
            planUrl: `${siteUrl}/plan?checkout_session_id=${checkoutSessionId}`,
            locale: plan.language as "nl" | "en",
            siteUrl,
            order: {
              orderNumber: paymentRow.order_number ?? "—",
              amountCents: paymentRow.amount,
              currency: paymentRow.currency,
              orderDate: new Date(paymentRow.created_at),
              termsVersion: LEGAL_VERSIONS.terms,
            },
          });
          emailDelivered = true;
          await supabase
            .from("window_plans")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", plan.id);
        } catch (err) {
          // Best-effort — the plan is already saved and viewable on this
          // page even if Resend is unreachable. Recorded as not-delivered
          // below so the admin audit log reflects reality. email_sent_at
          // stays null, which an admin order-detail view can use to tell
          // a genuinely undelivered order confirmation apart from a
          // delivered one.
          console.error("Failed to send order confirmation e-mail:", err);
          await recordEmailError(supabase, plan.id, err);
        }
      }

      await recordAuditLogEntry(supabase, {
        profile: ctx.profile,
        generated,
        emailDelivered,
        characterProfile: ctx.characterProfile,
      });
    } catch (err) {
      if (err instanceof SupersededGenerationError) {
        // Not a failure — a newer attempt for this session already won
        // the race and owns delivering the result (see
        // SupersededGenerationError's own comment). An info-level log is
        // enough; this shouldn't read like something went wrong.
        console.log(
          "Idea Book generation superseded by a newer attempt for this session — discarding this result."
        );
      } else {
        // finishPlanGeneration already marks the row "failed" on its own
        // error path — this is just so a background failure isn't silently
        // swallowed without at least a server log.
        console.error("Background Idea Book generation failed:", err);
      }
    }
  });

  throw generatingError({ generating: true, stage: null, meta: null, startedAt: ctx.pendingRow.created_at }, sessionId, paymentRow?.order_number ?? null);
}

// Bypass so the Idea Book can be reviewed without a real Stripe payment.
export async function getOrCreateTestWindowPlan(
  sessionId: string
): Promise<WindowPlanRow> {
  const supabase = createServiceRoleClient();

  const existingPlan = await resolveExistingPlan(supabase, await findExistingPlan(supabase, sessionId));
  if (isGenerating(existingPlan)) {
    throw generatingError(existingPlan, sessionId);
  }
  if (existingPlan === "failed") {
    throw new PlanNotReadyError(
      "Something went wrong while creating your Idea Book. Try again below.",
      "failed"
    );
  }
  if (existingPlan) return existingPlan;

  const quota = await checkTestQuota(supabase, sessionId);
  if (!quota.allowed) throw limitReached(sessionId);

  let ctx;
  try {
    ctx = await startPlanGeneration(supabase, sessionId, null, quota.ipHash);
  } catch (err) {
    if (err instanceof ConcurrentGenerationError) {
      const resolved = await resolveAfterConcurrentInsert(supabase, sessionId);
      if (isGenerating(resolved)) {
        throw generatingError(resolved, sessionId);
      }
      return resolved;
    }
    throw err;
  }

  // The test e-mail goes to the owner's own inbox, so only a generation the owner started (logged in to
  // /admin in this browser) sends it. Testers who skip the payment must not fill that inbox.
  const sendOwnerTestMail = await isAdminAuthenticated();

  after(async () => {
    let emailDelivered = false;
    try {
      const { plan, generated, pdfBytes } = await finishPlanGeneration(supabase, ctx);

      // Explicit request: a test-mode generation has no real buyer or
      // Stripe session to pull a delivery address from, but sending the
      // exact same order-confirmation e-mail to a fixed personal inbox
      // lets you see precisely what a real buyer's inbox looks like
      // without a real payment. `order` below is a clearly-labeled
      // placeholder ("TEST"), not a real order — there is no payments row
      // to attach this generation to (see startPlanGeneration's `null`
      // paymentId above).
      try {
        if (!sendOwnerTestMail) throw new Error("not the owner: no test e-mail");
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
        await sendIdeaBookEmail({
          to: TEST_MODE_EMAIL_RECIPIENT,
          title: plan.title,
          book: generated,
          pdfBytes,
          planUrl: `${siteUrl}/plan?test_session_id=${sessionId}`,
          locale: plan.language as "nl" | "en",
          siteUrl,
          order: {
            orderNumber: "TEST",
            amountCents: WINDOW_PLAN_PRICE.amountCents,
            currency: WINDOW_PLAN_PRICE.currency,
            orderDate: new Date(),
            termsVersion: LEGAL_VERSIONS.terms,
          },
        });
        emailDelivered = true;
      } catch (err) {
        if (sendOwnerTestMail) {
          console.error("Failed to send test-mode confirmation e-mail:", err);
          await recordEmailError(supabase, plan.id, err);
        }
      }

      // No real payment, so no Stripe-collected email/order either — still
      // logged (with the actual emailDelivered outcome above) so the audit
      // trail reflects every generation, not only paid ones.
      await recordAuditLogEntry(supabase, {
        profile: ctx.profile,
        generated,
        emailDelivered,
        characterProfile: ctx.characterProfile,
      });
    } catch (err) {
      if (err instanceof SupersededGenerationError) {
        console.log(
          "Idea Book generation superseded by a newer attempt for this session — discarding this result."
        );
      } else {
        console.error("Background test Idea Book generation failed:", err);
      }
    }
  });

  throw generatingError({ generating: true, stage: null, meta: null, startedAt: ctx.pendingRow.created_at }, sessionId);
}

// "Het venster" fase 4: the person's own window on the waiting screen. Only for the image
// intake; null otherwise or when anything fails (it is decoration).
export async function getWindowAnswersForSession(sessionId: string): Promise<StoredIntake | null> {
  try {
    const intake = await fetchStoredIntake(createServiceRoleClient(), sessionId);
    return intake?.intakeVariant === "associations" ? intake : null;
  } catch {
    return null;
  }
}

// What the waiting screen shows of the person's own answers, from one read: the answers for the
// window (image intake only) and the place they searched around. Never throws; it is decoration.
export async function getWaitingContext(
  sessionId: string,
): Promise<{ answers: StoredIntake | null; place: string | null }> {
  try {
    const intake = await fetchStoredIntake(createServiceRoleClient(), sessionId);
    if (!intake) return { answers: null, place: null };
    const place = typeof intake.location === "string" && intake.location.trim() ? intake.location.trim() : null;
    return { answers: intake.intakeVariant === "associations" ? intake : null, place };
  } catch {
    return { answers: null, place: null };
  }
}
