// Fase 2 (Input & Character Engine) — dev-only sanity check, geen
// productiecode. Draait computeCharacterProfile tegen een handvol
// representatieve antwoordcombinaties (voorzichtige thuisblijver,
// nieuwsgierige spontane ontdekker, sociale familieplanner, een schaars/
// vaag ingevuld profiel, en een avontuurlijk-maar-gestructureerd profiel)
// zodat de scoring-regels met het blote oog te beoordelen zijn vóór ze
// ergens anders op vertrouwd wordt (Fase 3's Possibility/Door Engine).
//
// Geen API-keys of database nodig — puur de deterministische functie.
//
//   npx tsx scripts/test-character-profile.ts
import { computeCharacterProfile } from "../src/lib/characterProfile";
import type { IntakeAnswers } from "../src/app/intake/actions";

function profile(overrides: Partial<IntakeAnswers>): IntakeAnswers {
  return {
    situation: "",
    purpose: "self",
    purposeFollowUp: "",
    ageCategory: "35-44",
    location: "",
    searchDistance: "city",
    freeTimePattern: "",
    practicalToWild: "either",
    timeAvailable: "halfday",
    budget: "25",
    effort: "some",
    solutionTypes: [],
    mustHaves: "",
    preferences: "",
    company: [],
    personalReflection: "",
    ...overrides,
  };
}

const CASES: { name: string; answers: IntakeAnswers }[] = [
  {
    name: "Voorzichtige thuisblijver",
    answers: profile({
      freeTimePattern: "stayhome",
      practicalToWild: "grounded",
      company: ["alone"],
      effort: "minimal",
      solutionTypes: ["habit"],
    }),
  },
  {
    name: "Nieuwsgierige spontane ontdekker",
    answers: profile({
      freeTimePattern: "search",
      practicalToWild: "wild",
      company: ["friends"],
      effort: "committed",
      solutionTypes: ["activity", "creative", "conversation"],
      personalReflection: "Ik zou best vaker iets compleet nieuws willen proberen.",
    }),
  },
  {
    name: "Sociale familieplanner",
    answers: profile({
      freeTimePattern: "ask",
      practicalToWild: "practical",
      company: ["family", "friends"],
      effort: "some",
      solutionTypes: ["activity", "recipe"],
    }),
  },
  {
    name: "Schaars/vaag ingevuld profiel",
    answers: profile({}), // alles op neutrale default, zoals iemand die snel doorklikt
  },
  {
    name: "Avontuurlijk maar gestructureerd",
    answers: profile({
      freeTimePattern: "familiar",
      practicalToWild: "unexpected",
      company: ["partner"],
      effort: "committed",
      solutionTypes: ["activity", "creative"],
    }),
  },
];

for (const { name, answers } of CASES) {
  const result = computeCharacterProfile(answers);
  console.log(`\n=== ${name} ===`);
  console.table(result.dimensions);
  console.log(`challengeLevel: ${result.challengeLevel}`);
  if (result.signals.length > 0) {
    console.log("signals:");
    result.signals.forEach((s) => console.log(`  - ${s}`));
  } else {
    console.log("signals: (geen — volledig op neutrale defaults)");
  }
}
