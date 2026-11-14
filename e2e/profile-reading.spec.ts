import { test, expect, type Page } from "@playwright/test";

// The results page ("Dit zien wij in jouw keuzes"): a short personal reading in blocks, the images that were chosen, no lists of what
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dit zien wij in jouw keuzes");
    for (const id of ["reading-opening", "reading-thread"]) {
      const text = (await page.getByTestId(id).textContent())?.trim() ?? "";
      expect(text.length, id).toBeGreaterThan(20);
    }
    // One conclusion, not labelled sub-sections, and no question to the visitor.
    await expect(page.getByRole("heading", { name: "De rode draad" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Jouw ontdekkingsrichting" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Zijn we iets vergeten?" })).toHaveCount(0);
    await expect(page.getByTestId("reading-direction")).toHaveCount(0);
    await expect(page.getByTestId("profile-lead")).toContainText("Hierop schrijven we jouw Idea Book");
    // The images that were chosen are part of the page, each with its caption.
    await expect(page.getByTestId("reading-images").locator("li")).toHaveCount(CHOSEN.length);
    // Gone: "Wat ons opviel", the lists, the old teaser, the explanation of the generation and the generic outlook block.
    for (const gone of ["Wat ons opviel", "Hier gaan we naar op zoek", "Dit laten we even liggen", "Eén van je zeven deuren", "Wat je in je boek vindt", "Geschreven met AI"]) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("has no steering controls: no sliders, no 'Bekijk en stuur bij', no 'Iets anders kiezen'", async ({ page }) => {
    await openProfile(page);
    await expect(page.getByRole("button", { name: /Bekijk en stuur bij/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Iets anders kiezen/ })).toHaveCount(0);
    await expect(page.locator("input[type='range']")).toHaveCount(0);
    await expect(page.getByTestId("reading")).toBeVisible();
  });
});

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1280, height: 900 }, locale: "nl-NL" });

  test("the reading and the order stand side by side, so the order is in view at once", async ({ page }) => {
    await openProfile(page);
    const reading = (await page.getByTestId("reading").boundingBox())!;
    const order = (await page.locator("#bestellen").boundingBox())!;
    expect(order.x).toBeGreaterThan(reading.x + reading.width - 5);
    await expect(page.locator("#bestellen")).toBeInViewport();
    // The e-mail panel (larger and framed) follows the price and what you get: it is one short scroll away, not on another page.
    await page.locator("#delivery-email").scrollIntoViewIfNeeded();
    await expect(page.locator("#delivery-email")).toBeInViewport();
    // No cue pointing down: the order is not below.
    await expect(page.getByTestId("order-cue")).toBeHidden();
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

  test("the e-mail address is required: marked, explained, and the pay button waits for it", async ({ page }) => {
    await openProfile(page);
    const pay = page.getByRole("button", { name: /Ja, ik wil mijn Idea Book/ });
    // A red asterisk marks the required fields: the e-mail and both boxes.
    await expect(page.getByText("Velden met een * zijn verplicht.")).toBeVisible();
    await expect(page.locator("label[for='delivery-email']")).toContainText("E-mailadres voor je boek");
    await expect(page.locator("label[for='delivery-email'] span[aria-hidden]")).toHaveText("*");
    await expect(page.locator("#delivery-email")).toHaveAttribute("aria-required", "true");
    await expect(page.locator("main label:has(input[type='checkbox']) span.text-red-700")).toHaveCount(2);
    // Both boxes ticked is not enough without an address.
    await page.locator("main label:has(input[type='checkbox'])").nth(0).click();
    await page.locator("main label:has(input[type='checkbox'])").nth(1).click();
    await expect(pay).toBeDisabled();
    await expect(page.locator("#pay-hint")).toHaveText("Vul een geldig e-mailadres in om te kunnen betalen.");
    // A wrong address shows the validation message and keeps the button off.
    await page.locator("#delivery-email").fill("not-an-address");
    await expect(page.locator("#delivery-email-error")).toHaveText("Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.");
    await expect(page.locator("#delivery-email")).toHaveAttribute("aria-invalid", "true");
    await expect(pay).toBeDisabled();
    // A right address makes it work.
    await page.locator("#delivery-email").fill("iemand@voorbeeld.nl");
    await expect(page.locator("#delivery-email-error")).toHaveCount(0);
    await expect(pay).toBeEnabled();
  });

  test("an empty e-mail shows its message once the field is left", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator("#delivery-email-error")).toHaveCount(0);
    await page.locator("#delivery-email").focus();
    await page.locator("#delivery-email").blur();
    await expect(page.locator("#delivery-email-error")).toBeVisible();
  });
});

// The order block no longer carries the two optional switches, the loose disclaimer, the legal links or the guarantee line, and the e-mail
// field is the framed, larger one. The terms (with their link), the withdrawal notice and the two required boxes stay.
for (const locale of ["nl-NL", "en-US"]) {
  for (const width of [320, 390]) {
    test.describe(`order block at ${width}px in ${locale}`, () => {
      test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true, locale });

      test("is the lean version, stays on screen and scrolls nowhere sideways", async ({ page }) => {
        await openProfile(page);
        await expect(page.locator('main [role="switch"]')).toHaveCount(0);
        await expect(page.locator('main nav[aria-label]')).toHaveCount(0);
        await expect(page.locator("main label:has(input[type='checkbox'])")).toHaveCount(2);
        await expect(page.locator('main a[href="/terms"]')).toHaveCount(1); // only inside the terms checkbox
        await expect(page.locator("#delivery-email")).toBeVisible();
        const emailBox = (await page.locator("#delivery-email").boundingBox())!;
        expect(emailBox.x).toBeGreaterThanOrEqual(0);
        expect(emailBox.x + emailBox.width).toBeLessThanOrEqual(width);
        expect(emailBox.height).toBeGreaterThanOrEqual(52);
        const pay = page.getByRole("button", { name: locale === "nl-NL" ? /Ja, ik wil mijn Idea Book/ : /Yes, I want my Idea Book/ });
        await pay.scrollIntoViewIfNeeded();
        await expect(pay).toContainText(locale === "nl-NL" ? "betaal €7,50" : "pay €7.50");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
}
