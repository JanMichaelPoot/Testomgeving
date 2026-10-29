/* eslint-disable @next/next/no-img-element -- next/og renders plain <img> elements, next/image does not exist there */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { safeIllustrationPath } from "@/lib/shareCard";
import type { WindowLayout } from "@/lib/windowLayout";

// The window as a picture, for the share image (/shared/[id]) and the downloadable picture (/api/window-image):
// the same rectangles as the website and the PDF cover (src/lib/windowLayout.ts), drawn with next/og's Satori.

export const WINDOW_WALNUT = "#3C2920";
export const WINDOW_GOLD = "#B08A4A";
export const WINDOW_GOLD_LIGHT = "#D2B77A";

/**
 * One data URI per displayed item (by its index in `layout.shown`), each cut to its pane at `scale` pixels per unit with
 * sharp, so a window of 24 photos stays light. null for a placeholder or an image that is not one of ours.
 */
export async function paneDataUris(layout: WindowLayout, scale: number): Promise<(string | null)[]> {
  const out: (string | null)[] = layout.shown.map(() => null);
  await Promise.all(
    layout.panes.map(async (pane) => {
      if (pane.item === null) return;
      const src = layout.shown[pane.item].image;
      const safe = src ? safeIllustrationPath(src) : null;
      if (!safe) return;
      try {
        const bytes = await readFile(path.join(process.cwd(), "public", safe));
        const jpeg = await sharp(bytes)
          .resize(Math.max(8, Math.round(pane.w * scale)), Math.max(8, Math.round(pane.h * scale)), { fit: "cover" })
          .jpeg({ quality: 82 })
          .toBuffer();
        out[pane.item] = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      } catch {
        out[pane.item] = null; // a missing photo leaves its pane plain rather than failing the picture
      }
    }),
  );
  return out;
}

export function WindowArt({ layout, uris, scale }: { layout: WindowLayout; uris: (string | null)[]; scale: number }) {
  const px = (v: number) => Math.round(v * scale);
  const glass = layout.glass;
  return (
    <div style={{ display: "flex", position: "relative", width: px(layout.width), height: px(layout.height), backgroundColor: WINDOW_WALNUT }}>
      {layout.panes.map((pane) => {
        const item = pane.item === null ? null : layout.shown[pane.item];
        const uri = pane.item === null ? null : uris[pane.item];
        return (
          <div
            key={pane.slot}
            style={{
              display: "flex",
              position: "absolute",
              left: px(pane.x),
              top: px(pane.y),
              width: px(pane.w),
              height: px(pane.h),
              overflow: "hidden",
              backgroundColor: "#F2ECE1",
              // Satori reads every key it is given, so the gradient is only a key when there is one.
              ...(item?.placeholder && !uri ? { backgroundImage: `linear-gradient(135deg, ${WINDOW_GOLD_LIGHT}, ${WINDOW_GOLD})` } : {}),
            }}
          >
            {uri && <img src={uri} alt="" width={px(pane.w)} height={px(pane.h)} style={{ objectFit: "cover" }} />}
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: px(glass.x),
          top: px(glass.y),
          width: px(glass.w),
          height: px(glass.h),
          border: `${Math.max(1, Math.round(scale * 0.5))}px solid rgba(210,183,122,0.6)`,
        }}
      />
    </div>
  );
}
