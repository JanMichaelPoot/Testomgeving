import { mergeSeen } from "@/lib/discovery/associationSampling";

// "Which images did this browser see before", so another visit shows other images. Stays in
// this browser (localStorage), is never sent anywhere and holds nothing but card ids. If
// storage is unavailable the visitor simply gets a fresh random pick every time.

const KEY = "window-venster-seen-v1";

export function loadSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function recordSeen(ids: readonly string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mergeSeen(loadSeen(), ids)));
  } catch {
    // Storage unavailable or full: variation still works, it just cannot avoid repeats.
  }
}
