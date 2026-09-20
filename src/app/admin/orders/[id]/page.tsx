import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Orderdetail — WINDOW admin",
  robots: { index: false, follow: false },
};

// The actual "kan aantonen" (demonstrable) deliverable from the compliance
// brief: everything needed to reconstruct, for one specific order, exactly
// what the customer agreed to and when — the versioned/hashed
// terms_acceptance + digital_delivery_consent rows written in
// checkout/actions.ts, plus the resulting window_plans row (generation,
// e-mail delivery, PDF template version). Read-only — this page never
// writes anything; it's a lookup tool for a legal/support question, not an
// editor.
export default async function AdminOrderDetailPage(props: PageProps<"/admin/orders/[id]">) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { id } = await props.params;
  const supabase = createServiceRoleClient();

  const { data: order } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const [{ data: plan }, { data: terms }, { data: consent }, { data: product }] = await Promise.all([
    supabase.from("window_plans").select("*").eq("payment_id", id).maybeSingle(),
    supabase.from("terms_acceptance").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("digital_delivery_consent").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("products").select("name").eq("id", order.product_id).maybeSingle(),
  ]);

  return (
    <div className="min-h-full bg-cream px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/orders" className="text-sm font-medium text-accent-dark hover:underline">
          ← Orders
        </Link>

        <div className="mt-4 border-b border-ink/10 pb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
            Order {order.order_number ?? order.id}
          </p>
          <h1 className="mt-1 font-serif text-2xl text-ink">
            {product?.name ?? order.product_id}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {new Date(order.created_at).toLocaleString("nl-NL")} · sessie {order.session_id}
          </p>
        </div>

        <Section title="Betaling">
          <Field label="Status" value={order.status} />
          <Field label="Bedrag" value={`${(order.amount / 100).toFixed(2)} ${order.currency.toUpperCase()}`} />
          <Field label="Stripe checkout session" value={order.stripe_payment_id} mono />
          <Field
            label="Herroepingsrecht-waiver (legacy veld)"
            value={order.withdrawal_waiver_confirmed_at ?? "—"}
          />
        </Section>

        <Section title="Idea Book / PDF">
          {plan ? (
            <>
              <Field label="Status" value={plan.status} />
              <Field label="Gegenereerd op" value={plan.generated_at ?? "—"} />
              <Field label="PDF-versie" value={String(plan.pdf_version)} />
              <Field label="E-mail verstuurd op" value={plan.email_sent_at ?? "nog niet verstuurd"} />
              <Field label="Ontvanger" value={plan.recipient_email ?? "—"} />
            </>
          ) : (
            <p className="text-sm text-ink/50">Nog geen Idea Book gegenereerd voor deze order.</p>
          )}
        </Section>

        <Section title="Algemene voorwaarden">
          {terms ? (
            <>
              <Field label="Geaccepteerd" value={terms.accepted ? "Ja" : "Nee"} />
              <Field label="Versie" value={terms.terms_version} />
              <Field label="Tijdstip" value={terms.accepted_at} />
              <Field label="Teksthash (sha-256)" value={terms.consent_text_hash} mono />
            </>
          ) : (
            <p className="text-sm text-red-600">
              Geen terms_acceptance-record gevonden voor deze order — dit zou niet
              mogen voorkomen, aangezien checkout/actions.ts dit altijd vóór de
              Stripe-redirect wegschrijft.
            </p>
          )}
        </Section>

        <Section title="Digitale levering &amp; herroepingsrecht">
          {consent ? (
            <>
              <Field label="Toestemming directe levering" value={consent.consent ? "Ja" : "Nee"} />
              <Field label="Versie (levering)" value={consent.consent_version} />
              <Field label="Tijdstip (levering)" value={consent.consent_timestamp} />
              <Field
                label="Herroepingsrecht erkend"
                value={consent.withdrawal_acknowledged ? "Ja" : "Nee"}
              />
              <Field label="Versie (herroeping)" value={consent.withdrawal_acknowledged_version} />
              <Field label="Tijdstip (herroeping)" value={consent.withdrawal_acknowledged_timestamp} />
              <Field label="Teksthash (sha-256)" value={consent.consent_text_hash} mono />
              <Field label="IP-adres" value={consent.ip_address ?? "—"} mono />
              <Field label="User-agent" value={consent.user_agent ?? "—"} mono />
            </>
          ) : (
            <p className="text-sm text-red-600">
              Geen digital_delivery_consent-record gevonden voor deze order.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-ink/10 bg-paper p-5">
      <h2 className="text-xs font-medium uppercase tracking-widest text-accent-dark">{title}</h2>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
      <dt className="text-ink/50">{label}</dt>
      <dd className={`text-right text-ink ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</dd>
    </div>
  );
}
