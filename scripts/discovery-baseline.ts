// How varied is what the CURRENT generation (Claude without the selection engine)
// produces? Reads the finished Idea Books in the database and measures repetition
// and spread, to compare with the engine (scripts/discovery-shadow.ts). Read-only,
// no API cost. Note: these are mostly test books made by the project owner, so treat
// the numbers as an indication, not a measurement of real visitors.
//
//   npx tsx scripts/discovery-baseline.ts
import { existsSync } from "node:fs";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Supabase credentials missing in .env.local");
  process.exit(1);
}

interface Idea {
  title?: string;
  door?: string;
  photo_category?: string;
}
interface Plan {
  session_id: string;
  ideas_json: Idea[] | null;
  wildcard_json: Idea | null;
}

async function main() {
  const res = await fetch(`${url}/rest/v1/window_plans?select=session_id,ideas_json,wildcard_json&status=eq.ready&order=created_at.desc&limit=500`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}` },
  });
  const plans = ((await res.json()) as Plan[]).filter((p) => Array.isArray(p.ideas_json) && p.ideas_json.length > 0);
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9à-ÿ ]/g, "").replace(/\s+/g, " ").trim();

  const perTitle = new Map<string, Set<string>>();
  const categories = new Map<string, number>();
  let distinctCats = 0;
  let withCats = 0;
  let ideas = 0;
  for (const p of plans) {
    const all = [...p.ideas_json!, ...(p.wildcard_json ? [p.wildcard_json] : [])];
    const cats = new Set<string>();
    for (const i of all) {
      ideas++;
      if (i.title) perTitle.set(norm(i.title), (perTitle.get(norm(i.title)) ?? new Set()).add(p.session_id));
      if (i.photo_category) {
        cats.add(i.photo_category);
        categories.set(i.photo_category, (categories.get(i.photo_category) ?? 0) + 1);
      }
    }
    if (cats.size > 0) {
      withCats++;
      distinctCats += cats.size;
    }
  }
  // Which "signature" words keep coming back? Counted per book, so a word in many different
  // books means the model reaches for the same ideas whatever the person said.
  const STOP = new Set("een het van de in op met voor je jouw naar aan bij als of en om te zonder over uit die dat is je".split(" "));
  const perWord = new Map<string, number>();
  for (const p of plans) {
    const words = new Set<string>();
    for (const i of [...p.ideas_json!, ...(p.wildcard_json ? [p.wildcard_json] : [])]) {
      for (const w of norm(i.title ?? "").split(" ")) if (w.length > 4 && !STOP.has(w)) words.add(w);
    }
    for (const w of words) perWord.set(w, (perWord.get(w) ?? 0) + 1);
  }
  const topWords = [...perWord.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const repeated = [...perTitle.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size);
  const ideasInRepeated = repeated.reduce((s, [, set]) => s + set.size, 0);

  console.log(`\n${plans.length} finished books, ${ideas} ideas (6 + wildcard each)\n`);
  // photo_category only exists on newer books; measure spread on those alone.
  console.log(`Books with photo categories: ${withCats} (older books predate the field)`);
  console.log(`Average distinct photo categories per such book: ${withCats ? (distinctCats / withCats).toFixed(1) : "n/a"} of 12`);
  console.log(`Titles that occur in 2+ different books: ${repeated.length} (covering ${ideasInRepeated} of ${ideas} ideas, ${((ideasInRepeated / ideas) * 100).toFixed(0)}%)`);
  console.log("Most repeated titles:", repeated.slice(0, 8).map(([t, s]) => `${t} (${s.size}x)`).join("; "));
  console.log("Words that recur in titles across books (books containing the word):", topWords.map(([w, n]) => `${w} ${n}`).join(", "));
  console.log("Category share:", [...categories.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${((n / ideas) * 100).toFixed(0)}%`).join(", "));
}

main();
