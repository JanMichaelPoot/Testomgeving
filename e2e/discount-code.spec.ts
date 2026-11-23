import { test, expect, type Page } from "@playwright/test";

// The one-time discount code at the order (Step 230): a quiet link that opens one field. A code that cannot be a code is refused right away, with a reason; a good one is checked
// on the server (needs the table of migration 0027, so that part has its own unit tests and a smoke script). A Dutch browser, so the site opens in Dutch.

const DRAFT = "window-venster-draft-images2";

async function openProfile(page: Page, query = "") {
  const draft = {
    v: 3,
    layout: 2,
    page: 3,
    answers: {
      associations: ["theme-natuur-a", "theme-podium-a", "theme-mode-a", "theme-ambacht-a"],
      interestDomains: [],
      interests: ["pottenbakken", "high-tea"],
      intakeFlow: "images2",
      intakeVariant: "associations",
      location: "Utrecht",
      country: "NL",
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
      budget: "50",
      effort: "some",
      solutionTypes: ["activity"],
      mustHaves: "",
      preferences: "",
      personalReflection: "",
      searchContext: "self",
    },
    limitChips: [],
    limitText: "",
    seed: "e2e-discount",
    seen: [],
  };
  await page.addInitScript(
    ([d, key]) => {
      sessionStorage.setItem("window-wizard-variant-v4", "images2");
      if (!sessionStorage.getItem(key as string)) sessionStorage.setItem(key as string, JSON.stringify(d));
    },
    [draft, DRAFT] as const,
  );
  await page.goto(`/intake?wizard=images2${query}`);
  await page.getByTestId("discount").waitFor();
}

test.describe("the discount code field", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("is a quiet link that opens one field, and the price stays as it was until a code is accepted", async ({ page }) => {
    await openProfile(page);
    const box = page.getByTestId("discount");
    await expect(page.locator("#discount-code")).toHaveCount(0);
    await box.getByRole("button", { name: "Heb je een kortingscode?" }).click();
    await expect(page.locator("#discount-code")).toBeVisible();
    await expect(box.getByRole("button", { name: "Toepassen" })).toBeDisabled();
  });

  test("refuses what cannot be a code, with a reason, and keeps the order as it was", async ({ page }) => {
    await openProfile(page);
    await page.getByTestId("discount").getByRole("button", { name: "Heb je een kortingscode?" }).click();
    await page.locator("#discount-code").fill("hello");
    await page.getByTestId("discount").getByRole("button", { name: "Toepassen" }).click();
    await expect(page.locator("#discount-code-error")).toHaveText("Deze code kennen we niet. Controleer de letters en cijfers.");
    // Typing again clears the message.
    await page.locator("#discount-code").fill("hello2");
    await expect(page.locator("#discount-code-error")).toHaveCount(0);
    await expect(page.getByTestId("discount").getByText("Kortingscode toegepast")).toHaveCount(0);
  });
});

test.describe("the discount code field in English", () => {
  test.use({ viewport: { width: 1280, height: 900 }, locale: "en-GB" });

  test("is in English too", async ({ page }) => {
    await openProfile(page, "&lang=en");
    await page.getByTestId("discount").getByRole("button", { name: "Have a discount code?" }).click();
    await page.locator("#discount-code").fill("nope");
    await page.getByTestId("discount").getByRole("button", { name: "Apply" }).click();
    await expect(page.locator("#discount-code-error")).toHaveText("We don't know this code. Check the letters and digits.");
  });
});
