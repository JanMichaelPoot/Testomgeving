/* eslint-disable @next/next/no-img-element -- next/og renders plain <img> elements, next/image does not exist there */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { DOMAINS, getActivity, isImagePending } from "@/lib/discovery/library";
import { paneActivities } from "@/lib/discovery/concretePool";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildWindowItems } from "@/lib/vensterPanes";
import { WindowArt, WINDOW_GOLD, WINDOW_WALNUT, paneDataUris } from "@/lib/windowArt";
import { layoutWindow, WINDOW_MAX_PANES } from "@/lib/windowLayout";

// The window as a picture to keep or share ("Download je venster als afbeelding"). The query holds ids only (the ids of
// the chosen images, directions as w:<id>); nothing a person typed is ever in it or in the picture. The same window
// as on the site, on cream, with the WindowInto logo underneath. Unknown ids are ignored, at most 48 are read.
export const runtime = "nodejs";

const CANVAS = { width: 1080, height: 1500 };
const SCALE = 3; // units to pixels: the 300 x 400 window becomes 900 x 1200
const CREAM = "#F7F5F0";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("c") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, WINDOW_MAX_PANES * 2);
  const surprise = url.searchParams.get("s") === "1";

  const dict = getDictionary("nl");
  const library = buildAssociationLibrary("nl");
  const known = new Set(library.cards.map((c) => c.id));
  const domains = DOMAINS.map((d) => ({ id: d.id, label: d.short.nl }));
  const domainIds = new Set(domains.map((d) => d.id));
  const interestDomains = ids.filter((id) => id.startsWith("w:") && domainIds.has(id.slice(2))).map((id) => id.slice(2));
  const associations = ids.filter((id) => known.has(id));
  // The two-page intake adds the chosen activities as a:<id> (real, visible activities only).
  const interests = ids
    .filter((id) => id.startsWith("a:"))
    .map((id) => id.slice(2))
    .filter((id) => {
      const a = getActivity(id);
      return !!a && a.status !== "retired" && !isImagePending(a);
    });
  if (interestDomains.length === 0 && associations.length === 0 && interests.length === 0 && !surprise) {
    return new Response("No window to draw.", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const items = buildWindowItems(
    { interestDomains, associations, surpriseMe: surprise, ...(interests.length ? { intakeFlow: "images2" as const, interests } : {}) },
    { cards: library.cards, domains, activities: interests.length ? paneActivities("nl") : undefined },
    dict.venster,
  );
  const layout = layoutWindow(items);
  const [uris, logoBytes] = await Promise.all([paneDataUris(layout, SCALE), readFile(path.join(process.cwd(), "public/logo/windowinto-color.png"))]);
  const logo = `data:image/png;base64,${logoBytes.toString("base64")}`;
  const frameW = layout.width * SCALE;

  const png = await new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", backgroundColor: CREAM, paddingTop: 90 }}>
        <WindowArt layout={layout} uris={uris} scale={SCALE} />
        {/* The sill, a little wider than the frame. */}
        <div style={{ display: "flex", width: frameW + 36, height: 30, backgroundColor: WINDOW_WALNUT, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTop: `3px solid ${WINDOW_GOLD}` }} />
        <img src={logo} alt="" width={300} height={89} style={{ marginTop: 70 }} />
      </div>
    ),
    CANVAS,
  ).arrayBuffer();

  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 88 }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
