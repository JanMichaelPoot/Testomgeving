/* eslint-disable @next/next/no-img-element -- next/og renders plain <img> elements, next/image does not exist there */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  INVITE_FORMATS,
  INVITE_LOCALES,
  INVITE_PANE_IMAGES,
  INVITE_SIZE,
  inviteCardSlug,
  inviteHost,
  parseInviteCard,
  type InviteFormat,
} from "@/lib/shareInvite";

// The general invitation card (a visual to share on Instagram or WhatsApp): the arch window with
// four photos, a line and "open your window". The same for everybody, nothing personal, made
// once at build time for each format and language (see generateStaticParams).
export const runtime = "nodejs";
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return INVITE_FORMATS.flatMap((format) => INVITE_LOCALES.map((locale) => ({ card: inviteCardSlug(format, locale) })));
}

const FONTS_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// The site's own palette as literal colours: Satori cannot read CSS custom properties.
const WALNUT = "#3C2920";
const GOLD = "#B08A4A";
const GOLD_LIGHT = "#D2B77A";
const CREAM = "#F7F5F0";

async function dataUri(file: string): Promise<string> {
  const bytes = await readFile(file);
  return `data:${file.endsWith(".png") ? "image/png" : "image/jpeg"};base64,${bytes.toString("base64")}`;
}

interface Arch {
  w: number;
  h: number;
  frame: number;
  border: number;
  gap: number;
}

function ArchWindow({ arch, panes }: { arch: Arch; panes: string[] }) {
  const innerW = arch.w - 2 * (arch.frame + arch.border);
  const innerH = arch.h - 2 * (arch.frame + arch.border);
  const paneW = (innerW - arch.gap) / 2;
  const paneH = (innerH - arch.gap) / 2;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: arch.gap,
        width: arch.w,
        height: arch.h,
        padding: arch.frame,
        border: `${arch.border}px solid ${GOLD}`,
        borderTopLeftRadius: arch.w / 2,
        borderTopRightRadius: arch.w / 2,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        backgroundColor: CREAM,
        overflow: "hidden",
      }}
    >
      {panes.map((uri, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: paneW,
            height: paneH,
            overflow: "hidden",
            borderTopLeftRadius: i === 0 ? paneW : 6,
            borderTopRightRadius: i === 1 ? paneW : 6,
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
          }}
        >
          <img src={uri} alt="" width={paneW} height={paneH} style={{ objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

function Cta({ text, host, size }: { text: string; host: string; size: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          padding: `${size * 0.5}px ${size * 1.4}px`,
          borderRadius: 999,
          backgroundColor: GOLD,
          color: WALNUT,
          fontSize: size,
          fontWeight: 700,
          fontFamily: "sans",
        }}
      >
        {text}
      </div>
      <div style={{ display: "flex", marginTop: size * 0.5, fontSize: size * 0.85, color: GOLD_LIGHT, fontFamily: "sans", fontWeight: 400 }}>{host}</div>
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ card: string }> }) {
  const parsed = parseInviteCard((await params).card);
  if (!parsed) return new Response("Not found", { status: 404 });
  const { format, locale } = parsed;
  const copy = getDictionary(locale).venster.invite;
  const host = inviteHost(process.env.NEXT_PUBLIC_SITE_URL);
  const size = INVITE_SIZE[format as InviteFormat];

  const [serif, sans, sansBold, logo, ...panes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "Newsreader-Medium.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Bold.ttf")),
    dataUri(path.join(PUBLIC_DIR, "logo/windowinto-cream.png")),
    ...INVITE_PANE_IMAGES.map((src) => dataUri(path.join(PUBLIC_DIR, src))),
  ]);

  const story = format === "story";
  const tree = story ? (
    // Content in the middle band: the top and bottom of a story are covered by the app's own buttons.
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: WALNUT, padding: "0 80px" }}>
      <img src={logo} alt="" width={380} height={113} />
      <div style={{ display: "flex", marginTop: 48 }}>
        <ArchWindow arch={{ w: 600, h: 740, frame: 16, border: 6, gap: 10 }} panes={panes} />
      </div>
      <div style={{ display: "flex", marginTop: 56, width: 80, height: 4, backgroundColor: GOLD_LIGHT }} />
      <div style={{ display: "flex", marginTop: 30, textAlign: "center", fontSize: 92, lineHeight: 1.06, color: CREAM, fontFamily: "serif", justifyContent: "center" }}>{copy.cardHeadline}</div>
      <div style={{ display: "flex", marginTop: 26, textAlign: "center", fontSize: 38, lineHeight: 1.35, color: "rgba(247,245,240,0.8)", fontFamily: "sans", justifyContent: "center" }}>{copy.cardSub}</div>
      <div style={{ display: "flex", marginTop: 48 }}>
        <Cta text={copy.cardCta} host={host} size={42} />
      </div>
    </div>
  ) : (
    <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", backgroundColor: WALNUT, padding: "0 84px" }}>
      <ArchWindow arch={{ w: 420, h: 600, frame: 14, border: 5, gap: 8 }} panes={panes} />
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 64, flex: 1 }}>
        <img src={logo} alt="" width={290} height={86} />
        <div style={{ display: "flex", marginTop: 40, width: 64, height: 4, backgroundColor: GOLD_LIGHT }} />
        <div style={{ display: "flex", marginTop: 24, fontSize: 64, lineHeight: 1.08, color: CREAM, fontFamily: "serif" }}>{copy.cardHeadline}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 28, lineHeight: 1.35, color: "rgba(247,245,240,0.8)", fontFamily: "sans" }}>{copy.cardSub}</div>
        <div style={{ display: "flex", marginTop: 36, alignSelf: "flex-start" }}>
          <Cta text={copy.cardCta} host={host} size={30} />
        </div>
      </div>
    </div>
  );

  const png = new ImageResponse(tree, {
    ...size,
    fonts: [
      { name: "serif", data: serif, weight: 500, style: "normal" },
      { name: "sans", data: sans, weight: 400, style: "normal" },
      { name: "sans", data: sansBold, weight: 700, style: "normal" },
    ],
  });
  const pngBytes = Buffer.from(await png.arrayBuffer());
  const headers = { "Cache-Control": "public, max-age=86400, s-maxage=604800" };
  // JPEG keeps a card of four photos small (WhatsApp and Instagram upload quicker); if sharp is ever
  // unavailable the PNG is sent as it is.
  try {
    const jpeg = await sharp(pngBytes).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", ...headers } });
  } catch {
    return new Response(new Uint8Array(pngBytes), { headers: { "Content-Type": "image/png", ...headers } });
  }
}
