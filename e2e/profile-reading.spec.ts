import { test, expect, type Page } from "@playwright/test";

// The results page ("Wat jouw keuzes ons vertellen"): a short personal reading in blocks, the images that were chosen, no lists of what
// we look for and leave out, no "Wat ons opviel". A Dutch browser, so the site opens in Dutch.

const DRAFT = "window-venster-draft-images2";
const CHOSEN = ["place-forest-edge", "moment-first-dance", "sense-perfume", "place-workshop"];

async function openProfile(page: Page, answers: Record<string, unknown> = {}) {
  const draft = {
    v: 3,
    layout: 2,
    page: 3,
    answers: {
      associations: CHOSEN,
      interestDomains: [],
      interests: ["pottenbakken", "high-tea"],
      intakeFlow: "images2",
      intakeVariant: "associations",
      location: "Utrecht",
      searchDistance: "city",
      searchDistanceKm: 15,
      company: [],
      purpose: "self",
      situation: "",
      purposeFollowUp: "",
      ageCategory: "",
      freeTimePattern: "",
      practicalToWild: "either",
      timeAvailable: "halfday",
      budget: "25",
      effort: "some",
      solutionTypes: ["activity"],
      mustHaves: "",
      preferences: "",
      personalReflection: "",
      searchContext: "self",
      ...answers,
    },
    limitChips: [],
    limitText: "",
    seed: "e2e-profile",
    seen: [],
  };
  await page.addInitScript(
    ([d, key]) => {
      sessionStorage.setItem("window-wizard-variant-v4", "images2");
      if (!sessionStorage.getItem(key as string)) sessionStorage.setItem(key as string, JSON.stringify(d));
    },
    [draft, DRAFT] as const,
  );
  await page.goto("/intake?wizard=images2");
  await page.getByTestId("reading").waitFor();
  await page.waitForTimeout(600);
}

test.describe("the results page", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("is a short reading in blocks with the images chosen, and none of the old lists", async ({ page }) => {
    await openProfile(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wat jouw keuzes ons vertellen");
    for (const id of ["reading-opening", "reading-thread", "reading-direction", "reading-outlook"]) {
      const text = (await page.getByTestId(id).textContent())?.trim() ?? "";
      expect(text.length, id).toBeGreaterThan(20);
    }
    await expect(page.getByRole("heading", { name: "De rode draad" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jouw ontdekkingsrichting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wat je in je boek vindt" })).toBeVisible();
    await expect(page.getByTestId("reading-outlook")).toContainText("zes ideeën");
    // The images that were chosen are part of the page, each with its caption.
    await expect(page.getByTestId("reading-images").locator("li")).toHaveCount(CHOSEN.length);
    // Gone: "Wat ons opviel", the lists of what is sought and left out, and the old teaser.
    for (const gone of ["Wat ons opviel", "Hier gaan we naar op zoek", "Dit laten we even liggen", "Eén van je zeven deuren"]) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("the sliders and extra themes wait behind 'Bekijk en stuur bij'", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator("#axis-social")).toBeHidden();
    await page.getByRole("button", { name: /Bekijk en stuur bij/ }).click();
    await expect(page.locator("#axis-social")).toBeVisible();
    await expect(page.getByTestId("reading")).toBeVisible();
  });
});

test.describe("the order block", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("says that the order is below, and the cue and the bar button both lead there", async ({ page }) => {
    await openProfile(page);
    const cue = page.getByTestId("order-cue");
    await expect(cue).toContainText("Ga verder om jouw ontdekkingsboek te bestellen");
    // The bar offers a way down while the order is out of view.
    const toOrder = page.getByTestId("to-order");
    await expect(toOrder).toBeVisible();
    expect((await toOrder.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await toOrder.dispatchEvent("click");
    await expect(page.locator("#bestellen")).toBeInViewport();
    // Once the order is on screen the button has done its job.
    await expect(toOrder).toBeHidden();
  });

  test("the e-mail address is plainly optional and the gift fields exist only while it is a gift", async ({ page }) => {
    await openProfile(page);
    await expect(page.getByText("E-mailadres voor je boek (optioneel)")).toBeVisible();
    await expect(page.getByText("Je hoeft hier niets in te vullen.")).toBeVisible();
    // Without an address, ticking the two boxes is enough to pay.
    await page.locator("main label:has(input[type='checkbox'])").nth(0).click();
    await page.locator("main label:has(input[type='checkbox'])").nth(1).click();
    await expect(page.getByRole("button", { name: /Betalen en mijn PDF ontvangen/ })).toBeEnabled();
    await expect(page.locator("#gift-email")).toHaveCount(0);
    await page.locator("#gift-switch").click();
    await expect(page.locator("#gift-email")).toBeVisible();
    // The recipient's address is then needed, and the delivery field gives way to it.
    await expect(page.locator("#delivery-email")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Betalen en mijn PDF ontvangen/ })).toBeDisabled();
    await page.locator("#gift-email").fill("oma@example.com");
    await expect(page.getByRole("button", { name: /Betalen en mijn PDF ontvangen/ })).toBeEnabled();
    await page.locator("#gift-switch").click();
    await expect(page.locator("#gift-email")).toHaveCount(0);
  });
});

// The three switches (gift, memory, follow-up) must stay inside the screen at every phone width, in both languages and with all three on.
for (const locale of ["nl-NL", "en-US"]) {
  for (const width of [320, 360, 390]) {
    test.describe(`switches at ${width}px in ${locale}`, () => {
      test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true, locale });

      test("all three stay on screen and nothing scrolls sideways", async ({ page }) => {
        await openProfile(page);
        for (const id of ["gift", "memory", "followup"]) await page.locator(`#${id}-switch`).click();
        for (const id of ["gift", "memory", "followup"]) {
          await expect(page.locator(`#${id}-switch`)).toHaveAttribute("aria-checked", "true");
          const box = (await page.locator(`#${id}-switch`).boundingBox())!;
          expect(box.x, id).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, id).toBeLessThanOrEqual(width);
          expect(box.width, id).toBeGreaterThanOrEqual(44);
        }
        await expect(page.locator("#gift-email")).toBeVisible();
        const emailBox = (await page.locator("#gift-email").boundingBox())!;
        expect(emailBox.x + emailBox.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
}
