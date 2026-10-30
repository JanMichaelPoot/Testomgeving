import { test, expect } from "@playwright/test";

// Fase 1 of the improvement brief, in a real browser: keyboard use of the image cards, the mobile menu, and the gift link that
// always starts clean.

test.describe("image cards by keyboard", () => {
  test("Space selects a card, Enter selects another, the focus ring is visible and aria-pressed follows", async ({ page }) => {
    await page.goto("/intake");
    const tiles = page.locator("main button[aria-pressed]");
    await tiles.first().waitFor();
    await tiles.first().focus();
    // The focus ring is drawn (a box-shadow ring from focus-visible), not just the default outline.
    const ring = await tiles.first().evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe("none");
    await page.keyboard.press("Space");
    await expect(tiles.first()).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator('main button[aria-pressed="true"]')).toHaveCount(2);
    await page.keyboard.press("Space");
    await expect(page.locator('main button[aria-pressed="true"]')).toHaveCount(1);
  });
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, lists the links, closes on Escape and on a link press", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Menu", exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Menu" });
    await expect(nav.getByRole("link")).toHaveCount(2);
    const size = await nav.getByRole("link").first().boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");
    await expect(nav).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("navigation", { name: "Menu" }).getByRole("link").first().click();
    await expect(page.getByRole("navigation", { name: "Menu" })).toHaveCount(0);
  });

  test("no horizontal scroll on the landing page", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("gift link", () => {
  test("a new arrival never inherits earlier answers; a reload keeps a gift in progress", async ({ page }) => {
    // Someone's own, half-finished intake sits in this tab.
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      sessionStorage.setItem("window-wizard-variant-v4", "images2");
      sessionStorage.setItem(
        "window-venster-draft-images2",
        JSON.stringify({
          v: 3,
          page: 1,
          answers: { associations: ["place-forest-edge"], interestDomains: [], interests: [], intakeFlow: "images2", intakeVariant: "associations", purpose: "self" },
          limitChips: [],
          limitText: "",
          seed: "e2e",
          seen: [],
        }),
      );
    });
    await page.goto("/intake?for=gift&s=first1");
    await page.locator("main button[aria-pressed]").first().waitFor();
    // Fresh: page 1 (the images), nothing chosen, and no pronoun placeholder in the heading.
    await expect(page.locator('main button[aria-pressed="true"]')).toHaveCount(0);
    const heading = await page.locator("main h1, main h2").first().innerText();
    expect(heading).not.toMatch(/diegene|\bthem\b/i);
    // Choose something, reload the same link: the gift in progress stays.
    await page.locator("main button[aria-pressed]").first().click();
    await expect(page.locator('main button[aria-pressed="true"]')).toHaveCount(1);
    await page.waitForTimeout(300);
    await page.reload();
    await page.locator("main button[aria-pressed]").first().waitFor();
    await expect(page.locator('main button[aria-pressed="true"]')).toHaveCount(1);
    // A new arrival (another value) starts clean again.
    await page.goto("/intake?for=gift&s=second2");
    await page.locator("main button[aria-pressed]").first().waitFor();
    await expect(page.locator('main button[aria-pressed="true"]')).toHaveCount(0);
  });
});
