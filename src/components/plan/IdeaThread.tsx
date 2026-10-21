import Image from "next/image";
import type { IdeaThreadData } from "@/lib/ideaThread";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

// The thread of one door: jouw beeld -> wat we erin lazen -> deze deur -> de echte plek, each
// link with a small line under it that says where it comes from. A link that is not in the
// data is left out; without a thread there is nothing at all. On a phone the links stand
// under each other, on a computer next to each other. Not used on /shared/[id]: it shows
// the person's own choices.

export function IdeaThread({
  thread,
  copy,
  className,
}: {
  thread: IdeaThreadData | null | undefined;
  copy: Dictionary["venster"]["thread"];
  className?: string;
}) {
  if (!thread) return null;

  const links: { key: string; text: string; caption: string; image?: { src: string; label: string } }[] = [];
  if (thread.image) links.push({ key: "image", text: thread.image.label, caption: copy.imageCaption, image: thread.image });
  if (thread.tags.length > 0) links.push({ key: "tags", text: thread.tags.join(" · "), caption: copy.tagsCaption });
  links.push({ key: "door", text: thread.title, caption: copy.doorCaption });
  if (thread.place) links.push({ key: "place", text: thread.place, caption: copy.placeCaption });

  return (
    <section aria-label={copy.heading} className={cn("rounded-md bg-surface-active p-3.5 sm:p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{copy.heading}</p>
      <ol className="mt-3 flex flex-col md:flex-row">
        {links.map((link, i) => {
          const last = i === links.length - 1;
          return (
            <li key={link.key} className={cn("relative flex gap-3 md:flex-1 md:flex-col md:gap-2 md:pr-4", !last && "pb-4 md:pb-0")}>
              {!last && <span aria-hidden="true" className="absolute bottom-0 left-[21px] top-11 w-px bg-ink/20 md:hidden" />}
              {!last && <span aria-hidden="true" className="absolute left-12 right-2 top-[21px] hidden h-px bg-ink/20 md:block" />}
              {link.image ? (
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
                  <Image src={link.image.src} alt={link.image.label} fill sizes="44px" className="object-cover" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-paper text-sm font-semibold text-accent-dark"
                >
                  {i + 1}
                </span>
              )}
              <span className="min-w-0 self-center md:self-start">
                <span className="block text-sm font-semibold leading-snug text-accent-dark">{link.text}</span>
                <span className="mt-0.5 block text-xs text-ink/55">{link.caption}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
