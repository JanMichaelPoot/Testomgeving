// Builds the blind A/B sheet from two result files made by scripts/eval/run.ts.
//
//   npx tsx scripts/eval/blind-sheet.ts docs/eval/2026-10-27-current.json docs/eval/2026-11-10-v2.json
//   npx tsx scripts/eval/blind-sheet.ts <first.json> <second.json> --seed round-1 --out docs/eval
//
// Writes blind-<seed>.html (give this to the raters) and blind-<seed>.key.json (keep this: it says which
// side was which engine). After the raters sent back their CSV files, count the winner with:
//   npx tsx scripts/eval/blind-sheet.ts --tally docs/eval/blind-round-1.key.json answers-jan.csv answers-sam.csv
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildBlindSheet, tallyPreferences, type BlindKey } from "../../src/lib/discovery/eval/blind";
import type { EvalResultFile } from "../../src/lib/discovery/eval/results";

const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args[0] === "--tally") {
  const key = JSON.parse(readFileSync(args[1], "utf8")) as BlindKey;
  const rows = args.slice(2).flatMap((file) =>
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((l) => {
        const [, profile, , question, answer] = l.split(",");
        return { profile, question, answer };
      }),
  );
  const t = tallyPreferences(rows, key);
  const decided = t.first + t.second;
  console.log(`first file (${key.first.engine}, ${key.first.mode}): ${t.first} | second file (${key.second.engine}, ${key.second.mode}): ${t.second} | no difference: ${t.none}`);
  if (decided) console.log(`second wins ${((t.second / decided) * 100).toFixed(0)}% of the decided votes`);
  process.exit(0);
}

const files = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (files.length !== 2) {
  console.error("Give exactly two result files (the .json files written by scripts/eval/run.ts).");
  process.exit(2);
}
const [first, second] = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as EvalResultFile);
const seed = value("seed") ?? "round-1";
const sheet = buildBlindSheet(first, second, { seed });
const out = path.resolve(value("out") ?? "docs/eval");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, `blind-${seed}.html`), sheet.html);
writeFileSync(path.join(out, `blind-${seed}.key.json`), JSON.stringify(sheet.key, null, 1) + "\n");
const rel = (f: string) => path.relative(process.cwd(), path.join(out, f));
console.log(`sheet: ${rel(`blind-${seed}.html`)} (give to the raters)\nkey:   ${rel(`blind-${seed}.key.json`)} (keep to yourself)`);
