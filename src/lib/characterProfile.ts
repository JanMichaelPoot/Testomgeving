import type { IntakeAnswers } from "@/app/intake/actions";

// Fase 2 (Input & Character Engine) van het WindowInto-transformatieplan.
//
// Dit is bewust een pure, deterministische functie — geen extra Claude-call.
// Vier redenen: (1) elke score is precies herleidbaar en dus testbaar/
// debugbaar (zie scripts/test-character-profile.ts), waar een AI-afgeleid
// profiel per aanroep kan verschuiven; (2) geen extra latency/kosten per
// aanvraag; (3) het sluit aan bij de bestaande "raw_json bevat alles"-
// aanpak — geen nieuw databaseschema of AI-schema nodig; (4) het maakt het
// mogelijk om de scoring-regels los van de generatie te itereren (Fase 3
// bouwt de Possibility/Door Engine, die dit profiel als *input* gebruikt,
// niet als iets dat Claude zelf opnieuw moet raden).
//
// Belangrijk: dit profiel is intern. Het master-prompt waarschuwt expliciet
// tegen rigide labels ("Jij bent een avonturier") — deze dimensies worden
// dus nergens 1-op-1 aan de gebruiker getoond. Een eventuele "Your Discovery
// Profile"-pagina (Fase 4) vertaalt dit naar zachte, speelse taal ("You seem
// to...", "Your answers suggest..."), niet naar deze rauwe getallen.

export interface CharacterDimensions {
  /** Nieuwsgierigheid / trek naar het onbekende. */
  curiosity: number;
  /** Neiging tot spontane in plaats van geplande keuzes. */
  spontaneity: number;
  /** Energie/voorkeur voor het samen doen van dingen vs. alleen. */
  socialEnergy: number;
  /** Behoefte aan een voorspelbaar, bekend kader. */
  needForStructure: number;
}

export interface CharacterProfile {
  /** Elke dimensie 0–100, 50 = neutraal/onbekend. */
  dimensions: CharacterDimensions;
  /**
   * Hoe ver voorbij de comfortzone gegenereerde mogelijkheden mogen reiken —
   * een aparte as van de vier dimensies hierboven (zie sectie 3 "HOW FAR YOU
   * WANT TO GO" in het master-prompt): afgeleid van de practicalToWild-dial,
   * niet van karakter an sich. (De losstaande "daag me uit"-toggle die hier
   * eerder ook aan bijdroeg, is verwijderd — de wildcard en de "stretch"-deur
   * zijn nu standaard onderdeel van elk Idea Book, zonder aparte opt-in.)
   */
  challengeLevel: number;
  /**
   * Korte, alleen-intern leesbare notities over welke antwoorden welke
   * score dreven — nooit rechtstreeks aan de gebruiker tonen. Puur voor
   * debugging/audit (zie het testscript en de audit-log-integratie).
   */
  signals: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

// Legt de vijfpunts practicalToWild-dial op een 0–100-as, zodat andere
// dimensies er anteelsgewijs van kunnen meewegen.
const WILDNESS_BY_DIAL: Record<string, number> = {
  grounded: 0,
  practical: 25,
  either: 50,
  unexpected: 75,
  wild: 100,
};

function wildnessScore(practicalToWild: string): number {
  return WILDNESS_BY_DIAL[practicalToWild] ?? 50;
}

export function computeCharacterProfile(answers: IntakeAnswers): CharacterProfile {
  const signals: string[] = [];
  const note = (text: string) => signals.push(text);

  const freeTimePattern = answers.freeTimePattern || "";
  const practicalToWild = answers.practicalToWild || "either";
  const effort = answers.effort || "";
  const solutionTypes = answers.solutionTypes ?? [];
  const personalReflection = (answers.personalReflection || "").trim();
  const wildness = wildnessScore(practicalToWild);

  // --- Curiosity ---------------------------------------------------------
  let curiosity = 50;
  if (freeTimePattern === "search") {
    curiosity += 25;
    note("freeTimePattern=search → +25 curiosity");
  } else if (freeTimePattern === "spontaneous") {
    curiosity += 10;
    note("freeTimePattern=spontaneous → +10 curiosity");
  } else if (freeTimePattern === "ask") {
    curiosity += 5;
  } else if (freeTimePattern === "familiar") {
    curiosity -= 15;
    note("freeTimePattern=familiar → -15 curiosity");
  } else if (freeTimePattern === "stayhome") {
    curiosity -= 20;
    note("freeTimePattern=stayhome → -20 curiosity");
  }
  // Breadth of what they are open to: the worlds picked in the card wizard when there
  // are any, otherwise the kinds of possibility (classic wizard). Someone who asked to
  // be surprised gets no adjustment: that is a choice, not a narrow taste.
  const interestDomains = answers.interestDomains ?? [];
  const breadth = interestDomains.length > 0 ? interestDomains.length : solutionTypes.length;
  const breadthDelta = answers.surpriseMe ? 0 : clamp((breadth - 2) * 6, -12, 24);
  if (breadthDelta !== 0) {
    curiosity += breadthDelta;
    note(`breadth (${breadth}) → ${breadthDelta > 0 ? "+" : ""}${breadthDelta} curiosity`);
  }
  curiosity += (wildness - 50) * 0.2;
  if (personalReflection.length > 3) {
    curiosity += 8;
    note("personalReflection answered → +8 curiosity");
  }

  // --- Spontaneity ---------------------------------------------------------
  let spontaneity = 50;
  if (freeTimePattern === "spontaneous") {
    spontaneity += 30;
    note("freeTimePattern=spontaneous → +30 spontaneity");
  } else if (freeTimePattern === "ask") {
    spontaneity += 10;
  } else if (freeTimePattern === "search") {
    spontaneity += 5;
  } else if (freeTimePattern === "familiar") {
    spontaneity -= 20;
    note("freeTimePattern=familiar → -20 spontaneity");
  } else if (freeTimePattern === "stayhome") {
    spontaneity -= 10;
  }
  spontaneity += (wildness - 50) * 0.3;

  // --- Social energy -------------------------------------------------------
  // Deliberately NOT derived. It used to be guessed from the free-Saturday answer, who
  // joins and the "conversation" option, i.e. a shy or sociable label inferred from
  // behaviour and choices. The discovery brief rules that out: how someone likes to take
  // part is only ever what they say explicitly (IntakeAnswers.socialFormats), and it is
  // passed to the idea generator as that stated preference, not as a trait score. The
  // field stays at the neutral 50 so stored data and the admin export keep their shape.
  const socialEnergy = 50;

  // --- Need for structure ---------------------------------------------------
  let needForStructure = 50;
  needForStructure += (50 - wildness) * 0.4;
  if (freeTimePattern === "familiar") {
    needForStructure += 20;
    note("freeTimePattern=familiar → +20 needForStructure");
  } else if (freeTimePattern === "stayhome") {
    needForStructure += 10;
  } else if (freeTimePattern === "search") {
    needForStructure -= 10;
  } else if (freeTimePattern === "spontaneous") {
    needForStructure -= 20;
    note("freeTimePattern=spontaneous → -20 needForStructure");
  }
  if (effort === "committed") {
    needForStructure += 10;
  } else if (effort === "minimal") {
    needForStructure -= 5;
  }

  // --- Challenge level (separate axis, see doc comment above) --------------
  const challengeLevel = wildness;

  return {
    dimensions: {
      curiosity: Math.round(clamp(curiosity)),
      spontaneity: Math.round(clamp(spontaneity)),
      socialEnergy,
      needForStructure: Math.round(clamp(needForStructure)),
    },
    challengeLevel: Math.round(clamp(challengeLevel)),
    signals,
  };
}
