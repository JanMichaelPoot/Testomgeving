/* eslint-disable @next/next/no-img-element -- next/og renders plain <img> elements, next/image does not exist there */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getSharedIdeaBook, getSharedWindowSource } from "./data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildWindowItems } from "@/lib/vensterPanes";
import { WindowArt, paneDataUris } from "@/lib/windowArt";
import { WINDOW_HEIGHT, layoutWindow } from "@/lib/windowLayout";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { DOMAINS } from "@/lib/discovery/library";
import { paneActivities } from "@/lib/discovery/concretePool";
import { shareCardLine } from "@/lib/shareCard";

// The card WhatsApp, iMessage, Slack, LinkedIn, X and Facebook show when a /shared/[id] link is
// pasted (R1.3). Next.js wires a file with this name into openGraph/twitter metadata by itself.
//
// What it shows: the person's own window (four photo panes in the arch), the WindowInto logo and
// one line, "7 doors from one window". For books made with the other intakes the fixed cover
// photo stands in for the window. What it never shows: the open answer, age, place, profile
// text, a name. Only which images were chosen (see getSharedWindowSource).
//
// Runs through next/og's ImageResponse (Satori), already bundled with Next.js.
export const runtime = "nodejs";
export const alt = "WindowInto";
export const size = { width: 1200, height: 630 };
// JPEG, not PNG: a PNG of four photos is ~450 KB and WhatsApp starts dropping previews above
// ~300 KB. (If sharp is ever unavailable the PNG is sent instead, with its own content type.)
export const contentType = "image/jpeg";

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// The site's own palette (--color-accent-dark, --color-gold, --color-cream) as literal colours:
// Satori cannot read CSS custom properties.
const WALNUT = "#3C2920";
const GOLD = "#B08A4A";
const GOLD_LIGHT = "#D2B77A";
const CREAM = "#F7F5F0";

const ARCH_W = 380;
const ARCH_H = 500;
const BORDER = 4;

async function dataUri(file: string): Promise<string> {
  const bytes = await readFile(file);
  const mime = file.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getSharedIdeaBook(id);

  // A deleted or invalid link still needs some card rather than a broken preview: the generic one
  // in the site's default language.
  const locale = plan?.language === "en" ? "en" : "nl";
  const dict = getDictionary(locale);

  const ideas = plan && Array.isArray(plan.ideas_json) ? plan.ideas_json.length : 0;
  const wildcard = plan?.wildcard_json && typeof plan.wildcard_json === "object" && Object.keys(plan.wildcard_json).length > 0 ? 1 : 0;
  const doors = ideas + wildcard;
  const line = doors > 0 ? shareCardLine(dict.shared, doors) : dict.shared.ogTitle;

  // The window: every chosen image in its own pane, the same layout as on the site and in the PDF. Without a window
  // source (other intakes, or nothing chosen) the cover photo fills a plain frame instead.
  const source = plan ? await getSharedWindowSource(plan.id) : null;
  const items = source
    ? buildWindowItems(
        source,
        { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })), activities: source.intakeFlow === "images2" ? paneActivities(locale) : undefined },
        dict.venster,
      )
    : [];
  const hasWindow = items.length > 0;
  const layout = hasWindow ? layoutWindow(items) : null;
  const scale = ARCH_H / WINDOW_HEIGHT;

  const [serifBytes, logo] = await Promise.all([
    readFile(path.join(FONTS_DIR, "Newsreader-Medium.ttf")),
    dataUri(path.join(PUBLIC_DIR, "logo/windowinto-cream.png")),
  ]);
  const paneUris = layout ? await paneDataUris(layout, scale) : [];
  const cover = hasWindow ? null : await dataUri(path.join(PUBLIC_DIR, "illustrations/idea-book/cover.jpg"));

  const png = new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", backgroundColor: WALNUT, padding: "0 96px" }}>
        {layout ? (
          <WindowArt layout={layout} uris={paneUris} scale={scale} />
        ) : (
          <div style={{ display: "flex", width: Math.round(ARCH_W), height: ARCH_H, border: `${BORDER}px solid ${GOLD}`, overflow: "hidden", backgroundColor: CREAM }}>
            {cover && <img src={cover} alt="" width={Math.round(ARCH_W) - 2 * BORDER} height={ARCH_H - 2 * BORDER} style={{ objectFit: "cover" }} />}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", marginLeft: 80, flex: 1 }}>
          <img src={logo} alt="" width={300} height={89} />
          <div style={{ display: "flex", marginTop: 56, width: 60, height: 4, backgroundColor: GOLD_LIGHT }} />
          <div style={{ display: "flex", marginTop: 28, fontSize: 68, lineHeight: 1.1, color: CREAM, fontFamily: "serif" }}>{line}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "serif", data: serifBytes, weight: 500, style: "normal" },
      ],
    },
  );

  try {
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
  } catch (err) {
    console.error("WINDOW: share card could not be converted to JPEG, sending the PNG", err);
    return new Response(await new Response(png.body).arrayBuffer(), { headers: { "Content-Type": "image/png" } });
  }
}
