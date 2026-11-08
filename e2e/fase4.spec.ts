import { test, expect } from "@playwright/test";

// Fase 4 of the improvement brief in a real browser: the follow-up e-mail's unsubscribe and follow-up links, and the gift voucher that used to
// live here is gone for good (its pages must not exist any more).

test.use({ locale: "nl-NL" });

test.describe("links", () => {
  test("the gift voucher is gone: no pages, no card route, nothing on the landing page or in the sitemap", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/cadeaubon"]')).toHaveCount(0);
    await expect(page.getByText(/cadeau/i)).toHaveCount(0);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/cadeaubon");
    for (const path of ["/cadeaubon", "/cadeaubon/klaar", "/cadeau", "/cadeau/WIN-K7QM-4XRT-9PDH"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    expect((await request.get("/api/cadeaubon/kaart?code=WIN-K7QM-4XRT-9PDH")).status()).toBe(404);
  });

  test("an unsubscribe or follow-up link that does not verify does nothing harmful", async ({ page, request }) => {
    await page.goto("/afmelden?t=nonsense");
    await expect(page.getByRole("status")).toContainText("werkt niet");
    const response = await request.get("/nieuw-venster?t=nonsense", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/\/intake$/);
    expect(response.headers()["set-cookie"] ?? "").not.toContain("window_avoid");
  });
});
