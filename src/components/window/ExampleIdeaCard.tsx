import Image from "next/image";
import { EXAMPLE_IDEA } from "@/lib/exampleIdea";
import { ideaCategoryPhoto } from "@/lib/illustrations";

// A real idea from the example Idea Book, tilted over the hero collage.
// Purely presentational; see lib/exampleIdea.ts for where the copy comes from.
export function ExampleIdeaCard({
  doorLine,
  firstStepLabel,
  className,
}: {
  doorLine: string;
  firstStepLabel: string;
  className?: string;
}) {
  return (
    <article className={className}>
      <div className="relative h-[150px]">
        <Image
          src={ideaCategoryPhoto(EXAMPLE_IDEA.photoCategory, 0)}
          alt=""
          fill
          sizes="340px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{doorLine}</p>
        <p className="font-serif text-[22px] font-medium leading-[1.15] text-ink">
          {EXAMPLE_IDEA.title}
        </p>
        <p className="font-serif text-base italic leading-snug text-ink/75">
          “{EXAMPLE_IDEA.whyItFits}”
        </p>
        <p className="rounded-md bg-accent-dark px-3 py-2.5 text-[13px] leading-snug text-paper">
          {firstStepLabel}: {EXAMPLE_IDEA.firstAction}
        </p>
      </div>
    </article>
  );
}
