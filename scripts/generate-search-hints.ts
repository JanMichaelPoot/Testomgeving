// Writes src/lib/discovery/searchHints.generated.json: per activity, what kind of option to look for near a person and which Dutch phrases to search.
// Hand-written hints (searchHints.manual.json) are never overwritten and are skipped here.
//
//   npx tsx scripts/generate-search-hints.ts --dry-run               free: how many activities, what it would cost
//   npx tsx scripts/generate-search-hints.ts --budget 0.35           real: stops before the budget could be passed
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

const MODEL = "claude-haiku-4-5-20251001";
const PRICE = { input: 1, output: 5 }; // USD per million tokens
const BATCH = 50;
const OUT = "src/lib/discovery/searchHints.generated.json";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry-run");
  const budget = args.includes("--budget") ? Number(args[args.indexOf("--budget") + 1]) : 0.35;

  const { ALL_ACTIVITIES } = await import("../src/lib/discovery/library");
  const { HINT_KINDS } = await import("../src/lib/discovery/searchHints");
  const manual = JSON.parse(readFileSync("src/lib/discovery/searchHints.manual.json", "utf8")) as Record<string, unknown>;
  const done = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as Record<string, unknown>) : {};
  const todo = ALL_ACTIVITIES.filter((a) => a.status !== "retired" && !manual[a.id] && !done[a.id]);

  const batches: (typeof todo)[] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  const perCall = ((BATCH * 70 + 500) / 1e6) * PRICE.input + ((BATCH * 55) / 1e6) * PRICE.output;
  console.log(`${todo.length} activities to do (${batches.length} calls of up to ${BATCH}), estimated cost about $${(perCall * batches.length).toFixed(2)}; budget $${budget.toFixed(2)}.`);
  if (dry) return;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  let spent = 0;
  const result: Record<string, { kind: string; terms: string }> = { ...(done as Record<string, { kind: string; terms: string }>) };
  for (const [n, batch] of batches.entries()) {
    if (spent + perCall * 1.5 > budget) {
      console.log(`STOP before call ${n + 1}: spent $${spent.toFixed(3)}, the next call could pass the budget.`);
      break;
    }
    const lines = batch.map((a) => `${a.id} | ${a.label.nl} | ${a.entry?.nl ?? "-"} | ${a.setting ?? "-"}`).join("\n");
    const prompt = `A Dutch app suggests activities to people and then looks up a REAL option near them (a place, club or organiser) with a web search.
For each activity below, say what KIND of option a beginner in the Netherlands can actually use, and give 2 to 4 short Dutch search phrases that would find it.

Kinds:
- venue: a studio, school, workshop or venue with lessons, trial sessions or a day to try it
- club: a club, association or regular group to join (open evening, trial membership)
- place: somewhere to go to (park, route, nature site, museum, play venue) that is open to visit
- event: an organised outing, excursion, open day or event, or the group that organises it

Rules: the phrases are what a person would type into Google in the Netherlands, without a city (the city is added later). Prefer physical options. For an activity people normally do at home or alone (a puzzle, a hobby), name the club, library, cafe or event where it is done together. Never mention online courses, apps or webshops. Separate phrases with a semicolon.

Answer with one JSON code block only: [{"id": "...", "kind": "venue|club|place|event", "terms": "phrase; phrase; phrase"}]

Activities (id | name | usual way in | setting):
${lines}`;
    const msg = await client.messages.create({ model: MODEL, max_tokens: 4500, messages: [{ role: "user", content: prompt }] });
    const cost = (msg.usage.input_tokens / 1e6) * PRICE.input + (msg.usage.output_tokens / 1e6) * PRICE.output;
    spent += cost;
    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    const json = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
    let rows: { id?: string; kind?: string; terms?: string }[] = [];
    try {
      rows = JSON.parse(json);
    } catch {
      console.log(`call ${n + 1}: unreadable answer, skipped`);
      continue;
    }
    let kept = 0;
    for (const r of rows) {
      if (!r.id || !batch.some((a) => a.id === r.id) || !(HINT_KINDS as readonly string[]).includes(r.kind ?? "") || !r.terms || r.terms.length < 8) continue;
      result[r.id] = { kind: r.kind!, terms: r.terms.replace(/\s+/g, " ").trim() };
      kept++;
    }
    console.log(`call ${n + 1}/${batches.length}: ${kept}/${batch.length} kept, $${cost.toFixed(3)} (total $${spent.toFixed(3)})`);
    writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  }
  console.log(`DONE. ${Object.keys(result).length} generated hints, spent about $${spent.toFixed(3)}.`);
}
main();
