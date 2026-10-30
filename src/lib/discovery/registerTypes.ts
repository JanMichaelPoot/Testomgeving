// Client-safe pieces of the style register: the register names and the counting helpers. No JSON import, so the
// browser can use them (the wizard balances the image pages with them) without carrying the whole register table.
// See register.ts for what a register is and for the table itself.

export const REGISTERS = ["expressive", "nurturing", "technical", "nature"] as const;
export type Register = (typeof REGISTERS)[number];

export type RegisterCounts = Record<Register, number>;

export function emptyCounts(): RegisterCounts {
  return { expressive: 0, nurturing: 0, technical: 0, nature: 0 };
}

export function countRegisters(registers: readonly Register[]): RegisterCounts {
  const counts = emptyCounts();
  for (const r of registers) counts[r] += 1;
  return counts;
}

/** Each register's share of the total (0..1; all zero for an empty list). */
export function registerShares(registers: readonly Register[]): RegisterCounts {
  const counts = countRegisters(registers);
  const total = registers.length;
  return Object.fromEntries(REGISTERS.map((r) => [r, total ? counts[r] / total : 0])) as RegisterCounts;
}

/**
 * Can a pool fill `batches` separate batches of `batchSize` items, each with at least `minPerRegister` of every
 * register and no item shown twice? Returns what is short per register (empty when it can). This is the balance
 * test behind the planned balanced sampler: before sampling is built it already tells whether the pool is wide
 * enough for the plan (18 per page, three refreshes).
 */
export function poolShortfall(
  poolCounts: RegisterCounts,
  opts: { batchSize: number; batches: number; minPerRegister: number },
): Partial<RegisterCounts> {
  const { batchSize, batches, minPerRegister } = opts;
  const out: Partial<RegisterCounts> = {};
  for (const r of REGISTERS) {
    const need = minPerRegister * batches;
    if (poolCounts[r] < need) out[r] = need - poolCounts[r];
  }
  // The free places of a batch must be fillable too: all batches together need batchSize * batches distinct items.
  const total = REGISTERS.reduce((s, r) => s + poolCounts[r], 0);
  if (total < batchSize * batches) out.nature = Math.max(out.nature ?? 0, batchSize * batches - total);
  return out;
}

