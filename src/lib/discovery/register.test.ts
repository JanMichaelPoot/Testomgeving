import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import { ASSOCIATIONS } from "@/lib/discovery/associations";
import {
  REGISTERS,
  REGISTER_TABLE,
  countRegisters,
  deriveRegister,
  familyOf,
  poolShortfall,
  registerOfActivity,
  registerOfCard,
  registerShares,
  validateRegisters,
} from "@/lib/discovery/register";

const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");
const familyIds = [...new Set(ASSOCIATIONS.map((c) => familyOf(c)))];

describe("style register: the table", () => {
  it("covers every activity and every card family, and nothing else", () => {
    const { errors } = validateRegisters({ activities: ALL_ACTIVITIES, families: familyIds });
    expect(errors).toEqual([]);
  });

  it("fails on an item nobody classified, an unknown register, and a line for something that does not exist", () => {
    const table = { activities: { ...REGISTER_TABLE.activities }, families: { ...REGISTER_TABLE.families } };
    const first = live[0].id;
    delete table.activities[first];
    table.activities[live[1].id] = "sporty" as never;
    table.activities["no-such-activity"] = "nature";
    delete table.families[familyIds[0]];
    const { errors } = validateRegisters({ activities: ALL_ACTIVITIES, families: familyIds, table });
    expect(errors.some((e) => e.includes(`"${first}"`) && e.includes("no register"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown register"))).toBe(true);
    expect(errors.some((e) => e.includes("no-such-activity"))).toBe(true);
    expect(errors.some((e) => e.includes(familyIds[0]))).toBe(true);
  });

  it("gives all variants of a family the same register", () => {
    const seen = new Map<string, string>();
    for (const c of ASSOCIATIONS) {
      const r = registerOfCard(c);
      expect(seen.get(familyOf(c)) ?? r, c.id).toBe(r);
      seen.set(familyOf(c), r);
    }
  });

  it("never exposes a register to the visitor: no dictionary or component text mentions it", () => {
    // The labels exist for reports and the admin only. A visitor-facing file must not import them.
    const root = path.join(process.cwd(), "src");
    const offenders: string[] = [];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    for (const f of walk(path.join(root, "components")).concat(walk(path.join(root, "app")))) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      if (readFileSync(f, "utf8").includes("REGISTER_LABELS")) offenders.push(path.relative(root, f));
    }
    expect(offenders).toEqual([]);
  });
});

describe("style register: reading and counting", () => {
  it("falls back to the tags for an item that is not in the table, deterministically", () => {
    expect(registerOfActivity({ id: "not-in-table", tags: ["precision", "technique"] })).toBe("technical");
    expect(registerOfActivity({ id: "not-in-table", tags: ["performance", "color"] })).toBe("expressive");
    expect(registerOfActivity({ id: "not-in-table", tags: ["caring", "food"] })).toBe("nurturing");
    expect(registerOfActivity({ id: "not-in-table", tags: ["nature", "stillness"] })).toBe("nature");
    // A tie, and no known tag at all: the same answer every time.
    expect(deriveRegister(["precision", "nature"])).toBe(deriveRegister(["nature", "precision"]));
    expect(deriveRegister([])).toBe("technical");
  });

  it("counts and divides a list of registers", () => {
    const counts = countRegisters(["nature", "nature", "technical", "expressive"]);
    expect(counts).toEqual({ expressive: 1, nurturing: 0, technical: 1, nature: 2 });
    const shares = registerShares(["nature", "nature", "technical", "expressive"]);
    expect(shares.nature).toBe(0.5);
    expect(Object.values(registerShares([])).every((v) => v === 0)).toBe(true);
  });
});

describe("style register: the pool is wide enough for the plan", () => {
  const actCounts = countRegisters(live.map((a) => registerOfActivity(a)));
  const famCounts = countRegisters(familyIds.map((f) => REGISTER_TABLE.families[f]));

  it("has every register well represented, so no register is a token gesture", () => {
    for (const r of REGISTERS) {
      expect(actCounts[r] / live.length, `activities ${r}`).toBeGreaterThan(0.15);
      expect(famCounts[r] / familyIds.length, `families ${r}`).toBeGreaterThan(0.15);
    }
  });

  it("can fill three balanced batches of 18 (page 1 and its two refreshes) with at least 3 of each register", () => {
    expect(poolShortfall(famCounts, { batchSize: 18, batches: 3, minPerRegister: 3 })).toEqual({});
    expect(poolShortfall(actCounts, { batchSize: 18, batches: 3, minPerRegister: 3 })).toEqual({});
  });

  it("every round (places, moments, senses) offers every register, so a mixed batch can be drawn from any round", () => {
    for (const round of ["places", "moments", "senses"] as const) {
      const regs = new Set(ASSOCIATIONS.filter((c) => c.round === round).map((c) => registerOfCard(c)));
      for (const r of REGISTERS) expect(regs.has(r), `${round} ${r}`).toBe(true);
    }
  });

  it("reports a shortfall when a pool is too small or lopsided", () => {
    const thin = { expressive: 2, nurturing: 30, technical: 30, nature: 30 };
    expect(poolShortfall(thin, { batchSize: 18, batches: 3, minPerRegister: 3 })).toEqual({ expressive: 7 });
    const tiny = { expressive: 10, nurturing: 10, technical: 10, nature: 10 };
    expect(Object.keys(poolShortfall(tiny, { batchSize: 18, batches: 3, minPerRegister: 3 })).length).toBeGreaterThan(0);
  });

  it("keeps the registers apart on the energy axis, which a register balance therefore also balances", () => {
    const avg = (r: string, axis: "energy" | "setting") => {
      const cards = ASSOCIATIONS.filter((c) => registerOfCard(c) === r);
      return cards.reduce((s, c) => s + c.axes[axis], 0) / cards.length;
    };
    expect(avg("technical", "energy")).toBeGreaterThan(avg("nurturing", "energy"));
    expect(avg("nature", "setting")).toBeGreaterThan(avg("expressive", "setting"));
  });
});
