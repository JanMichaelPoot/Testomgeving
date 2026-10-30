"use client";

import { useEffect, useRef, useState } from "react";
import { displayPlace } from "@/lib/place";

// A plain text input backed by PDOK city/region suggestions
// (src/app/api/location-suggest/route.ts). Degrades to a normal free-text
// field if the suggestion request is slow, empty, or fails — never blocks
// typing or submission.
export function LocationAutocomplete({
  value,
  onChange,
  placeholder,
  id,
  tidy = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id?: string;
  /** Show "Laren, Noord-Holland" for "Laren, Laren, Noord-Holland" (display only; the value that is
   *  stored and what the suggest route returns stay as they are). Off for the other wizards. */
  tidy?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The value that was not typed in this session (a picked suggestion or a restored answer): it is
  // shown tidied until the person edits it. Anything they type is shown, and stored, as typed.
  const [untyped, setUntyped] = useState<string | null>(value || null);
  const shown = tidy && untyped !== null && value === untyped ? displayPlace(value) : value;
  const label = (text: string) => (tidy ? displayPlace(text) : text);

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
    setUntyped(suggestion);
    onChange(suggestion);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={id ? `${id}-listbox` : undefined}
        value={shown}
        onChange={(e) => {
          setUntyped(null);
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
        className="mt-3 w-full rounded-lg border border-border bg-paper px-4 py-3 text-ink outline-none placeholder:text-ink/70 focus:border-ink"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-paper shadow-md"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion} role="option" aria-selected={suggestion === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(suggestion)}
                className="block w-full px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-active"
              >
                {label(suggestion)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
