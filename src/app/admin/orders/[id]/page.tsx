import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { explainEmailError } from "@/lib/emailErrors";
import { describeBookCost } from "@/lib/adminStats";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DISCOUNT_CENTS, MAX_COMPENSATIONS_PER_ORDER } from "@/lib/discountCode";
import { formatPrice } from "@/lib/pricing";
import { sendCompensationAction } from "./actions";

/** What a compensation code made today is worth, as shown to the owner. */
const CODE_VALUE = formatPrice("nl", DISCOUNT_CENTS);

export const metadata: Metadata = {
  title: "Orderdetail — WindowInto admin",
  robots: { index: false, follow: false },
};

// The actual "kan aantonen" (demonstrable) deliverable from the compliance
// brief: everything needed to reconstruct, for one specific order, exactly
// what the customer agreed to and when — the versioned/hashed
// terms_acceptance + digital_delivery_consent rows written in
// checkout/actions.ts, plus the resulting window_plans row (generation,
// e-mail delivery, PDF template version). Read-only — this page never
// writes anything (only the compensation form below sends a code, through its own action); it's a lookup tool for a legal/support question, not an
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

  // The one-time discount codes of this order: the one it earned by ordering and any compensation codes (Step 235). The first query works without migration 0028; the second
  // (kind and note) only with it.
  const searchParams = await props.searchParams;
  const status = typeof searchParams.compensation === "string" ? searchParams.compensation : null;
  // The table of the discount codes is not in the typed database description (it is read and written through src/lib/discountCode.ts too): an untyped view of the same client.
  const loose = supabase as unknown as SupabaseClient;
  const { data: codeRows } = await loose
    .from("discount_codes")
    .select("code, created_at, expires_at, redeemed_at")
    .eq("issued_for_payment_id", id)
    .order("created_at", { ascending: true });
  const { data: kindRows, error: kindError } = await loose.from("discount_codes").select("code, kind, reason").eq("issued_for_payment_id", id);
  const kindOf = new Map<string, { kind: string; reason: string | null }>((kindRows ?? []).map((r: { code: string; kind: string; reason: string | null }) => [r.code, r]));
  const codes = ((codeRows ?? []) as { code: string; created_at: string; expires_at: string; redeemed_at: string | null }[]).map((r, i) => ({ ...r, kind: kindOf.get(r.code)?.kind ?? (i === 0 ? "order" : "compensation"), reason: kindOf.get(r.code)?.reason ?? null }));
  const compensations = codes.filter((c) => c.kind === "compensation");

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
          <p className="mt-1 text-sm text-ink/70">
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
              {plan.progress_meta?.cost && <Field label="Kosten van dit boek" value={describeBookCost(plan.progress_meta.cost)} />}
              {plan.progress_meta?.email_error && <Field label="E-mailfout" value={plan.progress_meta.email_error} />}
              {explainEmailError(plan.progress_meta?.email_error) && (
                <Field label="Oorzaak en oplossing" value={`${explainEmailError(plan.progress_meta?.email_error)!.cause} ${explainEmailError(plan.progress_meta?.email_error)!.fix}`} />
              )}
            </>
          ) : (
            <p className="text-sm text-ink/70">Nog geen Idea Book gegenereerd voor deze order.</p>
          )}
        </Section>

        <Section title="Kortingscodes en compensatie">
          {status && COMPENSATION_STATUS[status] && (
            <p
              role="status"
              className={`rounded-md border px-3 py-2 text-sm ${status === "sent" ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-800"}`}
            >
              {COMPENSATION_STATUS[status].replace("{email}", plan?.recipient_email ?? "de koper")}
            </p>
          )}
          {codes.length === 0 ? (
            <p className="text-sm text-ink/70">Er zijn nog geen kortingscodes voor deze bestelling.</p>
          ) : (
            codes.map((c) => (
              <div key={c.code} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
                <dt className="text-ink/70">
                  <span className="font-mono text-xs text-ink">{c.code}</span> · {KIND_LABEL[c.kind] ?? "bij de bestelling"}
                  {c.reason ? ` · ${c.reason}` : ""}
                </dt>
                <dd className="text-right text-ink">
                  {c.redeemed_at ? `gebruikt ${new Date(c.redeemed_at).toLocaleDateString("nl-NL")}` : `geldig tot ${new Date(c.expires_at).toLocaleDateString("nl-NL")}`}
                </dd>
              </div>
            ))
          )}
          {plan && order.status === "succeeded" ? (
            <form action={sendCompensationAction} className="mt-4 space-y-3 border-t border-ink/10 pt-4">
              <input type="hidden" name="orderId" value={order.id} />
              <p className="text-sm text-ink/80">
                Een plek in het boek klopte niet? Maak een extra kortingscode van {CODE_VALUE} en mail die naar{" "}
                <strong>{plan.recipient_email ?? "(geen e-mailadres bij deze bestelling)"}</strong> ({plan.language === "en" ? "Engels" : "Nederlands"}). Antwoorden op die mail gaan naar info@vantagelabs.nl.
              </p>
              <label className="block text-sm">
                <span className="text-ink/70">Reden (alleen voor jezelf, niet in de mail)</span>
                <input name="reason" maxLength={300} placeholder="Bijvoorbeeld: Pottenbakkerij X in Laren bleek gesloten" className="mt-1 w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" className="mt-0.5" />
                <span>Ik wil deze mail nu naar de koper sturen.</span>
              </label>
              <button type="submit" disabled={!plan.recipient_email} className="rounded-md bg-accent-dark px-4 py-2 text-sm font-semibold text-paper hover:bg-ink disabled:opacity-50">
                Mail extra kortingscode van {CODE_VALUE}
              </button>
              <p className="text-xs text-ink/60">
                Hoogstens {MAX_COMPENSATIONS_PER_ORDER} compensatiecodes per bestelling{compensations.length > 0 ? ` (al ${compensations.length} verstuurd)` : ""}.
                {kindError ? " Let op: migratie 0028_discount_compensation.sql is nog niet gedraaid; zonder die migratie lukt het versturen niet." : ""}
              </p>
            </form>
          ) : (
            <p className="mt-3 text-sm text-ink/70">Een compensatiecode kan alleen bij een betaalde bestelling met een boek.</p>
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

// What each kind of code is, in words for the owner: the one the order earned, a compensation code (Step 235), one for a friend (Step 238), the reward once a friend used one (Step 239).
const KIND_LABEL: Record<string, string> = { order: "bij de bestelling", compensation: "compensatie", friend: "voor een vriend", reward: "beloning (een vriend bestelde)" };

const COMPENSATION_STATUS: Record<string, string> = {
  sent: `De mail met een extra kortingscode van ${CODE_VALUE} is verstuurd naar {email}.`,
  mailfailed: "De code is gemaakt, maar de mail kon niet worden verstuurd. De code staat hieronder: stuur hem zelf naar de koper.",
  confirm: "Vink eerst aan dat je de mail echt wilt sturen. Er is niets verstuurd.",
  noemail: "Bij deze bestelling is geen e-mailadres bekend. Er is niets verstuurd.",
  notpaid: "Deze bestelling is niet betaald. Er is niets verstuurd.",
  max: "Er zijn al het maximale aantal compensatiecodes voor deze bestelling verstuurd.",
  migration: "Migratie 0028_discount_compensation.sql is nog niet gedraaid in Supabase. Er is niets verstuurd.",
  storage: "Het maken van de code mislukte. Er is niets verstuurd; kijk in de logs.",
};

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
      <dt className="text-ink/70">{label}</dt>
      <dd className={`text-right text-ink ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</dd>
    </div>
  );
}
