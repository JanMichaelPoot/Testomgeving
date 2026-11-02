"use client";

// A toggle switch. The visible track stays 44x24 but the button around it is 44px tall and 56px wide (the same
// minimum as every other control on a phone); pair it with a <label htmlFor={id}> so the text beside it switches it too.
export function Switch({
  id,
  checked,
  onChange,
  labelledBy,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Id of the element that names the switch (usually the <label> next to it). */
  labelledBy?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className="group -my-2.5 flex h-11 w-14 shrink-0 items-center justify-center rounded-full outline-none"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-gold group-focus-visible:ring-offset-2 ${
          checked ? "bg-accent" : "bg-ink/15"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
