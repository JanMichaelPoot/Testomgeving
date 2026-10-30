// Every analytics event the app sends, with the properties it is allowed to carry (R2.4).
//
// The rule: an event holds ids, counts, durations, booleans and fixed words, never what a person
// wrote or what was written about them (no free text, no card or door titles, no place, name, age
// or e-mail). The test in analyticsEvents.test.ts reads every trackEvent() call in the source and
// fails when a call uses an event that is not listed here or a property that is not allowed, so a
// later change cannot start sending personal text to PostHog without someone noticing.
// docs/analytics-events.md is the overview for people; the same test checks it lists all of these.
//
// Properties starting with "has_" are booleans ("did they write something?"), never the text.

export interface AnalyticsEventSpec {
  /** Where it fires. */
  when: string;
  props: readonly string[];
}

export const ANALYTICS_EVENTS = {
  // --- landing
  landing_viewed: { when: "landing page shown", props: [] },
  landing_start_submitted: { when: "start form on the landing page sent", props: ["has_text"] },

  // --- intake (all three wizards; wizard_variant says which)
  intake_started: { when: "a wizard opened", props: ["wizard_variant", "editing", "gift", "restored"] },
  intake_page_viewed: { when: "a wizard page shown", props: ["wizard_variant", "page", "index", "of"] },
  intake_page_back: { when: "back pressed", props: ["wizard_variant", "page", "index", "stage"] },
  intake_page_completed: { when: "a wizard page finished", props: ["wizard_variant", "page", "index", "duration_ms"] },
  intake_submitted: { when: "the intake sent", props: ["wizard_variant", "pages", "total_ms", "images"] },
  intake_submit_failed: { when: "sending the intake failed", props: ["wizard_variant"] },
  discovery_domain_toggled: { when: "card wizard: a world picked or dropped", props: ["wizard_variant", "domain", "on"] },
  discovery_card_toggled: { when: "card wizard: an activity picked or dropped", props: ["wizard_variant", "activity_id", "on", "batch"] },
  discovery_more_clicked: { when: "card wizard: more cards asked for", props: ["wizard_variant", "batches"] },
  discovery_skipped: { when: "card wizard: the interest step skipped", props: ["wizard_variant"] },
  discovery_stage_completed: {
    when: "card wizard: worlds or cards step finished",
    props: ["wizard_variant", "stage", "selected", "surprise", "batches_shown", "duration_ms"],
  },

  // --- image intake ("Het venster")
  association_round_completed: { when: "a round of images finished", props: ["round", "selected", "mode", "duration_ms"] },
  images_page_completed: {
    when: "two-page intake: page 1 (images) finished; counts per style register of the chosen images",
    props: ["selected", "refreshes", "n_expressive", "n_nurturing", "n_technical", "n_nature"],
  },
  concrete_page_completed: {
    when: "two-page intake: page 2 (activities) finished; counts per style register of the chosen activities",
    props: ["selected", "refreshes", "explore_picked", "n_expressive", "n_nurturing", "n_technical", "n_nature"],
  },
  association_swipe: { when: "swipe mode: an image kept or passed", props: ["id", "liked"] },
  window_completed: { when: "the profile screen reached: the window is complete", props: ["images", "panes"] },
  profile_viewed: { when: "the profile screen 'Zo kijken wij door jouw venster' shown", props: [] },
  profile_agreed: { when: "'Klopt, open mijn venster' pressed", props: ["adjusted"] },
  profile_axis_changed: { when: "a slider of the profile screen moved", props: ["axis"] },
  profile_reflection: { when: "profile agreed: did they fill 'Wat missen we nog?'", props: ["has_reflection"] },

  // --- checkout and waiting
  window_exported: { when: "the picture of the window downloaded", props: ["images"] },
  checkout_viewed: { when: "checkout page shown", props: [] },
  checkout_pay_clicked: { when: "'Maak het echt' pressed", props: ["is_gift"] },
  // Sent by the server (trackServerEvent), not the browser: it does not wait for the cookie banner and carries no
  // person. It cannot be joined to the browser events of the same visitor, by design: compare counts per day.
  payment_succeeded: { when: "a paid book starts (Stripe says paid), server side", props: ["is_gift", "amount_cents"] },
  generation_stalled: { when: "the waiting screen passed 120 s", props: ["stage", "seconds"] },

  // --- the book
  plan_viewed: { when: "the book opened", props: ["planId"] },
  idea_opened: { when: "an idea opened in the dialog", props: ["planId", "ideaKey", "level"] },
  idea_liked: { when: "a heart or thumb on an idea", props: ["planId", "ideaKey", "value"] },
  idea_feedback_given: { when: "thumb up or down inside the idea dialog", props: ["planId", "ideaKey", "value"] },
  one_thing_committed: { when: "'Dit ga ik doen' pressed", props: ["planId", "ideaKey", "isOneThing"] },
  wildcard_revealed: { when: "the sealed wildcard opened", props: ["planId"] },
  plan_pdf_downloaded: { when: "the PDF opened", props: ["planId", "source"] },

  // --- sharing
  idea_book_share_clicked: { when: "'Deel je Idea Book' pressed", props: ["url"] },
  idea_book_share_whatsapp_clicked: { when: "the WhatsApp link after sharing clicked", props: [] },
  shared_idea_book_viewed: { when: "a shared book viewed", props: ["planId"] },
  shared_idea_book_cta_clicked: { when: "a button on the shared page clicked", props: ["planId"] },
  invite_card_opened: { when: "the invitation panel opened", props: ["source"] },
  invite_card_shared: { when: "the invitation shared, downloaded or copied", props: ["format", "method", "source"] },

  // --- the tester questionnaire (test preview only)
  test_feedback_submitted: {
    when: "the tester questionnaire sent",
    props: ["flow_score", "profile_score", "doors_score", "door_pick", "door_kind", "would_pay", "has_doubt", "stored"],
  },
} as const satisfies Record<string, AnalyticsEventSpec>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

/** Words a property name must not contain: they would be where personal text goes. */
export const FORBIDDEN_PROPERTY_WORDS = ["text", "title", "label", "place", "location", "name", "email", "age", "note", "answer", "doubt", "reflection"] as const;
