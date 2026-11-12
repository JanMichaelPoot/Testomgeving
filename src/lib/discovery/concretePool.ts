import { TAGS, getActivities } from "@/lib/discovery/library";
import { DISCOVERY_MIN_STATUS } from "@/lib/discovery/cardLibrary";
import { inSeason } from "@/lib/discovery/season";
import { activityAxes } from "@/lib/discovery/associations";
import { registerOfActivity } from "@/lib/discovery/register";
import type { ConcreteActivity } from "@/lib/discovery/twoPages";
import activityAssociations from "@/lib/discovery/activityAssociations.json";
import { assocCloseness, type ActivityVector } from "@/lib/discovery/associationLayer";
import { ASSOCIATIONS as ALL_CARDS, cardAssoc } from "@/lib/discovery/associations";
import { unfitFlags } from "@/lib/discovery/suitability";
import { knowledgeAssociationLayerEnabled } from "@/lib/knowledgeFlags";

// Server side: the slim activity data page 2 of the two-page intake needs in the browser. One language, only what can be done
// in the month of asking, no photo paths (the browser builds those from the id, see paths.ts), and no safety or entry text.

export interface ConcretePoolItem extends ConcreteActivity {
  /** Label in the visitor's language. */
  label: string;
}

export interface ConcretePool {
  activities: ConcretePoolItem[];
  /** The mood-only tags, which count half when matching activities to images. */
  genericTags: string[];
}

const ASSOCIATIONS = activityAssociations as unknown as { idf: Record<string, number>; activities: Record<string, [string, number][]> };

/** An activity's association vector for the layer: score/5 times idf (rare associations say more than common ones). Undefined when it has none. */
export function activityVector(id: string): ActivityVector | undefined {
  const list = ASSOCIATIONS.activities[id];
  if (!list) return undefined;
  return list.map(([s, score]) => [s, Math.round((score / 5) * (ASSOCIATIONS.idf[s] ?? 0.5) * 1000) / 1000] as const);
}

let hubs: Map<string, number> | null = null;
/**
 * How broadly an activity lies close to the images in general (its mean closeness to every image family), relative to the average
 * activity. Some activities (a butterfly garden, a pizza oven, a tandem jump) overlap with a great many images; without this they
 * would be offered to nearly everybody. The composer divides by its square root.
 */
function relativeHub(id: string): number | undefined {
  if (!hubs) {
    const families = new Map<string, Record<string, number>>();
    for (const c of ALL_CARDS) {
      const w = cardAssoc(c);
      if (w) families.set(c.family ?? c.id, w);
    }
    const raw = new Map<string, number>();
    for (const [aid, list] of Object.entries(ASSOCIATIONS.activities)) {
      const v = activityVector(aid);
      if (!v || list.length === 0) continue;
      raw.set(aid, [...families.values()].reduce((s, f) => s + assocCloseness(f, v), 0) / families.size);
    }
    const mean = [...raw.values()].reduce((s, x) => s + x, 0) / Math.max(1, raw.size);
    hubs = new Map([...raw].map(([k, x]) => [k, Math.round((x / mean) * 100) / 100]));
  }
  return hubs.get(id);
}

export function buildConcretePool(locale: "nl" | "en", month?: number, layer: boolean = knowledgeAssociationLayerEnabled()): ConcretePool {
  return {
    activities: getActivities({ minStatus: DISCOVERY_MIN_STATUS })
      .filter((a) => inSeason(a, month))
      .map((a) => {
        const unfit = unfitFlags(a);
        return {
          id: a.id,
          domain: a.domain,
          sub: a.sub,
          register: registerOfActivity(a),
          tags: a.tags,
          axes: activityAxes(a),
          label: a.label[locale],
          ...(unfit.length > 0 ? { unfit } : {}),
          ...(layer && activityVector(a.id) ? { assoc: activityVector(a.id), assocHub: relativeHub(a.id) } : {}),
        };
      }),
    genericTags: TAGS.filter((t) => t.generic).map((t) => t.id),
  };
}

/** The activities a window can draw (two-page intake): id, label and tags, for the cover, the waiting screen and /plan. */
export function paneActivities(locale: "nl" | "en"): { id: string; label: string; tags: readonly string[] }[] {
  return getActivities().map((a) => ({ id: a.id, label: a.label[locale], tags: a.tags }));
}
