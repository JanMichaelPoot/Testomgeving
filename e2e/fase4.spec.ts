import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Fase 4 of the improvement brief in a real browser: the gift voucher pages (buy, enter a code, a code's own page), the unsubscribe and follow-up
// links, and the phone widths. The checks that need a paid voucher (the redeem flow itself) are covered by unit tests against an in-memory database
// (src/app/cadeau/actions.test.ts) and by scripts/voucher-smoke.ts against the real one; a browser cannot pay with a test card on its own.
// With E2E_SCREENSHOTS=1 it also writes screenshots into docs/fase-4-screens/.

test.use({ locale: "nl-NL" });

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function tooSmall(page: Page, selector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      })
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.h < 44);
  }, selector);
}

for (const width of [360, 390, 430]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("the voucher page: price, form, no horizontal scroll, and the pay button waits for both consents", async ({ page }) => {
      await page.goto("/cadeaubon");
      await expect(page.locator("h1")).toContainText("Geef iemand een venster vol mogelijkheden");
      await expect(page.getByText("€14,95").first()).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      const pay = page.getByRole("button", { name: /Koop de cadeaubon/ });
      await expect(pay).toBeDisabled();
      // Each of the two consents alone is not enough.
      await page.getByText("Ik vraag om directe levering").click();
      await expect(pay).toBeDisabled();
      await page.getByText("gelezen en accepteer deze.").click();
      await expect(pay).toBeEnabled();
      // A wrong e-mail address blocks it again; an empty one does not.
      await page.getByLabel("Naar welk e-mailadres sturen we de bon?").fill("not-an-address");
      await expect(pay).toBeDisabled();
      await page.getByLabel("Naar welk e-mailadres sturen we de bon?").fill("");
      await expect(pay).toBeEnabled();
      expect(await tooSmall(page, "main button, main form > p a, main input:not(.sr-only), main textarea")).toEqual([]);
    });

    test("entering a code: a typo is refused on the spot, a well-formed unknown code gets its own plain page", async ({ page }) => {
      await page.goto("/cadeau");
      await expect(page.locator("h1")).toContainText("Heb je een cadeaubon?");
      await page.getByLabel("Je code").fill("hello");
      await page.getByRole("button", { name: "Controleer de code" }).click();
      await expect(page).toHaveURL(/\/cadeau\?error=invalid/);
      await expect(page.locator("main [role=alert]")).toContainText("lijkt niet te kloppen");

      await page.getByLabel("Je code").fill("win k7qm 4xrt 9pdh");
      await page.getByRole("button", { name: "Controleer de code" }).click();
      await expect(page).toHaveURL(/\/cadeau\/WIN-K7QM-4XRT-9PDH$/);
      await expect(page.locator("main [role=alert]")).toContainText("kennen deze code niet");
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  });
}

test.describe("links", () => {
  test("the voucher is one click away from the header, the footer and the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Of geef een cadeaubon/ })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Cadeaubon" })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Cadeaubon" })).toBeVisible();
    await page.getByRole("link", { name: /Of geef een cadeaubon/ }).click();
    await expect(page).toHaveURL(/\/cadeaubon$/);
  });

  test("the English voucher page", async ({ page, context }) => {
    await context.addCookies([{ name: "window_locale", value: "en", url: "http://localhost:3000" }]);
    await page.goto("/cadeaubon");
    await expect(page.locator("h1")).toContainText("Give someone a window full of possibilities");
    await expect(page.getByText("€14.95").first()).toBeVisible();
  });

  test("a page for a code that does not exist, and one without a payment, do not crash", async ({ page }) => {
    await page.goto("/cadeaubon/klaar");
    await expect(page.getByText("We konden bij deze betaling geen cadeaubon vinden")).toBeVisible();
    const response = await page.goto("/cadeau/not-a-code");
    expect(response?.status()).toBe(200);
    await expect(page.locator("main [role=alert]")).toContainText("lijkt niet te kloppen");
  });

  test("the card download refuses a code that is not an active voucher", async ({ request }) => {
    expect((await request.get("/api/cadeaubon/kaart?code=WIN-K7QM-4XRT-9PDH")).status()).toBe(404);
    expect((await request.get("/api/cadeaubon/kaart")).status()).toBe(404);
  });

  test("an unsubscribe or follow-up link that does not verify does nothing harmful", async ({ page, request }) => {
    await page.goto("/afmelden?t=nonsense");
    await expect(page.getByRole("status")).toContainText("werkt niet");
    const response = await request.get("/nieuw-venster?t=nonsense", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/\/intake$/);
    expect(response.headers()["set-cookie"] ?? "").not.toContain("window_avoid");
  });

  test("the voucher pages stay out of search results, the selling page does not", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /cadeau/");
    expect(robots).toContain("Disallow: /cadeaubon/klaar");
    expect(robots).not.toMatch(/Disallow: \/cadeaubon\s/);
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/cadeaubon");
  });
});

// --- screenshots for the pull request (opt-in)
const SHOTS = path.join(process.cwd(), "docs", "fase-4-screens");

test.describe("screenshots", () => {
  test.skip(!process.env.E2E_SCREENSHOTS, "set E2E_SCREENSHOTS=1 to write the pull request screenshots");
  test.use({ viewport: { width: 390, height: 844 } });

  test("the voucher pages at 390 px", async ({ page }) => {
    await page.goto("/cadeaubon");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, "01-cadeaubon-top.jpg"), type: "jpeg", quality: 60 });
    await page.locator("form").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "02-cadeaubon-form.jpg"), type: "jpeg", quality: 60 });
    await page.goto("/cadeau");
    await page.screenshot({ path: path.join(SHOTS, "03-cadeau-code.jpg"), type: "jpeg", quality: 60 });
  });
});
