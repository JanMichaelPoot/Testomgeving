"use client";

import { useEffect, useRef, useState } from "react";

// A plain text input backed by PDOK city/region suggestions
// (src/app/api/location-suggest/route.ts). Degrades to a normal free-text
// field if the suggestion request is slow, empty, or fails — never blocks
// typing or submission.
export function LocationAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // The length check and the fetch both live inside the timer callback
    // (not the effect body itself) so every state update here happens in
    // response to an external event (the timer firing, the request
    // resolving) rather than synchronously during the effect.
    debounceRef.current = setTimeout(() => {
      const query = value.trim();
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      fetch(`/api/location-suggest?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: { suggestions?: string[] }) => {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        })
        .catch(() => setSuggestions([]));
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function select(suggestion: string) {
    onChange(suggestion);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on a suggestion (which blurs the input first)
          // still registers before the list disappears.
          setTimeout(() => setOpen(false), 120);
        }}
        placeholder={placeholder}
        className="mt-3 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-accent"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-md">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(suggestion)}
                className="block w-full px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-accent/10"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
