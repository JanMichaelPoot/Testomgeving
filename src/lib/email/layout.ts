// Shared building blocks for WINDOW's transactional e-mails. E-mail clients are unforgiving: table
// layout, inline styles, no external CSS, no web fonts. Images are optional: they load from the public
// site (a localhost or private URL would show as a broken image, so `emailImages` returns null there)
// and every design decision has to survive them being blocked, which many clients do by default.
//
// The palette is the logo's: warm orange and sky blue on white and a very light blue-grey, with a deep
// blue-grey for text. The site itself is walnut, but a mail in that much brown felt heavy (R-feedback,
// 25 oct 2026), so walnut appears nowhere in here.

export const EMAIL_COLORS = {
  page: "#F1F5F9", // the ground behind the card
  card: "#FFFFFF",
  ink: "#1F2A37", // text
  navy: "#17324D", // headings
  muted: "#5B6776", // secondary text, 5.6:1 on white
  border: "#E2E8F0",
  panel: "#F6F8FB", // quiet panels
  blue: "#1F6FB0", // links, eyebrows: 5.2:1 on white
  sky: "#4FA8E0", // the logo's blue, for decoration only
  orange: "#F5A623", // the logo's orange: the button and small accents
  orangeText: "#B36B00", // orange as text on white (4.6:1)
  orangeSoft: "#FFF4E0", // soft orange panel
  skySoft: "#EAF4FC", // soft blue panel
} as const;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const EMAIL_FONTS = { serif: SERIF, sans: SANS } as const;

// Everything that came from a person or from generated text goes through this
// before it lands in the HTML — a title like `<script>` or an `&` must show as
// text, never become markup.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Small capital label above a heading. */
export function emailEyebrow(text: string, color: string = EMAIL_COLORS.blue): string {
  return `<p style="margin:0 0 8px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${escapeHtml(text)}</p>`;
}

export function emailButton(href: string, label: string): string {
  // A padded <a> inside a table cell, the pattern that survives Outlook.
  const c = EMAIL_COLORS;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${c.orange}" style="border-radius:999px;background:${c.orange};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 32px;font-family:${SANS};font-size:16px;font-weight:700;color:${c.navy};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

/**
 * The image URLs a mail can use, or null when the site address is not a public https one (local
 * development, a preview behind a login): then the mail is built without images instead of with
 * broken ones.
 */
export function emailImages(siteUrl: string | undefined): { logo: string; header: string; thumb: (publicPath: string) => string | null } | null {
  if (!siteUrl) return null;
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    return null;
  }
  const local = /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(url.hostname) || url.hostname.endsWith(".local");
  if (url.protocol !== "https:" || local) return null;
  const base = url.origin;
  return {
    logo: `${base}/logo/icon-128.png`,
    header: `${base}/email/header.jpg`,
    // /illustrations/discovery/x.jpg and /illustrations/idea-book/categories/y.jpg have a 240px twin.
    thumb: (publicPath) => {
      const m = publicPath.match(/^\/illustrations\/(discovery|idea-book\/categories)\/([\w-]+\.jpg)$/);
      if (!m) return null;
      return `${base}/email/thumbs/${m[1] === "discovery" ? "discovery" : "categories"}/${m[2]}`;
    },
  };
}

// The outer shell: page background, a centred 600px column, the wordmark on top, the card with an
// optional header image, and an optional footer underneath. `preheader` is the grey preview text mail
// apps show next to the subject.
export function emailShell(params: {
  preheader: string;
  bodyHtml: string;
  footerHtml?: string;
  images?: { logo: string; header: string } | null;
  headerAlt?: string;
}): string {
  const { preheader, bodyHtml, footerHtml, images, headerAlt } = params;
  const c = EMAIL_COLORS;
  const logo = images
    ? `<img src="${escapeHtml(images.logo)}" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:8px;">`
    : "";
  const header = images
    ? `<tr><td style="padding:0;line-height:0;font-size:0;">
          <img src="${escapeHtml(images.header)}" width="600" alt="${escapeHtml(headerAlt ?? "")}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:20px 20px 0 0;">
        </td></tr>`
    : `<tr><td height="6" bgcolor="${c.orange}" style="height:6px;line-height:6px;font-size:0;background:${c.orange};border-radius:20px 20px 0 0;">&nbsp;</td></tr>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head>
<body style="margin:0;padding:0;background:${c.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.page};">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.page}" style="background:${c.page};">
    <tr><td align="center" style="padding:28px 12px 36px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td style="padding:0 6px 16px;font-family:${SERIF};font-size:22px;color:${c.navy};letter-spacing:-0.01em;">
          ${logo}<span style="vertical-align:middle;">Window<span style="color:${c.orange};font-style:italic;">Into</span></span>
        </td></tr>
        ${header}
        <tr><td bgcolor="${c.card}" style="background:${c.card};border:1px solid ${c.border};border-top:0;border-radius:0 0 20px 20px;padding:32px 28px 36px;font-family:${SANS};color:${c.ink};">
          ${bodyHtml}
        </td></tr>
        ${footerHtml ? `<tr><td style="padding:22px 10px 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${c.muted};">${footerHtml}</td></tr>` : ""}
      </table>
    </td></tr>
  </table>
</body></html>`;
}
