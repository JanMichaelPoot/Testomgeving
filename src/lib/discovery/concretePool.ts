import { TAGS, getActivities } from "@/lib/discovery/library";
import { DISCOVERY_MIN_STATUS } from "@/lib/discovery/cardLibrary";
import { inSeason } from "@/lib/discovery/season";
import { activityAxes } from "@/lib/discovery/associations";
import { registerOfActivity } from "@/lib/discovery/register";
import type { ConcreteActivity } from "@/lib/discovery/twoPages";

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

export function buildConcretePool(locale: "nl" | "en", month?: number): ConcretePool {
  return {
    activities: getActivities({ minStatus: DISCOVERY_MIN_STATUS })
      .filter((a) => inSeason(a, month))
      .map((a) => ({
        id: a.id,
        domain: a.domain,
        sub: a.sub,
        register: registerOfActivity(a),
        tags: a.tags,
        axes: activityAxes(a),
        label: a.label[locale],
      })),
    genericTags: TAGS.filter((t) => t.generic).map((t) => t.id),
  };
}

/** The activities a window can draw (two-page intake): id, label and tags, for the cover, the waiting screen and /plan. */
export function paneActivities(locale: "nl" | "en"): { id: string; label: string; tags: readonly string[] }[] {
  return getActivities().map((a) => ({ id: a.id, label: a.label[locale], tags: a.tags }));
}
