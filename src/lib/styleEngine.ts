// The Style Engine: a fixed, pre-generated set of visual presets the user
// picks from during intake (src/components/window/IntakeWizard.tsx),
// applied to the final Idea Book PDF (src/lib/pdf/ideaBook.ts).
//
// Deliberately NOT live per-session AI image generation — six styles times
// six ideas would mean up to 36 unique images per purchase, far too slow
// and costly for a product at this price point. Every image below is
// generated once via scripts/generate-style-illustrations.ts and committed
// as a static asset, exactly like the rest of this project's illustrations
// (see src/lib/illustrations.ts) — the running app never calls Gemini.
export type StyleId = "bloom" | "warm" | "bold" | "edge" | "calm" | "vivid";

export interface StylePreset {
  id: StyleId;
  // rgb() triples in the 0-1 range pdf-lib expects, replacing the fixed
  // lavender PANEL_TINT so each style reads as a genuinely different mood,
  // not just different photos. Kept light enough that dark ink text drawn
  // over it stays readable, matching the existing PANEL_TINT's lightness.
  panelTint: readonly [number, number, number];
  images: {
    cover: string;
    moods: readonly [string, string, string];
  };
}

const STYLE_DIR = "/illustrations/styles";

function stylePreset(id: StyleId, panelTint: readonly [number, number, number]): StylePreset {
  return {
    id,
    panelTint,
    images: {
      cover: `${STYLE_DIR}/${id}/cover.jpg`,
      moods: [
        `${STYLE_DIR}/${id}/mood-1.jpg`,
        `${STYLE_DIR}/${id}/mood-2.jpg`,
        `${STYLE_DIR}/${id}/mood-3.jpg`,
      ],
    },
  };
}

export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  bloom: stylePreset("bloom", [0.97, 0.91, 0.94]),
  warm: stylePreset("warm", [0.98, 0.93, 0.87]),
  bold: stylePreset("bold", [0.91, 0.9, 0.92]),
  edge: stylePreset("edge", [0.91, 0.93, 0.95]),
  calm: stylePreset("calm", [0.92, 0.94, 0.89]),
  vivid: stylePreset("vivid", [0.99, 0.94, 0.83]),
};

// Used for sessions from before the Style Engine existed, and as the
// wizard's pre-selected default — closest in mood to the site's original,
// single fixed illustration set.
export const DEFAULT_STYLE_ID: StyleId = "warm";

export function resolveStylePreset(styleId: string | undefined): StylePreset {
  if (styleId && styleId in STYLE_PRESETS) return STYLE_PRESETS[styleId as StyleId];
  return STYLE_PRESETS[DEFAULT_STYLE_ID];
}
