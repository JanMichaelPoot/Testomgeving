import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GeneratedIdeaBook, IdeaBookEntry } from "../../src/lib/claude/ideaBookTypes";
import { qaBook, type QaCode } from "../../src/lib/claude/qualityGate";

// Fase 3 baseline: runs the deterministic quality checks over the books that are already stored (read-only, no API calls, no cost)
// and writes the counts to docs/eval/<date>-stored-books-qa.md. It writes no book text, only counts and short ids, so the report
// can be committed. Month, budget and time come from the book itself (created_at, the intake of its session).
//   npx tsx scripts/eval/qa-stored-books.ts [--limit 300]

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const get = async (p: string) => {
  const r = await fetch(`${base}/${p}`, { headers });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.json();
};

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : 300;

async function main() {
  const plans: { id: string; session_id: string; language: string; created_at: string; status: string; ideas_json: IdeaBookEntry[]; wildcard_json: IdeaBookEntry; pdf_version?: number }[] = await get(
    `window_plans?select=id,session_id,language,created_at,status,pdf_version,ideas_json,wildcard_json&status=eq.ready&order=created_at.desc&limit=${limit}`,
  );
  const codes: QaCode[] = ["exposed_reasoning", "repeated_sentence", "season", "type_setting", "time_chip", "related", "coverage_time", "coverage_budget"];
  const total: Record<string, number> = Object.fromEntries(codes.map((c) => [c, 0]));
  const booksWith: Record<string, number> = Object.fromEntries(codes.map((c) => [c, 0]));
  let books = 0;
  let skipped = 0;
  for (const plan of plans) {
    if (!Array.isArray(plan.ideas_json) || plan.ideas_json.length === 0 || !plan.wildcard_json) {
      skipped++;
      continue;
    }
    const [intake] = await get(`intake_answers?select=raw_json&session_id=eq.${plan.session_id}&order=created_at.desc&limit=1`);
    const raw = (intake?.raw_json ?? {}) as { budget?: string; timeAvailable?: string };
    const book = { profile_summary: "", must_haves: [], preferences: [], ideas: plan.ideas_json, wildcard: plan.wildcard_json, labels: {} } as unknown as GeneratedIdeaBook;
    const issues = qaBook(book, { locale: plan.language === "en" ? "en" : "nl", month: new Date(plan.created_at).getUTCMonth() + 1, budget: raw.budget, timeAvailable: raw.timeAvailable });
    books++;
    const seen = new Set<string>();
    for (const i of issues) {
      total[i.code]++;
      seen.add(i.code);
    }
    for (const c of seen) booksWith[c]++;
  }
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Kwaliteitsmeting van opgeslagen boeken (${date})`,
    "",
    `Alleen lezen, geen API-aanroepen. ${books} boeken met status ready gecontroleerd (${skipped} overgeslagen zonder ideeën). Dit zijn boeken van vóór de kwaliteitspoort, vooral testboeken; het is de nulmeting, geen oordeel over de nieuwe pijplijn.`,
    "",
    "| Controle | Aantal bevindingen | Boeken met minstens één |",
    "|---|---|---|",
    ...codes.map((c) => `| ${c} | ${total[c]} | ${booksWith[c]} (${books ? Math.round((booksWith[c] / books) * 100) : 0}%) |`),
    "",
  ];
  mkdirSync("docs/eval", { recursive: true });
  const out = path.join("docs", "eval", `${date}-stored-books-qa.md`);
  writeFileSync(out, lines.join("\n"));
  console.log(lines.join("\n"));
  console.log(`written to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
