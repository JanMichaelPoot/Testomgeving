import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InviteShare } from "@/components/window/InviteShare";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  INVITE_FORMATS,
  INVITE_LOCALES,
  INVITE_PANE_IMAGES,
  inviteCardPath,
  inviteCardSlug,
  inviteHost,
  inviteLink,
  parseInviteCard,
} from "@/lib/shareInvite";
import { existsSync } from "node:fs";
import path from "node:path";

describe("the invitation card", () => {
  it("has a slug that reads back to the same format and language, and nothing else is a card", () => {
    for (const f of INVITE_FORMATS) for (const l of INVITE_LOCALES) expect(parseInviteCard(inviteCardSlug(f, l))).toEqual({ format: f, locale: l });
    for (const bad of ["story", "story-de", "banner-nl", "story-nl-x", "", "../story-nl"]) expect(parseInviteCard(bad)).toBeNull();
    expect(inviteCardPath("story", "nl")).toBe("/share-card/story-nl");
  });

  it("only uses photos that exist, and contains nothing personal (fixed images, no inputs)", () => {
    expect(INVITE_PANE_IMAGES).toHaveLength(4);
    for (const src of INVITE_PANE_IMAGES) expect(existsSync(path.join(process.cwd(), "public", src))).toBe(true);
  });

  it("links to the landing page, tagged by format, whatever slashes the site address ends in", () => {
    expect(inviteLink("https://windowinto.nl/", "story")).toBe("https://windowinto.nl/?utm_source=share_card&utm_medium=story");
    expect(inviteLink("https://windowinto.nl", "square")).toBe("https://windowinto.nl/?utm_source=share_card&utm_medium=square");
  });

  it("prints the real address on the card, and never a local one", () => {
    expect(inviteHost("https://www.windowinto.nl/x")).toBe("www.windowinto.nl");
    expect(inviteHost("http://localhost:3000")).toBe("windowinto.nl");
    expect(inviteHost(undefined)).toBe("windowinto.nl");
    expect(inviteHost("not a url")).toBe("windowinto.nl");
  });

  it("has its copy in both languages", () => {
    const nl = getDictionary("nl").venster.invite;
    const en = getDictionary("en").venster.invite;
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort());
    for (const v of [...Object.values(nl), ...Object.values(en)]) expect(v.trim().length).toBeGreaterThan(0);
  });
});

describe("InviteShare", () => {
  const copy = getDictionary("nl").venster.invite;
  const render = (defaultOpen: boolean) => renderToStaticMarkup(createElement(InviteShare, { locale: "nl", copy, siteUrl: "https://windowinto.nl", source: "page", defaultOpen }));

  it("is a closed button until opened", () => {
    const html = render(false);
    expect(html).toContain(copy.button);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("/share-card/");
  });

  it("when open shows the card, both formats, a download, WhatsApp with the link and copy", () => {
    const html = render(true);
    expect(html).toContain("/share-card/story-nl");
    expect(html).toContain(copy.formatStory);
    expect(html).toContain(copy.formatSquare);
    expect(html).toContain(`download="windowinto-verhaal-nl.jpg"`);
    expect(html).toContain("wa.me/?text=");
    expect(html).toContain(encodeURIComponent("https://windowinto.nl/?utm_source=share_card&utm_medium=story"));
    expect(html).toContain(copy.copyLink);
    // The share-sheet button needs the browser; it is not part of the first render.
    expect(html).not.toContain(copy.share);
  });
});
