// The general invitation card people can share (Instagram story, WhatsApp status or chat). It is the
// same for everybody and holds nothing personal: it only invites someone to open their own window.
// The images are made at /share-card/<format>-<locale> (src/app/share-card/[card]/route.tsx).

export const INVITE_FORMATS = ["story", "square"] as const;
export type InviteFormat = (typeof INVITE_FORMATS)[number];
export const INVITE_LOCALES = ["nl", "en"] as const;
export type InviteLocale = (typeof INVITE_LOCALES)[number];

/** Pixel size of each card: 9:16 for stories and statuses, 1:1 for a chat or a post. */
export const INVITE_SIZE: Record<InviteFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/** The four photos in the arch: a calm place, something made, a spark of play, a warm light. Fixed, so the card is the same for everyone. */
export const INVITE_PANE_IMAGES = [
  "/illustrations/associations/place-forest-edge.jpg",
  "/illustrations/associations/moment-clay.jpg",
  "/illustrations/associations/place-arena-lights.jpg",
  "/illustrations/associations/sense-candlelight.jpg",
] as const;

export function inviteCardSlug(format: InviteFormat, locale: InviteLocale): string {
  return `${format}-${locale}`;
}

/** "story-nl" -> { format, locale }; anything else is not a card. */
export function parseInviteCard(slug: string): { format: InviteFormat; locale: InviteLocale } | null {
  const [format, locale, ...rest] = slug.split("-");
  if (rest.length > 0) return null;
  if (!(INVITE_FORMATS as readonly string[]).includes(format) || !(INVITE_LOCALES as readonly string[]).includes(locale)) return null;
  return { format: format as InviteFormat, locale: locale as InviteLocale };
}

export function inviteCardPath(format: InviteFormat, locale: InviteLocale): string {
  return `/share-card/${inviteCardSlug(format, locale)}`;
}

/** The link that goes with the card: the landing page, tagged so we can see where invitations come from. */
export function inviteLink(siteUrl: string, format: InviteFormat): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/?utm_source=share_card&utm_medium=${format}`;
}

/** The address shown on the card itself, without protocol or slash. */
export function inviteHost(siteUrl: string | undefined): string {
  try {
    const host = new URL(siteUrl ?? "").host;
    // A local build must not print its own address on a card that is meant to be shared.
    return !host || /^(localhost|127\.|0\.0\.0\.0)/.test(host) ? "windowinto.nl" : host;
  } catch {
    return "windowinto.nl";
  }
}
