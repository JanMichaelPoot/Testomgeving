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
   * WANT TO GO" in het master-prompt): afgeleid van de practicalToWild-dial
   * plus de expliciete challengeMe-toggle, niet van karakter an sich. Iemand
   * kan laag op de dial zitten maar toch bewust "daag me uit" aanvinken —
   * dat is zelf ook een signaal, geen tegenstrijdigheid.
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
  const company = answers.company || "";
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
  const breadthDelta = clamp((solutionTypes.length - 2) * 6, -12, 24);
  if (breadthDelta !== 0) {
    curiosity += breadthDelta;
    note(`solutionTypes breadth (${solutionTypes.length}) → ${breadthDelta > 0 ? "+" : ""}${breadthDelta} curiosity`);
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
  if (answers.challengeMe) {
    spontaneity += 10;
    note("challengeMe=true → +10 spontaneity");
  }
  spontaneity += (wildness - 50) * 0.3;

  // --- Social energy -------------------------------------------------------
  let socialEnergy = 50;
  if (company === "alone") {
    socialEnergy -= 25;
    note("company=alone → -25 socialEnergy");
  } else if (company === "friends") {
    socialEnergy += 20;
    note("company=friends → +20 socialEnergy");
  } else if (company === "family") {
    socialEnergy += 10;
  } else if (company === "colleagues") {
    socialEnergy += 5;
  }
  if (freeTimePattern === "ask") {
    socialEnergy += 15;
    note("freeTimePattern=ask → +15 socialEnergy");
  } else if (freeTimePattern === "stayhome") {
    socialEnergy -= 15;
    note("freeTimePattern=stayhome → -15 socialEnergy");
  } else if (freeTimePattern === "familiar") {
    socialEnergy -= 5;
  } else if (freeTimePattern === "spontaneous") {
    socialEnergy += 5;
  }
  if (solutionTypes.includes("conversation")) {
    socialEnergy += 10;
    note("solutionTypes includes conversation → +10 socialEnergy");
  }

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
  if (answers.challengeMe) {
    needForStructure -= 10;
    note("challengeMe=true → -10 needForStructure");
  }

  // --- Challenge level (separate axis, see doc comment above) --------------
  let challengeLevel = wildness;
  if (answers.challengeMe) {
    challengeLevel += 20;
    note("challengeMe=true → +20 challengeLevel");
  }

  return {
    dimensions: {
      curiosity: Math.round(clamp(curiosity)),
      spontaneity: Math.round(clamp(spontaneity)),
      socialEnergy: Math.round(clamp(socialEnergy)),
      needForStructure: Math.round(clamp(needForStructure)),
    },
    challengeLevel: Math.round(clamp(challengeLevel)),
    signals,
  };
}
