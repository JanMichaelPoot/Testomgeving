// An in-memory store with the same semantics as the table (a code per order, one atomic hold, redeem and release by order, the reward claim of Step 239), for the tests of the rules.
import type { DiscountStore } from "@/lib/discountCode";

interface Row {
  id: string;
  code: string;
  paymentId: string;
  amountCents: number;
  expiresAt: Date;
  reservedUntil: Date | null;
  redeemedAt: Date | null;
  kind?: string;
  rewardedAt?: Date | null;
  mailedAt?: Date | null;
  reason?: string;
}
export function memoryStore(seedPayments: Record<string, string> = {}) {
  const rows: Row[] = [];
  const orderCode = new Map<string, string>(); // stripe session id of an order -> the code row it uses
  const store: DiscountStore = {
    async findByPayment(paymentId) {
      const r = rows.find((x) => x.paymentId === paymentId && (!x.kind || x.kind === "order"));
      return r ? { id: r.id, code: r.code, amountCents: r.amountCents, expiresAt: r.expiresAt } : null;
    },
    async insert({ code, paymentId, amountCents, expiresAt, kind, reason }) {
      // a code is unique; an order has one "order" code, and any number of compensation (0028) and friend (0029) codes
      const isOrder = !kind || kind === "order";
      if (rows.some((x) => x.code === code || (isOrder && x.paymentId === paymentId && (!x.kind || x.kind === "order")))) return "taken";
      const r: Row = { id: `id-${rows.length + 1}`, code, paymentId, amountCents, expiresAt, reservedUntil: null, redeemedAt: null, kind, reason };
      rows.push(r);
      return { id: r.id, code, amountCents, expiresAt };
    },
    async listByPaymentKind(paymentId, kind) {
      return rows.filter((x) => x.paymentId === paymentId && (x.kind ?? "order") === kind).map((r) => ({ id: r.id, code: r.code, amountCents: r.amountCents, expiresAt: r.expiresAt }));
    },
    async codeIdForOrder(session) {
      return orderCode.get(session) ?? null;
    },
    async claimReward(codeId, now) {
      const r = rows.find((x) => x.id === codeId);
      if (!r || r.kind !== "friend" || !r.redeemedAt || r.rewardedAt) return null;
      r.rewardedAt = now;
      return { paymentId: r.paymentId, code: r.code, amountCents: r.amountCents };
    },
    async unclaimReward(codeId) {
      const r = rows.find((x) => x.id === codeId);
      if (r) r.rewardedAt = null;
    },
    async markMailed(codeId, now) {
      const r = rows.find((x) => x.id === codeId);
      if (r) r.mailedAt = now;
    },
    async findByCode(code) {
      const r = rows.find((x) => x.code === code);
      return r ? { id: r.id, code: r.code, amountCents: r.amountCents, expiresAt: r.expiresAt, redeemedAt: r.redeemedAt, reservedUntil: r.reservedUntil } : null;
    },
    async hold(code, now, until) {
      const r = rows.find((x) => x.code === code);
      if (!r || r.redeemedAt || r.expiresAt <= now || (r.reservedUntil && r.reservedUntil > now)) return null;
      r.reservedUntil = until;
      return { id: r.id, amountCents: r.amountCents };
    },
    async releaseForOrder(session) {
      const r = rows.find((x) => x.id === orderCode.get(session));
      if (r && !r.redeemedAt) r.reservedUntil = null;
    },
    async releaseById(id) {
      const r = rows.find((x) => x.id === id);
      if (r && !r.redeemedAt) r.reservedUntil = null;
    },
    async redeemForOrder(session, now) {
      const r = rows.find((x) => x.id === orderCode.get(session));
      if (!r) return false;
      if (!r.redeemedAt) {
        r.redeemedAt = now;
        r.reservedUntil = null;
      }
      return true;
    },
  };
  void seedPayments;
  return { store, rows, orderCode };
}
