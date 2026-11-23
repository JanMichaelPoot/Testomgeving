import { beforeEach, describe, expect, it, vi } from "vitest";

// The admin action that mails a buyer an extra discount code (Step 235): everything is checked again on the server, the address comes from the order and never from the form,
// and whatever happens the answer is a redirect back to the order with a status word.

let admin = true;
vi.mock("@/lib/adminAuth", () => ({ isAdminAuthenticated: vi.fn(async () => admin) }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/siteUrl", () => ({ siteUrl: () => "https://windowinto.test" }));

type Order = { id: string; status: string; order_number: string | null } | null;
type Plan = { recipient_email: string | null; language: string } | null;
let order: Order;
let plan: Plan;
let compensationCount: number | null; // null: the query fails (migration 0028 not run)

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      if (table === "payments") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order }) }) }) };
      if (table === "window_plans") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: plan }) }) }) };
      if (table === "discount_codes") {
        return { select: () => ({ eq: () => ({ eq: async () => (compensationCount === null ? { count: null, error: { message: "column kind does not exist" } } : { count: compensationCount, error: null }) }) }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

const issued: unknown[][] = [];
let issueResult: { ok: true; code: { code: string; amountCents: number; expiresAt: Date } } | { ok: false; error: "storage" | "migration" };
vi.mock("@/lib/discountCode", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/discountCode")>();
  return {
    ...real,
    supabaseStore: () => ({}),
    issueCompensation: vi.fn(async (...args: unknown[]) => {
      issued.push(args);
      return issueResult;
    }),
  };
});

const mails: Record<string, unknown>[] = [];
let mailFails = false;
vi.mock("@/lib/email/compensation", () => ({
  sendCompensationEmail: vi.fn(async (p: Record<string, unknown>) => {
    if (mailFails) throw new Error("resend down");
    mails.push(p);
    return { id: "msg", from: "x" };
  }),
}));

import { sendCompensationAction } from "./actions";

const ID = "6f1c2d3e-0000-4000-8000-000000000001";
const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  f.set("orderId", ID);
  f.set("confirm", "on");
  f.set("reason", "Plek X was gesloten");
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
};
const run = async (f: FormData) => {
  try {
    await sendCompensationAction(f);
    return "no redirect";
  } catch (e) {
    return (e as Error).message;
  }
};

beforeEach(() => {
  admin = true;
  order = { id: ID, status: "succeeded", order_number: "WI-2026-000069" };
  plan = { recipient_email: "buyer@example.com", language: "nl" };
  compensationCount = 0;
  issueResult = { ok: true, code: { code: "WI-ABCD-EFGH", amountCents: 250, expiresAt: new Date("2027-02-21") } };
  issued.length = 0;
  mails.length = 0;
  mailFails = false;
});

describe("sendCompensationAction", () => {
  it("makes a code and mails it to the address of the order, in the language of the book, and says so", async () => {
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=sent`);
    expect(issued).toHaveLength(1);
    expect(issued[0][1]).toBe(ID);
    expect(issued[0][2]).toBe("Plek X was gesloten");
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: "buyer@example.com", locale: "nl", code: "WI-ABCD-EFGH", amountCents: 250, orderNumber: "WI-2026-000069", siteUrl: "https://windowinto.test" });
  });

  it("takes the address from the order, never from the form", async () => {
    await run(form({ to: "attacker@example.com", email: "attacker@example.com", recipient_email: "attacker@example.com" }));
    expect(mails[0].to).toBe("buyer@example.com");
  });

  it("writes in English for an English book", async () => {
    plan = { recipient_email: "buyer@example.com", language: "en" };
    await run(form());
    expect(mails[0].locale).toBe("en");
  });

  it("does nothing without a login", async () => {
    admin = false;
    expect(await run(form())).toBe("REDIRECT:/admin/login");
    expect(issued).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it("does nothing unless the owner ticked the box, or for an order id that is not one", async () => {
    expect(await run(form({ confirm: "" }))).toBe(`REDIRECT:/admin/orders/${ID}?compensation=confirm`);
    const noBox = new FormData();
    noBox.set("orderId", ID);
    expect(await run(noBox)).toBe(`REDIRECT:/admin/orders/${ID}?compensation=confirm`);
    expect(await run(form({ orderId: "../../etc" }))).toBe("REDIRECT:/admin/orders");
    expect(issued).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it("does nothing for an order that is not paid, or that has no address", async () => {
    order = { id: ID, status: "pending", order_number: null };
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=notpaid`);
    order = null;
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=notpaid`);
    order = { id: ID, status: "succeeded", order_number: null };
    plan = { recipient_email: null, language: "nl" };
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=noemail`);
    plan = null;
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=noemail`);
    expect(issued).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it("stops at the limit per order, and says when migration 0028 has not been run", async () => {
    compensationCount = 3;
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=max`);
    compensationCount = null;
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=migration`);
    expect(issued).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it("sends no mail when no code could be made, and says why", async () => {
    issueResult = { ok: false, error: "migration" };
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=migration`);
    issueResult = { ok: false, error: "storage" };
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=storage`);
    expect(mails).toHaveLength(0);
  });

  it("keeps the code and says the mail failed, so the owner can send it by hand", async () => {
    mailFails = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await run(form())).toBe(`REDIRECT:/admin/orders/${ID}?compensation=mailfailed`);
    err.mockRestore();
    expect(issued).toHaveLength(1);
  });
});
