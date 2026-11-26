// Audit and repair of the stored books (fix round "plan links"). For every finished plan it reports: link annotations in the stored PDF that are
// not absolute https addresses, printed web addresses without a link over them, and stored place addresses that are not absolute https. With
// --apply it stores the normalised place addresses and renders and uploads the PDF again, so that every printed address carries an absolute
// link. Free (no model call), sends no e-mail, changes no text of a book. Without --apply nothing is written.
//
//   npx tsx --env-file=.env.local scripts/fix-stored-plan-links.ts [--apply] [--plan <id>]
import { createClient } from "@supabase/supabase-js";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { findWebAddresses, normalizeUrl } from "../src/lib/links/normalizeUrl";
import { checkPage } from "../src/lib/claude/verifyUrls";
import { PDF_BUCKET, PDF_VERSION, pdfPathFor, renderStoredPlanPdf, type StoredPlanBook } from "../src/lib/planPdf";
import type { StoredIntake } from "../src/app/intake/actions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase credentials missing in the environment");
const supabase = createClient(url, key);
const apply = process.argv.includes("--apply");
const only = process.argv.includes("--plan") ? process.argv[process.argv.indexOf("--plan") + 1] : null;

type Entry = { places?: { url?: string | null }[]; details?: string[]; first_action?: string };
type Row = StoredPlanBook & { pdf_url: string | null };

async function annotations(bytes: ArrayBuffer | Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const list = page.node.lookup(PDFName.of("Annots"));
    if (!(list instanceof PDFArray)) continue;
    for (let i = 0; i < list.size(); i++) {
      const annot = list.lookup(i);
      if (!(annot instanceof PDFDict)) continue;
      const action = annot.lookup(PDFName.of("A"));
      const uri = action instanceof PDFDict ? action.lookup(PDFName.of("URI")) : null;
      if (uri instanceof PDFString || uri instanceof PDFHexString) out.push(uri.decodeText());
    }
  }
  return out;
}

/** The place addresses of an entry made absolute; reports what changed. An address that is changed must also answer, or the link is removed. */
async function normalisePlaces(entry: Entry, changes: string[]): Promise<Entry> {
  if (!entry.places) return entry;
  return {
    ...entry,
    places: await Promise.all(
      entry.places.map(async (p) => {
        if (!p.url) return p;
        let fixed = normalizeUrl(p.url);
        if (fixed === p.url) return p;
        // "http://" became "https://" (or a scheme was added): not every old site answers there.
        const answer = fixed ? await checkPage(fixed, null) : null;
        if (answer && !answer.ok) {
          changes.push(`${p.url} -> (removed: https answers ${answer.reason})`);
          fixed = null;
        } else changes.push(`${p.url} -> ${fixed ?? "(removed)"}`);
        return { ...p, url: fixed };
      }),
    ),
  };
}

async function main() {
  let query = supabase.from("window_plans").select("*").eq("status", "ready").order("created_at", { ascending: true });
  if (only) query = query.eq("id", only);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let relative = 0;
  let rendered = 0;
  let failed = 0;
  for (const plan of (data ?? []) as Row[]) {
    const label = `${plan.created_at.slice(0, 10)} ${plan.id}`;
    const entries = [...((plan.ideas_json as Entry[]) ?? []), plan.wildcard_json as Entry].filter(Boolean);
    const changes: string[] = [];
    const fixedEntries = await Promise.all(entries.map((e) => normalisePlaces(e, changes)));
    const printed = entries.flatMap((e) => [...(e.details ?? []), e.first_action ?? ""].flatMap((t) => findWebAddresses(t))).length;

    let before: string[] = [];
    if (plan.pdf_url) {
      const file = await supabase.storage.from(PDF_BUCKET).download(plan.pdf_url);
      if (file.data) before = await annotations(await file.data.arrayBuffer());
    }
    const notAbsolute = before.filter((u) => !/^https:\/\//i.test(u));
    relative += notAbsolute.length;

    const ideas = fixedEntries.slice(0, -1);
    const wildcard = fixedEntries[fixedEntries.length - 1];
    const { data: intake } = await supabase.from("intake_answers").select("raw_json").eq("session_id", plan.session_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const bytes = intake ? await renderStoredPlanPdf({ ...plan, ideas_json: ideas, wildcard_json: wildcard }, intake.raw_json as unknown as StoredIntake) : null;
    if (!bytes) {
      failed++;
      console.log(`${label}  CANNOT be rendered again (${intake ? "incomplete book" : "no intake answers"}); left as it is`);
      continue;
    }
    rendered++;
    const after = await annotations(bytes);
    console.log(
      `${label}  stored PDF: ${before.length} links (${notAbsolute.length} not https), printed addresses in steps: ${printed}; rendered again: ${after.length} links (${after.filter((u) => !/^https:\/\//i.test(u)).length} not https); place addresses changed: ${changes.length}`,
    );
    for (const c of changes) console.log(`    ${c}`);
    if (!apply) continue;

    const path = pdfPathFor(plan.session_id);
    const upload = await supabase.storage.from(PDF_BUCKET).upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
    if (upload.error) {
      failed++;
      console.log(`    upload FAILED: ${upload.error.message}`);
      continue;
    }
    const update = await supabase
      .from("window_plans")
      .update({ pdf_url: path, pdf_version: PDF_VERSION, ...(changes.length ? { ideas_json: ideas, wildcard_json: wildcard } : {}) })
      .eq("id", plan.id);
    if (update.error) {
      failed++;
      console.log(`    update FAILED: ${update.error.message}`);
    }
  }
  console.log(`\n${data?.length ?? 0} plans, ${rendered} rendered, ${failed} failed, ${relative} stored links that were not https. ${apply ? "Applied." : "Dry run: nothing was written (add --apply)."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
