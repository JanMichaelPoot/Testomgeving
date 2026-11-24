"use client";

import { useEffect } from "react";
import { FRIEND_CODE_STORAGE_KEY, friendCodeFromQuery } from "@/lib/friendCode";
import { trackEvent } from "@/lib/posthog/client";

// A friend's link (Step 238) opens the intake with ?code=WI-XXXX-XXXX. The code has to survive the walk through the intake to the order block, so it is kept for the tab
// (sessionStorage) and taken off the address bar, which stays clean (and is not what gets copied if the friend passes the page on). Nothing is shown here: the order block
// picks the code up and fills it in. A code that cannot be one is ignored.
export function FriendCodeCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get("code");
      if (raw === null) return;
      const code = friendCodeFromQuery(raw);
      if (code) {
        sessionStorage.setItem(FRIEND_CODE_STORAGE_KEY, code);
        trackEvent("friend_code_link_opened");
      }
      url.searchParams.delete("code");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // No storage (a private window, blocked site data): the friend types the code by hand at the order, as with any code.
    }
  }, []);
  return null;
}
