import { test, expect, type Page } from "@playwright/test";

// The two image pages of the intake: the question, the "first wide, then sharp" indicator, several selections, and going back through
// the sets that were shown without losing a choice. A Dutch browser, so the site opens in Dutch.

const DRAFT = "window-venster-draft-images2";

async function open(page: Page, pageIndex: number, answers: Record<string, unknown> = {}) {
  const draft = {
    v: 3,
    layout: 2,
    page: pageIndex,
    answers: {
      associations: ["place-forest-edge", "moment-first-dance", "sense-perfume"],
      interestDomains: [],
      interests: [],
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
      timeAvailable: "",
      budget: "",
      effort: "some",
      solutionTypes: ["activity"],
      mustHaves: "",
      preferences: "",
      personalReflection: "",
      ...answers,
    },
    limitChips: [],
    limitText: "",
    seed: "e2e-pages",
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
  await page.getByTestId("wizard-bar").waitFor();
  await page.waitForTimeout(500);
}

test.describe("the images page", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("asks about curiosity, keeps the calm subtitle, and shows the wide-then-sharp indicator", async ({ page }) => {
    await open(page, 1, { associations: [] });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waar gaat jouw nieuwsgierigheid naar uit?");
    await expect(page.getByText("Kies wat je aanspreekt zonder er verder lang over na te denken.")).toBeVisible();
    await expect(page.getByText("Er zijn geen goede of foute antwoorden.")).toBeVisible();
    const flow = page.getByTestId("discovery-flow");
    await expect(flow).toBeVisible();
    await expect(flow.locator('[data-active="true"]')).toContainText("Breed ontdekken");
    await expect(flow.locator('[data-active="false"]')).toContainText("Richting bepalen");
    // Compact: it takes one row, not a block of explanation.
    expect((await flow.boundingBox())!.height).toBeLessThan(80);
    await expect(page.locator("main button[aria-pressed] img")).toHaveCount(18);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("going back to an earlier set of images keeps everything that was chosen", async ({ page }) => {
    await open(page, 1, { associations: [] });
    const tiles = page.locator("main button[aria-pressed]:has(img)");
    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await expect(page.getByText("2 gekozen")).toBeVisible();
    await expect(page.getByTestId("set-prev")).toHaveCount(0);
    await page.getByTestId("set-more").click();
    await expect(page.getByTestId("set-counter")).toHaveText("Set 2 van 2");
    await tiles.nth(0).click();
    await expect(page.getByText("3 gekozen")).toBeVisible();
    await page.getByTestId("set-prev").click();
    await expect(page.getByTestId("set-counter")).toHaveText("Set 1 van 2");
    // The two chosen in set 1 are still marked, and the count did not change.
    await expect(page.locator('main button[aria-pressed="true"]:has(img)')).toHaveCount(2);
    await expect(page.getByText("3 gekozen")).toBeVisible();
    await page.getByTestId("set-next").click();
    await expect(page.getByTestId("set-counter")).toHaveText("Set 2 van 2");
    // What was chosen is carried into the newer set too ("Wat je koos blijft staan"), so all three are marked there.
    await expect(page.locator('main button[aria-pressed="true"]:has(img)')).toHaveCount(3);
  });
});

test.describe("the activities page", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("says where the activities come from, allows many choices and shows how many", async ({ page }) => {
    await open(page, 2);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Van jouw associaties naar nieuwe mogelijkheden");
    await expect(page.getByText("Op basis van jouw keuzes hebben we activiteiten samengesteld die aansluiten bij jouw interesses.")).toBeVisible();
    await expect(page.getByText("Sommige herkenbaar, andere misschien verrassend nieuw.")).toBeVisible();
    await expect(page.getByTestId("discovery-flow").locator('[data-active="true"]')).toContainText("Richting bepalen");
    await expect(page.getByText("Kies er zoveel als je wilt, tot 8.")).toBeVisible();
    const tiles = page.locator("main button[aria-pressed]:has(img)");
    for (let i = 0; i < 7; i++) await tiles.nth(i).click();
    await expect(page.getByText("7 gekozen")).toBeVisible();
    // Seven is not a limit: an eighth works, a ninth is declined with a message, and the eighth stays.
    await tiles.nth(7).click();
    await expect(page.getByText("8 gekozen")).toBeVisible();
    await tiles.nth(8).click();
    await expect(page.getByRole("status")).toContainText("Dat zijn er 8.");
    await expect(page.getByText("8 gekozen")).toBeVisible();
  });

  test("back to an earlier set of activities, and back to the images, never loses a choice", async ({ page }) => {
    await open(page, 2);
    const tiles = page.locator("main button[aria-pressed]:has(img)");
    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await page.getByTestId("set-more").click();
    await expect(page.getByTestId("set-counter")).toHaveText("Set 2 van 2");
    await tiles.nth(2).click();
    await expect(page.getByText("3 gekozen")).toBeVisible();
    await page.getByTestId("set-prev").click();
    await expect(page.getByTestId("set-counter")).toHaveText("Set 1 van 2");
    await expect(page.locator('main button[aria-pressed="true"]:has(img)')).toHaveCount(2);
    // The Back button names where it goes; the images and the choices on both pages are intact afterwards.
    const back = page.getByRole("button", { name: "Terug naar de beelden" });
    await expect(back).toBeVisible();
    await back.dispatchEvent("click");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waar gaat jouw nieuwsgierigheid naar uit?");
    await expect(page.getByText("3 gekozen")).toBeVisible();
    await page.getByRole("button", { name: "Verder", exact: true }).dispatchEvent("click");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Van jouw associaties naar nieuwe mogelijkheden");
    await expect(page.getByText("3 gekozen")).toBeVisible();
    const draft = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "{}"), DRAFT);
    expect(draft.answers.interests).toHaveLength(3);
  });
});
