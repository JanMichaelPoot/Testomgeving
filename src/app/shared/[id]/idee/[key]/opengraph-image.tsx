/* eslint-disable @next/next/no-img-element -- next/og renders plain <img> elements, next/image does not exist there */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getSharedIdeaBook } from "../../data";
import { getIdeaShareCopy } from "@/lib/i18n/ideaShare";
import { parseShareTarget, resolveShared, shortExplanation, truncateAtWord } from "@/lib/ideaShare";
import { ideaPhoto } from "@/lib/illustrations";
import { safeIllustrationPath } from "@/lib/shareCard";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { withValidLayers } from "@/lib/claude/ideaLayers";
import { withCheckedPrices } from "@/lib/links/priceClaims";
import { imageDisclaimer } from "@/lib/copy/disclaimers";

// The card of ONE idea (Step 242): the picture WhatsApp, iMessage and the others show when /shared/[id]/idee/[key] is pasted, and the picture the idea dialog offers to
// share or download. The idea's own photo in the arch, its title, one line, the practical facts and the logo. Like the card of the whole book it shows what a
// stranger may see: the idea, never the buyer's answers.
export const runtime = "nodejs";
export const alt = "WindowInto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// The site's own palette as literal colours: Satori cannot read CSS custom properties.
const WALNUT = "#3C2920";
const GOLD = "#B08A4A";
const GOLD_LIGHT = "#D2B77A";
const CREAM = "#F7F5F0";

const ARCH_W = 380;
const ARCH_H = 500;
const BORDER = 4;

async function dataUri(file: string): Promise<string> {
  const bytes = await readFile(file);
  return `data:${file.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${bytes.toString("base64")}`;
}

export default async function Image({ params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  const target = parseShareTarget(id, key);
  const plan = target ? await getSharedIdeaBook(target.planId) : null;
  const locale = plan?.language === "en" ? "en" : "nl";
  const copy = getIdeaShareCopy(locale);

  const ideas = plan && Array.isArray(plan.ideas_json) ? (plan.ideas_json as unknown as IdeaBookEntry[]).map((e) => withCheckedPrices(withValidLayers(e), locale)) : [];
  const wildcard = plan?.wildcard_json && typeof plan.wildcard_json === "object" && Object.keys(plan.wildcard_json).length > 0 ? withCheckedPrices(withValidLayers(plan.wildcard_json as unknown as IdeaBookEntry), locale) : null;
  const shared = target ? resolveShared(target.key, ideas, wildcard) : null;

  const title = shared?.idea.title ?? "WindowInto";
  const line = shared ? truncateAtWord(shortExplanation(shared.idea), 150) : "";
  const facts = shared ? [shared.idea.practical.estimated_cost, shared.idea.practical.duration].filter(Boolean).join("  ·  ") : "";
  const photoPath = shared ? safeIllustrationPath(ideaPhoto(shared.idea, shared.photoIndex)) : null;

  const [serifBytes, sansBytes, sansBold, logo, photo] = await Promise.all([
    readFile(path.join(FONTS_DIR, "Newsreader-Medium.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Bold.ttf")),
    dataUri(path.join(PUBLIC_DIR, "logo/windowinto-cream.png")),
    // A missing or unsafe photo must never break the card: the cover photo stands in.
    dataUri(path.join(PUBLIC_DIR, photoPath ?? "illustrations/idea-book/cover.jpg")).catch(() => dataUri(path.join(PUBLIC_DIR, "illustrations/idea-book/cover.jpg"))),
  ]);

  const titleSize = title.length <= 26 ? 70 : title.length <= 44 ? 58 : 48;

  const png = new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", backgroundColor: WALNUT, padding: "0 84px" }}>
        <div
          style={{
            display: "flex",
            width: ARCH_W,
            height: ARCH_H,
            border: `${BORDER}px solid ${GOLD}`,
            borderTopLeftRadius: ARCH_W / 2,
            borderTopRightRadius: ARCH_W / 2,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            overflow: "hidden",
            backgroundColor: CREAM,
          }}
        >
          <img src={photo} alt="" width={ARCH_W - 2 * BORDER} height={ARCH_H - 2 * BORDER} style={{ objectFit: "cover" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72, flex: 1 }}>
          <img src={logo} alt="" width={240} height={71} />
          <div style={{ display: "flex", marginTop: 36, width: 60, height: 4, backgroundColor: GOLD_LIGHT }} />
          <div style={{ display: "flex", marginTop: 26, fontSize: titleSize, lineHeight: 1.08, color: CREAM, fontFamily: "serif" }}>{title}</div>
          {line && <div style={{ display: "flex", marginTop: 22, fontSize: 27, lineHeight: 1.35, color: "rgba(247,245,240,0.82)", fontFamily: "sans" }}>{line}</div>}
          {facts && <div style={{ display: "flex", marginTop: 22, fontSize: 24, fontWeight: 700, color: GOLD_LIGHT, fontFamily: "sans" }}>{facts}</div>}
          <div style={{ display: "flex", marginTop: 34, fontSize: 21, color: "rgba(247,245,240,0.6)", fontFamily: "sans" }}>{copy.cardFooter}</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 17, color: "rgba(247,245,240,0.6)", fontFamily: "sans" }}>{imageDisclaimer(locale).short}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "serif", data: serifBytes, weight: 500, style: "normal" },
        { name: "sans", data: sansBytes, weight: 400, style: "normal" },
        { name: "sans", data: sansBold, weight: 700, style: "normal" },
      ],
    },
  );

  // JPEG: a card with a photo in PNG is too heavy for WhatsApp's preview; the PNG is sent only if sharp is unavailable.
  const cache = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
  try {
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", ...cache } });
  } catch (err) {
    console.error("WINDOW: idea card could not be converted to JPEG, sending the PNG", err);
    return new Response(await new Response(png.body).arrayBuffer(), { headers: { "Content-Type": "image/png", ...cache } });
  }
}
