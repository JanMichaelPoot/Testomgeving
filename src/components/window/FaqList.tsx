import Link from "next/link";
import type { FaqItem } from "@/lib/i18n/home";

// The FAQ as native <details>: works without JavaScript and is keyboard and screen reader friendly. `price` fills "{price}".
export function FaqList({ items, price }: { items: FaqItem[]; price: string }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-paper">
      {items.map((item) => (
        <details key={item.id} id={item.id} className="group scroll-mt-24 px-5 py-1 sm:px-6">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span aria-hidden="true" className="shrink-0 text-xl leading-none text-accent transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="pb-4 text-[15px] leading-relaxed text-ink/80">
            <p>{item.answer.replaceAll("{price}", price)}</p>
            {item.link && (
              <Link href={item.link.href} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent-dark underline underline-offset-2 hover:text-accent">
                {item.link.label}
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
