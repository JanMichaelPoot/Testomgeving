import { test, expect } from "@playwright/test";

// The whole journey, as a visitor goes through it: landing, start page, images, activities, the results page with the order block.
// It never presses the pay button (nothing is paid, nothing is stored): it stops at the order block and checks it is complete and reachable.
// Phone, tablet and computer. A Dutch browser.

const sizes = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "computer", width: 1280, height: 800, touch: false },
];

for (const size of sizes) {
  test.describe(`the journey on a ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch && size.width < 800, locale: "nl-NL" });

    test("from the landing page to the order block, with nothing sideways and nothing lost on the way back", async ({ page }) => {
      const noSideways = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // The next/back buttons sit in a bar the Next dev indicator can overlap: press them through the DOM, as the other specs do.
      const press = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).dispatchEvent("click");

      // 1. Landing: the new line and one way in.
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("WindowInto");
      await expect(page.getByText("Wat als je iets ontdekt")).toBeVisible();
      await noSideways();
      await page.getByRole("link", { name: /Kijk door het venster/ }).first().click();
      await expect(page).toHaveURL(/\/intake/);

      // 2. Start page: who, where (a place is the one required answer), the two sliders, the grouped limits.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Een ontdekking begint bij jou");
      await page.locator('[data-context="self"]').click();
      await page.locator("#location").fill("Utrecht");
      await page.locator("#distance-km").fill("3");
      await expect(page.getByTestId("distance-km-value")).toHaveText("Tot 25 km");
      await page.locator("#budget-pp").fill("2");
      await expect(page.getByTestId("budget-pp-value")).toHaveText("Tot €50 per persoon");
      await page.getByRole("button", { name: "Alleen buiten", exact: true }).click();
      await noSideways();
      await press("Verder");

      // 3. Images: the question, the indicator, five picks.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welke beelden maken jou nieuwsgierig?");
      await expect(page.getByTestId("discovery-flow")).toBeVisible();
      const images = page.locator("main button[aria-pressed]:has(img)");
      for (let i = 0; i < 5; i++) await images.nth(i).click();
      await expect(page.getByText("5 gekozen")).toBeVisible();
      await noSideways();
      await press("Verder");

      // 4. Activities: the new title, several choices.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Van jouw associaties naar nieuwe mogelijkheden");
      const activities = page.locator("main button[aria-pressed]:has(img)");
      for (let i = 0; i < 4; i++) await activities.nth(i).click();
      await expect(page.getByText("4 gekozen")).toBeVisible();
      await noSideways();

      // Back to the images and forward again: every choice is still there.
      await page.getByRole("button", { name: "Terug naar de beelden" }).dispatchEvent("click");
      await expect(page.getByText("5 gekozen")).toBeVisible();
      await press("Verder");
      await expect(page.getByText("4 gekozen")).toBeVisible();
      await press("Verder");

      // 5. Results page: the reading, then the order block, complete and reachable. The pay button is never pressed.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wat jouw keuzes ons vertellen");
      await expect(page.getByTestId("reading-opening")).not.toBeEmpty();
      await expect(page.getByTestId("reading-images").locator("li")).toHaveCount(5);
      await noSideways();
      if (size.width >= 1024) {
        // Two columns: the order block stands next to the reading, in view straight away, so there is no cue.
        await expect(page.getByTestId("order-cue")).toBeHidden();
        await expect(page.locator("#bestellen")).toBeInViewport();
      } else {
        await expect(page.getByTestId("order-cue")).toContainText("Ga verder om jouw ontdekkingsboek te bestellen");
        await page.getByTestId("order-cue").click();
        await expect(page.locator("#bestellen")).toBeInViewport();
      }
      const pay = page.getByRole("button", { name: /Betalen en mijn PDF ontvangen/ });
      await pay.scrollIntoViewIfNeeded();
      await expect(pay).toBeDisabled();
      // The e-mail is required (red asterisk, required for a screen reader) and blocks paying until it is valid; the two boxes come on top of that.
      const email = page.locator("#delivery-email");
      await expect(page.locator('label[for="delivery-email"]')).toContainText("E-mailadres voor je boek");
      await expect(email).toHaveAttribute("aria-required", "true");
      await email.fill("geen-adres");
      await expect(page.locator("#delivery-email-error")).toBeVisible();
      await expect(pay).toBeDisabled();
      await email.fill("lezer@example.com");
      await expect(page.locator("#delivery-email-error")).toHaveCount(0);
      await expect(pay).toBeDisabled(); // still the two boxes
      for (const id of ["memory", "followup"]) {
        const box = (await page.locator(`#${id}-switch`).boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      }
      await noSideways();
    });
  });
}
