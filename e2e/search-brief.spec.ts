import { test, expect, type Page } from "@playwright/test";

// "Jouw zoekprofiel" on the last screen, right above the order: what the book is searched for, each row with a way back to change it. Shown before anything is
// generated or paid. A Dutch browser, so the site opens in Dutch (the English test asks for English with ?lang=en).

const DRAFT = "window-venster-draft-images2";
const CHOSEN = ["theme-natuur-a", "theme-podium-a", "theme-mode-a", "theme-ambacht-a"];

async function openProfile(page: Page, answers: Record<string, unknown> = {}, query = "") {
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
      ...answers,
    },
    limitChips: [],
    limitText: "",
    seed: "e2e-brief",
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
  await page.getByTestId("search-brief").waitFor();
  await page.waitForTimeout(500);
}

const rowText = (page: Page, id: string) => page.locator(`[data-brief-row="${id}"]`).innerText();

test.describe("the search profile above the order", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("names who, where and how far, time, budget, conditions and choices, and the places it searches", async ({ page }) => {
    await openProfile(page);
    const brief = page.getByTestId("search-brief");
    await expect(brief.getByRole("heading", { level: 2 })).toHaveText("Jouw zoekprofiel");
    expect(await rowText(page, "who")).toContain("Voor mezelf");
    const where = await rowText(page, "where");
    expect(where).toContain("Utrecht, Nederland");
    expect(where).toContain("Binnen 15 km");
    expect(await rowText(page, "time")).toContain("Een halve dag");
    expect(await rowText(page, "budget")).toContain("Tot €50 per persoon");
    expect(await rowText(page, "limits")).toContain("Geen bijzonderheden");
    const picks = await rowText(page, "picks");
    expect(picks).toContain("Pottenbakken");
    expect(picks).toContain("High tea");
    await expect(page.getByTestId("brief-foot")).toHaveText("We zoeken naar echte plekken binnen 15 km van Utrecht.");
  });

  test("sits above the order, so it is read right before paying", async ({ page }) => {
    await openProfile(page);
    const brief = await page.getByTestId("search-brief").boundingBox();
    const order = await page.locator("#bestellen").boundingBox();
    expect(brief && order && brief.y < order.y).toBe(true);
  });

  test("a row's change link goes back to the page where it is answered, and the answers are still there", async ({ page }) => {
    await openProfile(page);
    await page.getByRole("button", { name: "Wijzig: Waar" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Laten we samen iets moois ontdekken");
    await expect(page.locator("#location")).toHaveValue("Utrecht");
  });

  test("the choices row goes back to the activities, and a named person and a child's conditions show", async ({ page }) => {
    await openProfile(page, { searchContext: "child", recipientName: "Noor" });
    expect(await rowText(page, "who")).toContain("Voor Noor (kind)");
    expect(await rowText(page, "limits")).toContain("Alleen wat geschikt is voor kinderen");
    await page.getByRole("button", { name: "Wijzig: Jouw keuzes" }).click();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Dit zien wij in jouw keuzes");
  });
});

test.describe("the search profile in English", () => {
  test.use({ viewport: { width: 1280, height: 900 }, locale: "en-GB" });

  test("is written in English, with the same rows", async ({ page }) => {
    await openProfile(page, {}, "&lang=en");
    const brief = page.getByTestId("search-brief");
    await expect(brief.getByRole("heading", { level: 2 })).toHaveText("Your search profile");
    expect(await rowText(page, "who")).toContain("For myself");
    expect(await rowText(page, "where")).toContain("Utrecht, Netherlands");
    expect(await rowText(page, "budget")).toContain("Up to €50 per person");
    await expect(page.getByTestId("brief-foot")).toHaveText("We search for real places within 15 km of Utrecht.");
  });
});
