import { imageDisclaimer } from "@/lib/copy/disclaimers";
import { cn } from "@/lib/utils";

// The general text about the pictures, at the foot of every screen that shows a book (build brief 5a). Each picture keeps its own caption too.
export function ImageDisclaimer({ locale, className }: { locale: string; className?: string }) {
  return (
    <p data-testid="image-disclaimer" className={cn("text-xs leading-relaxed text-ink/65", className)}>
      {imageDisclaimer(locale).long}
    </p>
  );
}
