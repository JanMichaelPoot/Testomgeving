"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

// A modal wrapper around the native <dialog> element: showModal() gives us
// the focus trap, Esc-to-close, inert background and focus restoration to
// the opening button for free. It only renders `children` while open, so a
// closed dialog costs nothing and stateful children (IdeaFeedback) always
// start from fresh props.
export function IdeaDialog({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = "idea-dialog-title";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Native <dialog> doesn't lock page scroll behind it.
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Fired for Esc as well as for our own dialog.close() — keeps the
      // parent's state in step with whatever closed it.
      onClose={onClose}
      // The inner wrapper covers the whole dialog box, so a click that
      // targets the <dialog> itself can only be a click on the backdrop.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
    >
      {open && (
        <div className="bg-cream p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <span aria-hidden="true" />
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              {closeLabel}
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
