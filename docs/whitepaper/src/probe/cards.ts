import { ASSOCIATIONS } from "@/lib/discovery/associations";
const seen = new Set<string>();
for (const c of ASSOCIATIONS as any[]) {
  const f = c.family ?? c.id; if (seen.has(f)) continue; seen.add(f);
  const tw = Object.entries(c.tagWeights).sort((a:any,b:any)=>b[1]-a[1]).slice(0,3).map(([t])=>t).join("+");
  console.log(`${c.id}|${c.round}|${c.label.nl}|${tw}`);
}
