// The PDF of a book, from our own address (fix round "plan links"). It streams the file from private storage after the same check as the /plan
// page, so no storage address ever reaches the browser, there is no link that expires, and a relative address inside the document resolves to our
// own site. Anything that goes wrong sends the reader to the branded page at /plan/boek, never to an error in JSON.

import { NextResponse, type NextRequest } from "next/server";
import { findViewablePlan, planKeyFrom, planPdfBytes, planQuery } from "@/lib/planAccess";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const key = planKeyFrom((name) => url.searchParams.get(name));
  const problem = () => NextResponse.redirect(new URL(`/plan/boek?${planQuery(key, { probleem: "1" })}`, url), 303);
  try {
    const plan = await findViewablePlan(key);
    if (!plan) return problem();
    const bytes = await planPdfBytes(plan, url.searchParams.get("rebuild") === "1");
    if (!bytes) return problem();
    const filename = plan.language === "en" ? "windowinto-idea-book.pdf" : "windowinto-idea-book-nl.pdf";
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        // The address of this page carries the key to the book: websites the reader opens from the PDF never get it.
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    console.error("WindowInto: serving a PDF failed", err instanceof Error ? err.message : err);
    return problem();
  }
}
