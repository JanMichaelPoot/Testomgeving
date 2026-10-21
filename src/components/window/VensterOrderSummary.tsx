import Link from "next/link";
import { WindowFrame } from "@/components/window/WindowFrame";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { DOMAINS } from "@/lib/discovery/library";
import { buildSill, buildVensterPanes } from "@/lib/vensterPanes";
import { VENSTER_EDIT_PAGE } from "@/lib/vensterPages";
import type { StoredIntake } from "@/app/intake/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Left column of the checkout for the image intake ("Het venster", fase 5): the full window
// as the order itself. Each pane links to the step that filled it, so "wijzigen" is a tap
// on the picture; the text answers have their own two links. Layout only: the payment panel
// next to it (CheckoutPanel, consent, Stripe) is unchanged.

const edit = (page: number) => `/intake?edit=1&page=${page}`;

export function VensterOrderSummary({
  intake,
  dict,
  price,
  locale,
}: {
  intake: StoredIntake;
  dict: Dictionary;
  price: string;
  locale: "nl" | "en";
}) {
  const v = dict.venster;
  const gift = intake.purpose === "gift";
  const name = (intake.recipientName ?? "").trim() || v.recipientFallback;
  const panes = buildVensterPanes(
    intake,
    {
      cards: buildAssociationLibrary(locale).cards,
      domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })),
    },
    v,
    {
      hrefs: {
        worlds: edit(VENSTER_EDIT_PAGE.worlds),
        places: edit(VENSTER_EDIT_PAGE.places),
        moments: edit(VENSTER_EDIT_PAGE.moments),
        senses: edit(VENSTER_EDIT_PAGE.senses),
      },
    },
  );
  const sill = buildSill(intake, dict.intake, v);

  return (
    <div>
      <div className="mx-auto w-56 sm:w-64">
        <WindowFrame panes={panes} size="hero" sill={sill || undefined} title={v.nav.windowTitle} />
      </div>
      <h1 className="mt-8 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        {(gift ? v.checkout.headingGift : v.checkout.heading).replaceAll("{name}", name)}
      </h1>
      <div className="mt-5 flex items-baseline gap-2 rounded-lg bg-surface-active px-4 py-3">
        <span className="font-serif text-3xl font-semibold text-ink">{price}</span>
        <span className="text-xs text-ink/50">{dict.checkout.priceCaption}</span>
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {v.checkout.whatYouGet.map((line) => (
          <li key={line} className="flex items-start gap-3 text-sm leading-relaxed text-ink/75">
            <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-light text-accent-dark">
              <svg width="9" height="9" viewBox="0 0 12 10" fill="none">
                <path d="M1 5l3.5 4L11 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-ink/50">{dict.checkout.choicesHint}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href={edit(VENSTER_EDIT_PAGE.places)} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          {v.checkout.editImages}
        </Link>
        <Link href={edit(VENSTER_EDIT_PAGE.room)} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          {v.checkout.editRoom}
        </Link>
        <Link href={edit(VENSTER_EDIT_PAGE.who)} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          {v.checkout.editWho}
        </Link>
        <Link href={edit(VENSTER_EDIT_PAGE.profile)} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          {v.checkout.editProfile}
        </Link>
      </div>
    </div>
  );
}
