// Shared building blocks for WINDOW's transactional e-mails. E-mail clients
// are unforgiving: table layout, inline styles, no external CSS, no web fonts,
// and no images that must load from our own domain (a localhost/private URL
// would show as a broken image) — so the wordmark is styled text and the only
// "images" are none. Colours are the site's own brand tokens (Warm Walnut),
// spelled out because CSS variables don't exist in e-mail.

export const EMAIL_COLORS = {
  page: "#F7F5F0", // --color-cream
  card: "#FFFDFA", // --color-paper
  ink: "#202020", // --color-ink
  muted: "#77736C", // --color-muted
  border: "#DED8CE", // --color-border
  panel: "#F2ECE1", // --color-surface-active
  accent: "#5B3F2F", // --color-accent
  accentDark: "#3C2920", // --color-accent-dark
  gold: "#B08A4A", // --color-gold
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

export function emailButton(href: string, label: string): string {
  // A padded <a> inside a table cell, the pattern that survives Outlook.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${EMAIL_COLORS.accentDark}" style="border-radius:12px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;color:#FFFDFA;text-decoration:none;border-radius:12px;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

// The outer shell: page background, a centred 600px card, the wordmark on top
// and an optional footer line underneath. `preheader` is the grey preview text
// mail apps show next to the subject.
export function emailShell(params: { preheader: string; bodyHtml: string; footerHtml?: string }): string {
  const { preheader, bodyHtml, footerHtml } = params;
  const c = EMAIL_COLORS;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${c.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.page};">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.page}" style="background:${c.page};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td style="padding:0 4px 20px;font-family:${SERIF};font-size:22px;color:${c.accentDark};letter-spacing:-0.01em;">
          Window<span style="color:${c.gold};font-style:italic;">Into</span>
        </td></tr>
        <tr><td bgcolor="${c.card}" style="background:${c.card};border:1px solid ${c.border};border-radius:18px;padding:32px 28px;font-family:${SANS};color:${c.ink};">
          ${bodyHtml}
        </td></tr>
        ${footerHtml ? `<tr><td style="padding:20px 8px 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${c.muted};">${footerHtml}</td></tr>` : ""}
      </table>
    </td></tr>
  </table>
</body></html>`;
}
