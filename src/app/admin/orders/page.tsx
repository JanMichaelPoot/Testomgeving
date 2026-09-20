import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logoutAdmin } from "../actions";

export const metadata: Metadata = {
  title: "Orders — WINDOW admin",
  robots: { index: false, follow: false },
};

// Model C digital sale compliance (section 33, Fase 3, deliverable: "Admin:
// order-detail met consentstatus"). This list is the entry point — each row
// links to /admin/orders/[id] for the full, order-specific consent record
// (versions, timestamps, IP/UA, text hash) a legal/support request would
// actually need. Deliberately reuses the existing single-shared-password
// admin gate (see /admin) rather than building any new auth — this is the
// same one-owner audit panel, just a second view onto it.
const MAX_ROWS = 200;

type OrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  status: string;
  amount: number;
  currency: string;
  session_id: string;
};

export default async function AdminOrdersPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const supabase = createServiceRoleClient();

  const { data: orders, error } = await supabase
    .from("payments")
    .select("id, order_number, created_at, status, amount, currency, session_id")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const orderIds = (orders ?? []).map((o) => o.id);

  const [{ data: plans }, { data: termsRows }, { data: consentRows }] = await Promise.all([
    orderIds.length
      ? supabase
          .from("window_plans")
          .select("payment_id, status, generated_at, email_sent_at")
          .in("payment_id", orderIds)
      : Promise.resolve({ data: [] as never[] }),
    orderIds.length
      ? supabase.from("terms_acceptance").select("order_id, terms_version").in("order_id", orderIds)
      : Promise.resolve({ data: [] as never[] }),
    orderIds.length
      ? supabase
          .from("digital_delivery_consent")
          .select("order_id, consent_version, withdrawal_acknowledged")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const planByPayment = new Map((plans ?? []).map((p) => [p.payment_id, p]));
  const termsByOrder = new Map((termsRows ?? []).map((t) => [t.order_id, t]));
  const consentByOrder = new Map((consentRows ?? []).map((c) => [c.order_id, c]));

  return (
    <div className="min-h-full bg-cream px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              WINDOW — admin
            </p>
            <h1 className="mt-1 font-serif text-2xl text-ink">Orders</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink/60">
              Elke Stripe-checkout-poging, met betaalstatus, PDF-status en
              vastgelegde toestemming. Klik op een order voor het volledige
              consentbewijs (versie, tijdstip, IP/user-agent, teksthash).
              {orders && orders.length === MAX_ROWS &&
                ` Toont de meest recente ${MAX_ROWS} orders.`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm font-medium text-accent-dark hover:underline">
              Logboek
            </Link>
            <form action={logoutAdmin}>
              <button type="submit" className="text-sm font-medium text-ink/50 hover:text-ink">
                Uitloggen
              </button>
            </form>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-sm text-red-600">Kon de orders niet laden: {error.message}</p>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border border-ink/10 bg-paper">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-widest text-ink/40">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Betaling</th>
                <th className="px-4 py-3 font-medium">Bedrag</th>
                <th className="px-4 py-3 font-medium">PDF</th>
                <th className="px-4 py-3 font-medium">Voorwaarden</th>
                <th className="px-4 py-3 font-medium">Digitale levering</th>
                <th className="px-4 py-3 font-medium">Herroeping erkend</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {((orders ?? []) as OrderRow[]).map((order) => {
                const plan = planByPayment.get(order.id);
                const terms = termsByOrder.get(order.id);
                const consent = consentByOrder.get(order.id);
                return (
                  <tr key={order.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-accent-dark hover:underline"
                      >
                        {order.order_number ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {new Date(order.created_at).toLocaleString("nl-NL")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={order.status} />
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {(order.amount / 100).toFixed(2)} {order.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{plan?.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      <YesNo value={Boolean(terms)} detail={terms?.terms_version} />
                    </td>
                    <td className="px-4 py-3">
                      <YesNo value={Boolean(consent)} detail={consent?.consent_version} />
                    </td>
                    <td className="px-4 py-3">
                      <YesNo value={Boolean(consent?.withdrawal_acknowledged)} />
                    </td>
                    <td className="px-4 py-3 text-ink/70">{plan?.email_sent_at ? "verstuurd" : "—"}</td>
                  </tr>
                );
              })}
              {orders && orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-ink/40">
                    Nog geen orders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const color =
    value === "succeeded"
      ? "bg-green-100 text-green-800"
      : value === "failed"
        ? "bg-red-100 text-red-700"
        : "bg-ink/10 text-ink/60";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}

function YesNo({ value, detail }: { value: boolean; detail?: string }) {
  return (
    <span className={value ? "text-green-700" : "text-red-600"}>
      {value ? "✓" : "✗"}
      {value && detail ? ` (${detail})` : ""}
    </span>
  );
}
