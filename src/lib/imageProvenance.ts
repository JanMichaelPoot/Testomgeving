import rules from "@/lib/imageProvenance.json";

// Fase 3: the source and licence of every image the product shows, as data (src/lib/imageProvenance.json).
// Pure functions only, so the test and a report script can use them; nothing here reads the disk.

export interface ProvenanceRule {
  match: string;
  source: string;
  /** "generated" stands for the statement below; "derived" for a copy of another listed image; anything else is literal. */
  license: string;
  /** The origin could not be established from the repository: the owner must confirm it before the commercial launch. */
  confirm?: boolean;
}

export interface Provenance {
  source: string;
  license: string;
  confirm: boolean;
}

const RULES = rules.rules as ProvenanceRule[];

/** A glob over a path: '*' stays inside one folder level, '**' crosses levels. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

const COMPILED = RULES.map((r) => ({ rule: r, re: globToRegExp(r.match) }));

/** The provenance of an image given its path under /public ("illustrations/discovery/pottenbakken.jpg"), or null. */
export function provenanceFor(publicPath: string): Provenance | null {
  const p = publicPath.replace(/^\/+/, "").replace(/\\/g, "/");
  const hit = COMPILED.find((c) => c.re.test(p));
  if (!hit) return null;
  const license = hit.rule.license === "generated" ? rules.generatedStatement : hit.rule.license;
  return { source: hit.rule.source, license, confirm: hit.rule.confirm === true };
}
