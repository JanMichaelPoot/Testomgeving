// Measures what one Idea Book generation actually costs, call by call, using the
// real Claude API (so it costs real money: about EUR 0.10-0.20 per profile).
// It runs the generation for sample profiles, captures the usage the pipeline logs
// (`WINDOW: ... usage={...}`), and prices it. Use it before and after changes to the
// pipeline to see what they really save.
//
//   npx tsx scripts/measure-generation.ts            two sample profiles
//   npx tsx scripts/measure-generation.ts --n 1            only the first
//   npx tsx scripts/measure-generation.ts --from 1 --n 1   only the second
//   npx tsx scripts/measure-generation.ts --seeds --from 2 --n 1   the seed pipeline (selection engine +
//                                       grouped research + slim generation) instead of the classic one
//
// Prices per model are in MODEL_PRICE below; web search is $10 per 1,000 searches.
import { existsSync } from "node:fs";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

// Per model (USD per million tokens); cache write = 1.25x input, cache read = 0.1x input.
const MODEL_PRICE: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};
const SEARCH = 0.01;

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

function price(u: Usage, model = "claude-sonnet-5") {
  const p = MODEL_PRICE[model] ?? MODEL_PRICE["claude-sonnet-5"];
  const inp = ((u.input_tokens ?? 0) / 1e6) * p.input;
  const out = ((u.output_tokens ?? 0) / 1e6) * p.output;
  const cw = ((u.cache_creation_input_tokens ?? 0) / 1e6) * p.input * 1.25;
  const cr = ((u.cache_read_input_tokens ?? 0) / 1e6) * p.input * 0.1;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  return { inp, out, cw, cr, search: searches * SEARCH, searches, total: inp + out + cw + cr + searches * SEARCH };
}

const SAMPLES = [
  {
    name: "Utrecht, kunst en klei (klassiek)",
    intake: {
      situation: "Ik zoek iets creatiefs voor de zaterdag, ik werk de hele week achter een scherm",
      purpose: "self", purposeFollowUp: "Iets met mijn handen", ageCategory: "35-44", location: "Utrecht", searchDistance: "city",
      freeTimePattern: "search", practicalToWild: "either", timeAvailable: "halfday", budget: "25", effort: "some",
      solutionTypes: ["activity"], mustHaves: "", preferences: "Liefst met andere mensen", personalReflection: "Iets maken", company: ["friends"],
      interests: [], interestDomains: [], socialFormats: [], surpriseMe: false,
    },
  },
  {
    name: "Haarlem, spellen en wandelen (kaarten)",
    intake: {
      situation: "", purpose: "self", purposeFollowUp: "Nieuwe mensen ontmoeten zonder groot gedoe", ageCategory: "55-64", location: "Haarlem",
      searchDistance: "hour", freeTimePattern: "familiar", practicalToWild: "practical", timeAvailable: "halfday", budget: "25", effort: "some",
      solutionTypes: ["activity"], mustHaves: "Moet buiten of in een rustige ruimte zijn", preferences: "", personalReflection: "", company: ["alone"],
      interests: ["bordspellen", "wandelen", "schaken", "tuinieren"], interestDomains: ["games", "nature"], socialFormats: ["drop_in_alone"], surpriseMe: false,
    },
  },
  {
    name: "Utrecht, kunst en klei (kaarten)",
    intake: {
      situation: "Ik zoek iets creatiefs voor de zaterdag, ik werk de hele week achter een scherm",
      purpose: "self", purposeFollowUp: "Iets met mijn handen", ageCategory: "35-44", location: "Utrecht", searchDistance: "city",
      freeTimePattern: "search", practicalToWild: "either", timeAvailable: "halfday", budget: "25", effort: "some",
      solutionTypes: ["activity"], mustHaves: "", preferences: "Liefst met andere mensen", personalReflection: "Iets maken", company: ["friends"],
      interests: ["pottenbakken", "schilderen", "tekenen", "houtbewerking"], interestDomains: ["creative"], socialFormats: ["drop_in_alone", "small_group"], surpriseMe: false,
    },
  },
];

async function main() {
  const arg = (name: string) => process.argv[process.argv.indexOf(`--${name}`) + 1];
  const from = process.argv.includes("--from") ? Number(arg("from")) : 0;
  const n = process.argv.includes("--n") ? Number(arg("n")) : SAMPLES.length;
  const { generateIdeaBook } = await import("../src/lib/claude/generateIdeaBook");
  const { generateIdeaBookFromSeeds } = await import("../src/lib/claude/generateFromSeeds");
  const useSeeds = process.argv.includes("--seeds");
  const { computeCharacterProfile } = await import("../src/lib/characterProfile");

  const rows: { name: string; calls: { label: string; u: Usage; ms: number; p: ReturnType<typeof price> }[] }[] = [];
  const original = console.log;
  for (const sample of SAMPLES.slice(from, from + n)) {
    const calls: (typeof rows)[number]["calls"] = [];
    console.log = (...args: unknown[]) => {
      const line = args.map(String).join(" ");
      const m = line.match(/WINDOW: (research pass|main generation call|[\w -]+?) took (\d+)ms.*usage=(\{.*\})/);
      if (m) {
        const u = JSON.parse(m[3]) as Usage;
        const model = line.match(/\((claude-[\w.-]+)\)/)?.[1];
        calls.push({ label: m[1], ms: Number(m[2]), u, p: price(u, model) });
      } else original(line);
    };
    try {
      if (useSeeds) {
        const { book, report } = await generateIdeaBookFromSeeds(sample.intake, "nl", computeCharacterProfile(sample.intake), { sessionId: `measure-${sample.name}` });
        console.log = original;
        original(`
${sample.name}: ${book.ideas.map((i) => `${i.door}: ${i.title}`).join(" | ")} | wildcard: ${book.wildcard.title}`);
        original(`research: ${JSON.stringify(report.research)}; issues: ${report.issues.length ? report.issues.join("; ") : "none"}; notes: ${report.notes.join(",") || "-"}`);
      } else {
        await generateIdeaBook(sample.intake, "nl", computeCharacterProfile(sample.intake));
      }
    } finally {
      console.log = original;
    }
    rows.push({ name: sample.name, calls });
  }

  for (const r of rows) {
    console.log(`\n== ${r.name}`);
    let total = 0;
    for (const c of r.calls) {
      total += c.p.total;
      console.log(
        `  ${c.label.padEnd(20)} ${String(Math.round(c.ms / 1000)).padStart(3)}s  in ${String(c.u.input_tokens ?? 0).padStart(6)}  out ${String(c.u.output_tokens ?? 0).padStart(5)}` +
          `  cacheW ${c.u.cache_creation_input_tokens ?? 0}  cacheR ${c.u.cache_read_input_tokens ?? 0}  searches ${c.p.searches}` +
          `  = $${c.p.total.toFixed(3)} (in ${c.p.inp.toFixed(3)}, out ${c.p.out.toFixed(3)}, search ${c.p.search.toFixed(3)})`,
      );
    }
    console.log(`  TOTAL $${total.toFixed(3)}`);
  }
}

main();
