// Audit of the real places in finished Idea Books (docs/changelog.md, Step 224): does every idea have at least one real place with a link that works
// and fits the activity (preferably two)? Read-only: it reads the finished books from the database (or a JSON file of books) and opens every link once
// (free, no model call). Nothing is written except the report.
//
//   npx tsx scripts/places-audit.ts --since 2026-11-16 --out docs/eval/2026-11-22-places-before.json
//   npx tsx scripts/places-audit.ts --file scratch/persona-books/P04.json,scratch/persona-books/P10.json     (persona book files instead of the database)
//
// An idea counts as covered when at least one of its places has a link that
//   - answers (HTTP 2xx after redirects), or is protected against robots (403/429/999: the link is probably fine for a person, so it counts as "unverified"), and
//   - does not say the business is closed or parked, and carries the place's name (pageProblem), and
//   - mentions the activity (a word of its name, alias or search terms) somewhere on that page or on the site's front page ("relevant").
// Good = two such places. A place without any link is a real place but not a link.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ALL_ACTIVITIES } from "../src/lib/discovery/library";
import { pageProblem, isPublicWebAddress } from "../src/lib/claude/verifyUrls";
import manual from "../src/lib/discovery/searchHints.manual.json";
import generated from "../src/lib/discovery/searchHints.generated.json";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const since = arg("--since");
const out = arg("--out");
const file = arg("--file");
const limit = Number(arg("--limit") ?? 500);

interface Place {
  name: string;
  city?: string;
  url?: string | null;
  note?: string;
}
interface Idea {
  title?: string;
  activity_id?: string;
  places?: Place[];
}
interface Book {
  id: string;
  created_at?: string;
  ideas: Idea[];
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const byId = new Map(ALL_ACTIVITIES.map((a) => [a.id, a]));
const hints = { ...(generated as Record<string, { terms: string }>), ...(manual as Record<string, { terms: string }>) };

/** Words (4+ characters) that say a page is about this activity: its names in both languages, aliases and the search terms. */
export function activityWords(activityId: string | undefined, title: string | undefined): string[] {
  const a = activityId ? byId.get(activityId) : undefined;
  const raw = [a?.label.nl, a?.label.en, ...(a?.aliases?.nl ?? []), ...(a?.aliases?.en ?? []), hints[activityId ?? ""]?.terms, title].filter(Boolean).join(" ");
  const stop = new Set(["voor", "naar", "beginners", "beginner", "introductie", "workshop", "proefles", "with", "your", "from", "that", "this", "les", "lessen", "cursus"]);
  return [...new Set(fold(raw).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !stop.has(w)))];
}

interface Fetched {
  status: number;
  text: string;
  error?: string;
  finalUrl?: string;
}
const cache = new Map<string, Promise<Fetched>>();
function open(url: string): Promise<Fetched> {
  if (!cache.has(url)) {
    cache.set(
      url,
      (async () => {
        try {
          // A browser-like request: this measures what a person who clicks the link sees, not what a robot may read.
          const res = await fetch(url, {
            redirect: "follow",
            signal: AbortSignal.timeout(12000),
            headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", accept: "text/html,*/*", "accept-language": "nl,en;q=0.8" },
          });
          const text = res.status === 200 ? (await res.text()).slice(0, 250_000) : "";
          return { status: res.status, text, finalUrl: res.url };
        } catch (e) {
          const m = `${e instanceof Error ? e.message : e} ${(e as { cause?: { code?: string } })?.cause?.code ?? ""}`;
          return { status: 0, text: "", error: /ENOTFOUND|EAI_AGAIN/.test(m) ? "dns" : /timeout|aborted/i.test(m) ? "timeout" : "error" };
        }
      })(),
    );
  }
  return cache.get(url)!;
}

type LinkClass = "none" | "not_public" | "works" | "unverified" | "broken" | "closed_or_parked" | "wrong_site";
interface Judged {
  name: string;
  url: string | null;
  cls: LinkClass;
  detail: string;
  relevant: boolean;
}

async function judge(place: Place, words: string[]): Promise<Judged> {
  const base = { name: place.name, url: place.url ?? null };
  if (!place.url) return { ...base, cls: "none", detail: "no link", relevant: false };
  if (!isPublicWebAddress(place.url)) return { ...base, cls: "not_public", detail: "not a public address", relevant: false };
  const f = await open(place.url);
  if (f.status === 0) return { ...base, cls: f.error === "timeout" ? "unverified" : "broken", detail: f.error ?? "error", relevant: false };
  if ([403, 429, 999, 401].includes(f.status)) return { ...base, cls: "unverified", detail: `HTTP ${f.status}`, relevant: false };
  if (f.status !== 200) return { ...base, cls: "broken", detail: `HTTP ${f.status}`, relevant: false };
  const problem = pageProblem(f.text, place.name);
  if (problem === "name_not_on_site") return { ...base, cls: "wrong_site", detail: problem, relevant: false };
  if (problem) return { ...base, cls: "closed_or_parked", detail: problem, relevant: false };
  const t = fold(f.text);
  const relevant = words.some((w) => t.includes(w));
  return { ...base, cls: "works", detail: "200", relevant };
}

async function loadBooks(): Promise<Book[]> {
  if (file) {
    return file.split(",").map((f) => {
      const j = JSON.parse(readFileSync(f, "utf8"));
      // A research-only run (persona-books.ts --research-only) has no book: its places per idea are in the report.
      if (!j.book && j.report?.placesPerIdea) {
        type Found = { activityId: string; options: { name: string; city: string; url: string | null }[] };
        return { id: f, ideas: (j.report.placesPerIdea as Found[]).map((x) => ({ title: x.activityId, activity_id: x.activityId, places: x.options.map((o) => ({ name: o.name, city: o.city, url: o.url })) })) };
      }
      const book = j.book ?? j;
      return { id: f, ideas: [...(book.ideas ?? []), ...(book.wildcard ? [book.wildcard] : [])] };
    });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials missing in .env.local");
  const q = `${url}/rest/v1/window_plans?select=session_id,created_at,ideas_json,wildcard_json&status=eq.ready${since ? `&created_at=gte.${since}` : ""}&order=created_at.desc&limit=${limit}`;
  const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const rows = (await res.json()) as { session_id: string; created_at: string; ideas_json: Idea[] | null; wildcard_json: Idea | null }[];
  return rows
    .filter((r) => Array.isArray(r.ideas_json) && r.ideas_json.length > 0)
    .map((r) => ({ id: r.session_id, created_at: r.created_at, ideas: [...r.ideas_json!, ...(r.wildcard_json ? [r.wildcard_json] : [])] }));
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

async function main() {
  const books = await loadBooks();
  const rows: { book: string; created_at?: string; idea: string; activity?: string; places: Judged[]; covered: boolean; good: boolean; placesCount: number; linked: number; working: number }[] = [];
  const jobs = books.flatMap((b) => b.ideas.map((idea) => ({ b, idea })));
  await pool(jobs, 8, async ({ b, idea }) => {
    const words = activityWords(idea.activity_id, idea.title);
    const places = await Promise.all((idea.places ?? []).map((p) => judge(p, words)));
    const ok = places.filter((p) => (p.cls === "works" || p.cls === "unverified") && (p.cls === "unverified" || p.relevant));
    rows.push({
      book: b.id,
      created_at: b.created_at,
      idea: idea.title ?? "?",
      activity: idea.activity_id,
      places,
      covered: ok.length >= 1,
      good: ok.length >= 2,
      placesCount: places.length,
      linked: places.filter((p) => p.url).length,
      working: ok.length,
    });
  });
  const n = rows.length;
  const pct = (x: number) => (n ? `${Math.round((100 * x) / n)}%` : "-");
  const classes: Record<string, number> = {};
  for (const r of rows) for (const p of r.places) classes[p.cls + (p.cls === "works" && !p.relevant ? "-not-relevant" : "")] = (classes[p.cls + (p.cls === "works" && !p.relevant ? "-not-relevant" : "")] ?? 0) + 1;
  const summary = {
    books: books.length,
    ideas: n,
    ideasWithAPlace: rows.filter((r) => r.placesCount >= 1).length,
    ideasWithALinkedPlace: rows.filter((r) => r.linked >= 1).length,
    ideasCovered: rows.filter((r) => r.covered).length,
    ideasGood: rows.filter((r) => r.good).length,
    ideasCoveredPct: pct(rows.filter((r) => r.covered).length),
    ideasGoodPct: pct(rows.filter((r) => r.good).length),
    avgPlacesPerIdea: +(rows.reduce((s, r) => s + r.placesCount, 0) / Math.max(1, n)).toFixed(2),
    avgWorkingPerIdea: +(rows.reduce((s, r) => s + r.working, 0) / Math.max(1, n)).toFixed(2),
    linkClasses: classes,
  };
  console.log(JSON.stringify(summary, null, 2));
  const bad = rows.filter((r) => !r.covered);
  console.log(`\nNot covered (${bad.length}):`);
  for (const r of bad.slice(0, 40)) console.log(`  ${r.idea} [${r.activity ?? "-"}]: ${r.places.map((p) => `${p.name} ${p.cls}(${p.detail})${p.relevant ? "" : " not-relevant"}`).join("; ") || "no places"}`);
  if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
