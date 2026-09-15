import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { IntakeAnswers } from "@/app/intake/actions";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { CharacterProfile } from "@/lib/characterProfile";

// Always the FULL table (no MAX_ROWS cap, unlike the in-page table in
// src/app/admin/page.tsx) — this is the one place an admin can retrieve
// everything for a real audit, not just what's convenient to render live.
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WINDOW";
  workbook.created = new Date();

  // One row per generation — the input profile alongside a summary of what
  // Claude produced from it, for a quick pass over volume/patterns.
  const overview = workbook.addWorksheet("Overzicht");
  overview.columns = [
    { header: "ID", key: "id", width: 38 },
    { header: "Datum", key: "createdAt", width: 20 },
    { header: "Taal", key: "locale", width: 8 },
    { header: "Situatie", key: "situation", width: 20 },
    { header: "Doel", key: "purpose", width: 20 },
    { header: "Doel — vervolg", key: "purposeFollowUp", width: 22 },
    { header: "Leeftijdscategorie", key: "ageCategory", width: 16 },
    { header: "Locatie", key: "location", width: 18 },
    { header: "Zoekafstand", key: "searchDistance", width: 14 },
    { header: "Veilig t/m wild", key: "practicalToWild", width: 16 },
    { header: "Beschikbare tijd", key: "timeAvailable", width: 16 },
    { header: "Budget", key: "budget", width: 14 },
    { header: "Inspanning", key: "effort", width: 14 },
    { header: "Soort oplossingen", key: "solutionTypes", width: 24 },
    { header: "Must-haves (input)", key: "mustHaves", width: 24 },
    { header: "Voorkeuren (input)", key: "preferences", width: 24 },
    { header: "Bedrijf/context", key: "company", width: 18 },
    // Fase 2 (Input & Character Engine) — nieuwe ruwe antwoorden, plus het
    // hieruit afgeleide karakterprofiel (zie src/lib/characterProfile.ts).
    // Alleen gelogd voor inspectie — dit stuurt de generatie nog niet aan
    // (dat is Fase 3, de Possibility/Door Engine).
    { header: "Vrije-zaterdag-patroon", key: "freeTimePattern", width: 20 },
    { header: "Wil uitgedaagd worden", key: "challengeMe", width: 16 },
    { header: "Persoonlijke reflectie", key: "personalReflection", width: 30 },
    { header: "Nieuwsgierigheid", key: "curiosity", width: 14 },
    { header: "Spontaniteit", key: "spontaneity", width: 14 },
    { header: "Sociale energie", key: "socialEnergy", width: 14 },
    { header: "Behoefte aan structuur", key: "needForStructure", width: 18 },
    { header: "Challenge-niveau", key: "challengeLevel", width: 14 },
    { header: "Profielsamenvatting (output)", key: "outputProfileSummary", width: 42 },
    { header: "Must-haves (output)", key: "outputMustHaves", width: 24 },
    { header: "Voorkeuren (output)", key: "outputPreferences", width: 24 },
    { header: "Aantal ideeën", key: "ideaCount", width: 12 },
    { header: "Ideetitels", key: "ideaTitles", width: 42 },
    { header: "Wildcard-titel", key: "wildcardTitle", width: 24 },
    { header: "PDF gemaild", key: "emailDelivered", width: 12 },
  ];
  overview.getRow(1).font = { bold: true };
  overview.autoFilter = { from: "A1", to: "AF1" };

  // One row per idea (including the wildcard) — the actual generated
  // content, for reviewing quality/appropriateness idea by idea.
  const ideasSheet = workbook.addWorksheet("Ideeën (detail)");
  ideasSheet.columns = [
    { header: "Log-ID", key: "logId", width: 38 },
    { header: "Datum", key: "createdAt", width: 20 },
    { header: "Type", key: "kind", width: 10 },
    { header: "#", key: "index", width: 6 },
    { header: "Titel", key: "title", width: 28 },
    { header: "Intro", key: "intro", width: 38 },
    { header: "Waarom past dit", key: "whyItFits", width: 38 },
    { header: "Stappen", key: "details", width: 54 },
    { header: "Eerste actie", key: "firstAction", width: 32 },
    { header: "Kosten", key: "cost", width: 16 },
    { header: "Duur", key: "duration", width: 14 },
    { header: "Moeilijkheid", key: "difficulty", width: 14 },
    { header: "Vereisten", key: "requirements", width: 30 },
    { header: "Locatie", key: "location", width: 24 },
    // Fase 3 (Possibility/Door Engine) — de deur-categorisering en de
    // interne Serendipity Engine-scores, puur voor kwaliteitscontrole hier
    // in het logboek (niet getoond aan de gebruiker). Oudere rijen (van
    // vóór Fase 3) hebben deze velden niet — dan blijven de cellen leeg.
    { header: "Deur", key: "door", width: 14 },
    { header: "Score: relevantie", key: "scoreRelevance", width: 15 },
    { header: "Score: nieuwheid", key: "scoreNovelty", width: 15 },
    { header: "Score: haalbaarheid", key: "scoreFeasibility", width: 17 },
    { header: "Score: verrassing", key: "scoreSurprise", width: 15 },
    { header: "Score: deelbaarheid", key: "scoreShareability", width: 17 },
    { header: "Score: inspanning", key: "scoreEffort", width: 15 },
    { header: "Score: kosten", key: "scoreCost", width: 13 },
    { header: "Score: sociale fit", key: "scoreSocialFit", width: 15 },
    { header: "Score: challenge", key: "scoreChallenge", width: 15 },
  ];
  ideasSheet.getRow(1).font = { bold: true };
  ideasSheet.autoFilter = { from: "A1", to: "W1" };

  for (const row of rows) {
    const input = (row.input_json ?? {}) as Partial<IntakeAnswers> & {
      characterProfile?: CharacterProfile;
    };
    const ideas = (Array.isArray(row.output_ideas_json) ? row.output_ideas_json : []) as unknown as IdeaBookEntry[];
    const wildcard = row.output_wildcard_json as unknown as IdeaBookEntry | null;
    const createdAt = new Date(row.created_at);
    const character = input.characterProfile;

    overview.addRow({
      id: row.id,
      createdAt,
      locale: row.locale,
      situation: input.situation ?? "",
      purpose: input.purpose ?? "",
      purposeFollowUp: input.purposeFollowUp ?? "",
      ageCategory: input.ageCategory ?? "",
      location: input.location ?? "",
      searchDistance: input.searchDistance ?? "",
      practicalToWild: input.practicalToWild ?? "",
      timeAvailable: input.timeAvailable ?? "",
      budget: input.budget ?? "",
      effort: input.effort ?? "",
      solutionTypes: Array.isArray(input.solutionTypes) ? input.solutionTypes.join(", ") : "",
      mustHaves: input.mustHaves ?? "",
      preferences: input.preferences ?? "",
      company: input.company ?? "",
      freeTimePattern: input.freeTimePattern ?? "",
      challengeMe: input.challengeMe ? "Ja" : "Nee",
      personalReflection: input.personalReflection ?? "",
      curiosity: character?.dimensions.curiosity ?? "",
      spontaneity: character?.dimensions.spontaneity ?? "",
      socialEnergy: character?.dimensions.socialEnergy ?? "",
      needForStructure: character?.dimensions.needForStructure ?? "",
      challengeLevel: character?.challengeLevel ?? "",
      outputProfileSummary: row.output_profile_summary ?? "",
      outputMustHaves: (row.output_must_haves ?? []).join("; "),
      outputPreferences: (row.output_preferences ?? []).join("; "),
      ideaCount: ideas.length,
      ideaTitles: ideas.map((idea) => idea.title).join("; "),
      wildcardTitle: wildcard?.title ?? "",
      emailDelivered: row.email_delivered ? "Ja" : "Nee",
    });

    const addIdeaRow = (idea: IdeaBookEntry, kind: "Idee" | "Wildcard", index: number | null) => {
      ideasSheet.addRow({
        logId: row.id,
        createdAt,
        kind,
        index: index ?? "",
        title: idea.title,
        intro: idea.intro,
        whyItFits: idea.why_it_fits,
        details: idea.details.join(" | "),
        firstAction: idea.first_action,
        cost: idea.practical?.estimated_cost ?? "",
        duration: idea.practical?.duration ?? "",
        difficulty: idea.practical?.difficulty ?? "",
        requirements: idea.requirements.join(", "),
        location: idea.location
          ? [idea.location.name, idea.location.city].filter(Boolean).join(", ")
          : "",
        door: idea.door ?? "",
        scoreRelevance: idea.scores?.relevance ?? "",
        scoreNovelty: idea.scores?.novelty ?? "",
        scoreFeasibility: idea.scores?.feasibility ?? "",
        scoreSurprise: idea.scores?.surprise ?? "",
        scoreShareability: idea.scores?.shareability ?? "",
        scoreEffort: idea.scores?.effort ?? "",
        scoreCost: idea.scores?.cost ?? "",
        scoreSocialFit: idea.scores?.social_fit ?? "",
        scoreChallenge: idea.scores?.challenge_level ?? "",
      });
    };

    ideas.forEach((idea, i) => addIdeaRow(idea, "Idee", i + 1));
    if (wildcard) addIdeaRow(wildcard, "Wildcard", null);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `window-logboek-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
