import { hashSeed, mulberry32 } from "@/lib/discovery/rng";
import type { EvalProfileResult, EvalResultFile } from "@/lib/discovery/eval/results";

// The blind A/B sheet: for every profile the two engines' results side by side in a random order, with
// the five rubric questions of the assignment (section 2) per side. The raters never see which engine
// is which; the key goes to a separate file. A self-contained HTML page (no network, no libraries) that
// exports the answers as CSV, so Jan and one or two testers can fill it in without any tooling.

export const RUBRIC = [
  { id: "relevance", nl: "Relevantie", question: "Past dit bij deze persoon?" },
  { id: "discovery", nl: "Ontdekking", question: "Had deze persoon dit zelf nooit bedacht? (1 = zelf bedacht, 5 = echt nieuw)" },
  { id: "actionability", nl: "Uitvoerbaarheid", question: "Weet je morgen wat je moet doen?" },
  { id: "diversity", nl: "Diversiteit", question: "Zijn dit zes verschillende deuren?" },
  { id: "personal", nl: "Persoonlijk karakter", question: "Voelt dit voor deze persoon gemaakt?" },
] as const;

export interface BlindKey {
  seed: string;
  /** Per profile: which result file is shown as A and which as B. */
  sides: Record<string, { A: "first" | "second"; B: "first" | "second" }>;
  first: { engine: string; mode: string; generatedAt: string };
  second: { engine: string; mode: string; generatedAt: string };
}

export interface BlindSheet {
  html: string;
  key: BlindKey;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sideHtml(p: EvalProfileResult): string {
  // Written books when both runs have them; otherwise the seven chosen activities with their door.
  if (p.book) {
    return `<ol>${p.book.ideas
      .map((i) => `<li><strong>${esc(i.title)}</strong> <em>(${esc(i.door)})</em><br>${esc(i.intro)}<br><small>Waarom: ${esc(i.why_it_fits)}<br>Eerste stap: ${esc(i.first_action)}</small></li>`)
      .join("")}</ol>`;
  }
  return `<ol>${p.seeds
    .map((s) => `<li><strong>${esc(s.label.nl)}</strong> <em>(${esc(s.door)})</em>${s.chain.length > 1 ? `<br><small>Pad: ${esc(s.chain.join(" → "))}</small>` : ""}</li>`)
    .join("")}</ol>`;
}

export function buildBlindSheet(first: EvalResultFile, second: EvalResultFile, opts: { seed: string }): BlindSheet {
  const rnd = mulberry32(hashSeed(`blind:${opts.seed}`));
  const secondById = new Map(second.profiles.map((p) => [p.id, p]));
  const common = first.profiles.filter((p) => secondById.has(p.id));
  const useBooks = common.every((p) => p.book && secondById.get(p.id)!.book);
  const strip = (p: EvalProfileResult): EvalProfileResult => (useBooks ? p : { ...p, book: undefined });

  const sides: BlindKey["sides"] = {};
  const cards = common.map((p) => {
    const flip = rnd() < 0.5;
    sides[p.id] = flip ? { A: "second", B: "first" } : { A: "first", B: "second" };
    const a = strip(flip ? secondById.get(p.id)! : p);
    const b = strip(flip ? p : secondById.get(p.id)!);
    const rubric = (side: "A" | "B") =>
      RUBRIC.map(
        (r) =>
          `<div class="q"><span>${esc(r.nl)}: ${esc(r.question)}</span>${[1, 2, 3, 4, 5]
            .map((n) => `<label><input type="radio" name="${p.id}|${side}|${r.id}" value="${n}"> ${n}</label>`)
            .join("")}</div>`,
      ).join("");
    return `<section class="profile" data-id="${p.id}">
<h2>${esc(p.id)} ${esc(p.title)}</h2>
<ul class="brief">${p.brief.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
<div class="cols">
<div><h3>Voorstel A</h3>${sideHtml(a)}${rubric("A")}</div>
<div><h3>Voorstel B</h3>${sideHtml(b)}${rubric("B")}</div>
</div>
<div class="q"><span><strong>Welk voorstel kies je voor deze persoon?</strong></span>
<label><input type="radio" name="${p.id}|pref" value="A"> A</label>
<label><input type="radio" name="${p.id}|pref" value="B"> B</label>
<label><input type="radio" name="${p.id}|pref" value="geen"> geen verschil</label></div>
</section>`;
  });

  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blinde vergelijking</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:16px;color:#202020;background:#f7f5f0}
.profile{background:#fffdfa;border:1px solid #ded8ce;border-radius:12px;padding:16px;margin:16px 0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:800px){.cols{grid-template-columns:1fr}}
.q{margin:6px 0}.q span{display:block}.q label{margin-right:12px}
.brief{color:#77736c;margin:0 0 8px;padding-left:18px}
button{font:inherit;padding:10px 18px;border-radius:12px;border:1px solid #3c2920;background:#3c2920;color:#fff;cursor:pointer}
input[type=text]{font:inherit;padding:6px 10px;border:1px solid #ded8ce;border-radius:8px}
</style></head><body>
<h1>Blinde vergelijking</h1>
<p>Je ziet per persoon twee voorstellen. Beoordeel elk voorstel op vijf vragen (1 = helemaal niet, 5 = helemaal wel) en kies daarna welke je zou geven. Je weet niet welk voorstel van welke versie is.</p>
<p><label>Je naam: <input type="text" id="rater"></label></p>
${cards.join("\n")}
<p><button type="button" id="export">Download je antwoorden (CSV)</button></p>
<script>
document.getElementById("export").addEventListener("click", function () {
  var rater = (document.getElementById("rater").value || "anoniem").replace(/[",\\n]/g, " ");
  var rows = [["rater", "profile", "side", "question", "answer"]];
  document.querySelectorAll("input[type=radio]:checked").forEach(function (el) {
    var parts = el.name.split("|");
    rows.push([rater, parts[0], parts[1] === "pref" ? "" : parts[1], parts[1] === "pref" ? "preference" : parts[2], el.value]);
  });
  var csv = rows.map(function (r) { return r.join(","); }).join("\\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "blind-answers-" + rater + ".csv";
  a.click();
});
</script></body></html>`;

  const meta = (f: EvalResultFile) => ({ engine: f.engine, mode: f.mode, generatedAt: f.generatedAt });
  return { html, key: { seed: opts.seed, sides, first: meta(first), second: meta(second) } };
}

/** Counts the answers of a rater's CSV against the key: how often each file won, ties excluded. */
export function tallyPreferences(csvRows: { profile: string; question: string; answer: string }[], key: BlindKey): { first: number; second: number; none: number } {
  const out = { first: 0, second: 0, none: 0 };
  for (const r of csvRows) {
    if (r.question !== "preference") continue;
    if (r.answer === "geen") out.none++;
    else {
      const which = key.sides[r.profile]?.[r.answer as "A" | "B"];
      if (which === "first") out.first++;
      else if (which === "second") out.second++;
    }
  }
  return out;
}
