/* eslint-disable @next/next/no-img-element -- next/og renders plain <img> elements, next/image does not exist there */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getSharedIdeaBook, getSharedWindowSource } from "./data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildVensterPanes } from "@/lib/vensterPanes";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { DOMAINS } from "@/lib/discovery/library";
import { paneCardImages, shareCardLine } from "@/lib/shareCard";

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
const FRAME = 10;
const BORDER = 4;
const GAP = 6;

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

  // The window: first photo of each of the four panes. Without a window source (other intakes,
  // or nothing chosen) the cover photo fills the arch.
  const source = plan ? await getSharedWindowSource(plan.id) : null;
  let paneImages: (string | null)[] = [];
  if (source) {
    const panes = buildVensterPanes(
      source,
      { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })) },
      dict.venster,
    );
    paneImages = paneCardImages(panes);
  }
  const hasWindow = paneImages.some(Boolean);

  const [serifBytes, logo] = await Promise.all([
    readFile(path.join(FONTS_DIR, "Newsreader-Medium.ttf")),
    dataUri(path.join(PUBLIC_DIR, "logo/windowinto-cream.png")),
  ]);

  // The border and the padding both sit inside ARCH_W x ARCH_H: what is left is the glass.
  const innerW = ARCH_W - 2 * (FRAME + BORDER);
  const innerH = ARCH_H - 2 * (FRAME + BORDER);
  const paneW = (innerW - GAP) / 2;
  const paneH = (innerH - GAP) / 2;
  const paneUris = hasWindow
    ? await Promise.all(paneImages.map((src) => (src ? dataUri(path.join(PUBLIC_DIR, src)) : Promise.resolve(null))))
    : [];
  const cover = hasWindow ? null : await dataUri(path.join(PUBLIC_DIR, "illustrations/idea-book/cover.jpg"));

  const png = new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", backgroundColor: WALNUT, padding: "0 96px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: GAP,
            width: ARCH_W,
            height: ARCH_H,
            padding: FRAME,
            border: `${BORDER}px solid ${GOLD}`,
            borderTopLeftRadius: ARCH_W / 2,
            borderTopRightRadius: ARCH_W / 2,
            borderBottomLeftRadius: 22,
            borderBottomRightRadius: 22,
            backgroundColor: CREAM,
            overflow: "hidden",
          }}
        >
          {cover ? (
            <img src={cover} alt="" width={innerW} height={innerH} style={{ objectFit: "cover" }} />
          ) : (
            paneUris.map((uri, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  width: paneW,
                  height: paneH,
                  overflow: "hidden",
                  backgroundColor: "rgba(60,41,32,0.12)",
                  borderTopLeftRadius: i === 0 ? paneW : 4,
                  borderTopRightRadius: i === 1 ? paneW : 4,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                }}
              >
                {uri && <img src={uri} alt="" width={paneW} height={paneH} style={{ objectFit: "cover" }} />}
              </div>
            ))
          )}
        </div>

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
