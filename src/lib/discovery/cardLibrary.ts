import { DOMAINS, getActivities } from "@/lib/discovery/library";
import type { CardLibrary } from "@/lib/discovery/cards";
import type { ActivityStatus } from "@/lib/discovery/types";

// Server side: turns the full library into the slim card data the wizard needs
// (one language, no art direction or safety notes). Only activities at or above
// `minStatus` are offered: "concept" while the library is still being reviewed, to
// be raised to "reviewed" or "live" as items are checked.
export const DISCOVERY_MIN_STATUS: Exclude<ActivityStatus, "retired"> = "concept";

export function buildCardLibrary(locale: "nl" | "en"): CardLibrary {
  return {
    domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale], color: d.color })),
    activities: getActivities({ minStatus: DISCOVERY_MIN_STATUS }).map((a) => ({
      id: a.id,
      domain: a.domain,
      sub: a.sub,
      label: a.label[locale],
      entry: a.entry ? a.entry[locale] : null,
      tier: a.safety.tier,
    })),
  };
}
