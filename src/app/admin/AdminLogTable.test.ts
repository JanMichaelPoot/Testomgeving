import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminLogTable, countryLabel, type AdminLogRow } from "./AdminLogTable";

const row = (over: Partial<AdminLogRow> = {}): AdminLogRow => ({
  id: "1", createdAt: "2026-11-12T10:00:00Z", locale: "nl", situation: "x", purpose: "self", budget: "25", ideaCount: 6, wildcardTitle: "w",
  emailDelivered: true, ordererCountry: "NL", ordererCity: "Utrecht", ...over,
});

describe("the admin log table", () => {
  it("names the country in Dutch and shows the place, in their own columns", () => {
    const html = renderToStaticMarkup(createElement(AdminLogTable, { rows: [row(), row({ id: "2", ordererCountry: "DE", ordererCity: "Köln" })] }));
    expect(html).toContain(">Land<");
    expect(html).toContain(">Plaats<");
    expect(html).toContain("Nederland");
    expect(html).toContain("Utrecht");
    expect(html).toContain("Duitsland");
    expect(html).toContain("Köln");
  });

  it("shows a dash for an entry without a hint (from before the migration, or a local run)", () => {
    const html = renderToStaticMarkup(createElement(AdminLogTable, { rows: [row({ ordererCountry: "", ordererCity: "" })] }));
    expect(html).not.toContain("Nederland");
    expect(countryLabel("")).toBe("");
    expect(html.match(/—/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to the code for something the browser does not know", () => {
    expect(countryLabel("NL")).toBe("Nederland");
    expect(countryLabel("zzzz")).toBe("zzzz");
  });
});
