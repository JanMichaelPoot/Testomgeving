import fs from "node:fs";
import path from "node:path";
import type { StoredIntake } from "@/app/intake/actions";
import { engineInputFromIntake } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine/types";
import type { SyntheticProfile } from "@/lib/discovery/engine/synthetic";
import { applyImageIntake } from "@/lib/discovery/imageIntake";

// The evaluation profiles (scripts/eval/profiles/*.json): twenty fixed visitors, run through the same
// translation as a real one, with a fixed seed and month so a run never depends on the day it is made.
// Node-only (reads the JSON from disk): used by the tests and by scripts/eval, never by the app.

export interface EvalProfile {
  id: string;
  title: string;
  /** "images": the image intake (derived interests); "cards": the card wizard (activities picked). */
  kind: "images" | "cards";
  note?: string;
  /** A deliberately awkward profile (narrow, contradictory, "surprise me", hard limits we cannot filter). */
  edge?: boolean;
  /** Month 1-12 the visitor is "asking in": seasonal activities depend on it. */
  month: number;
  /** Seed for the derivation and the selection. */
  seed: string;
  /** The answers as the intake stores them; everything that is left out gets the defaults below. */
  stored: Partial<StoredIntake>;
}

export const PROFILE_DIR = path.resolve(process.cwd(), "scripts/eval/profiles");

const DEFAULTS: StoredIntake = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "",
  location: "Utrecht",
  searchDistance: "city",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "25",
  effort: "some",
  solutionTypes: ["activity"],
  mustHaves: "",
  preferences: "",
  company: [],
  personalReflection: "",
  interests: [],
  interestDomains: [],
  socialFormats: [],
  surpriseMe: false,
  locale: "nl",
};

export function loadEvalProfiles(dir: string = PROFILE_DIR): EvalProfile[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as EvalProfile);
}

/** The stored intake of a profile, after the image intake's translation when it is an image profile. */
export function intakeFor(p: EvalProfile): StoredIntake {
  const stored: StoredIntake = { ...DEFAULTS, ...p.stored };
  if (p.kind === "cards") return stored;
  return applyImageIntake({ ...stored, intakeVariant: "associations" }, "nl", `${p.seed}:derive`, p.month);
}

export function engineInputFor(p: EvalProfile): EngineInput {
  return engineInputFromIntake(intakeFor(p), { seed: p.seed, month: p.month });
}

/** The shape the engine's own evaluation (engine/evaluate.ts) works on. */
export function toSyntheticProfile(p: EvalProfile): SyntheticProfile {
  const input = engineInputFor(p);
  return { id: p.id, archetype: input.surpriseMe ? "surprise" : input.interests.length === 0 ? "worlds_only" : "broad", input };
}
