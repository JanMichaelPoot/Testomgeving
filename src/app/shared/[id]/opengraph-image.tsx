import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getSharedIdeaBook } from "./data";
import { pickOneThingIndex } from "@/lib/possibilityMap";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// Fase 5 (PDF & Share) — the "Share Card". Next.js automatically wires a
// file with this name into the route's openGraph/twitter image metadata
// (see the removed static `images` array in ../page.tsx's generateMetadata)
// — no manual metadata wiring needed. This is what actually shows up when
// someone pastes a /shared/[id] link into WhatsApp, iMessage, Slack, or
// social media, which is the real "share card" moment for a link-based
// product like this one (as opposed to a downloadable image post).
//
// Runs through next/og's ImageResponse (Satori under the hood), which is
// already bundled with Next.js — no new rendering dependency (headless
// browser, canvas library) needed, consistent with this app's existing
// "pdf-lib only, no headless-browser rendering" convention for PDFs.
export const runtime = "nodejs";
export const alt = "WINDOW Idea Book";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const IMAGES_DIR = path.join(process.cwd(), "public/illustrations/idea-book");

// The same warm-charcoal / ivory / taupe palette as the printed PDF (see
// the rgb() constants in src/lib/pdf/ideaBook.ts) converted to hex —
// Satori needs literal CSS colors, not Tailwind classes or CSS custom
// properties, so this stays visually consistent with the PDF rather than
// becoming a third, separately-tuned palette.
const PANEL_FILL = "rgba(31,27,24,0.68)";
const PANEL_BORDER = "rgba(199,179,148,0.55)";
const OVERLAY = "rgba(15,13,11,0.35)";
const TEXT_LIGHT = "#F9F6F0";
const TEXT_MUTED = "#C7BAA6";
const ACCENT = "#C7AD8C";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getSharedIdeaBook(id);

  const [coverBytes, serifBytes, sansBytes, sansBoldBytes] = await Promise.all([
    readFile(path.join(IMAGES_DIR, "cover.jpg")),
    readFile(path.join(FONTS_DIR, "NotoSerif-Bold.ttf")),
    readFile(path.join(FONTS_DIR, "NotoSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "NotoSans-Bold.ttf")),
  ]);
  const coverDataUri = `data:image/jpeg;base64,${coverBytes.toString("base64")}`;

  // A deleted/invalid share link still needs *some* card rather than a
  // broken image in the link preview — falls back to a generic WINDOW
  // card in the site's default language.
  const bookLocale = plan?.language === "en" ? "en" : "nl";
  const dict = getDictionary(bookLocale);

  const ideas =
    plan && Array.isArray(plan.ideas_json) ? (plan.ideas_json as unknown as IdeaBookEntry[]) : [];
  const oneThingIndex = pickOneThingIndex(ideas);
  const oneThingTitle = oneThingIndex !== null ? ideas[oneThingIndex]?.title : null;

  const title = plan?.title || dict.shared.eyebrow;

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", position: "relative" }}>
        <img
          src={coverDataUri}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, backgroundColor: OVERLAY, display: "flex" }} />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "64px 72px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 880,
              backgroundColor: PANEL_FILL,
              borderRadius: 24,
              border: `1px solid ${PANEL_BORDER}`,
              padding: "44px 48px",
            }}
          >
            <div style={{ display: "flex", fontSize: 15, letterSpacing: 3, color: ACCENT, fontFamily: "sansBold" }}>
              {dict.shared.eyebrow.toUpperCase()}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: 44,
                lineHeight: 1.15,
                color: TEXT_LIGHT,
                fontFamily: "serif",
              }}
            >
              {title}
            </div>
            {oneThingTitle && (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
                <div
                  style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: ACCENT, fontFamily: "sansBold" }}
                >
                  {dict.plan.book.oneThingBadge.toUpperCase()}
                </div>
                <div style={{ display: "flex", marginTop: 6, fontSize: 26, color: TEXT_LIGHT, fontFamily: "sansBold" }}>
                  {oneThingTitle}
                </div>
              </div>
            )}
            {ideas.length > 0 && (
              <div style={{ display: "flex", marginTop: 28, fontSize: 15, color: TEXT_MUTED, fontFamily: "sans" }}>
                {dict.plan.book.statsIdeasLabel}: {ideas.length} · {dict.plan.book.statsWildcardLabel}: 1
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "serif", data: serifBytes, weight: 700, style: "normal" },
        { name: "sans", data: sansBytes, weight: 400, style: "normal" },
        { name: "sansBold", data: sansBoldBytes, weight: 700, style: "normal" },
      ],
    }
  );
}
