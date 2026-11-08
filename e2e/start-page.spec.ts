import { test, expect, type Page } from "@playwright/test";

// The central start page of the two-page intake: who we search for, where, and the few limits, all asked once and first.
// A Dutch browser, so the site opens in Dutch and the labels below match.

const DRAFT = "window-venster-draft-images2";

async function open(page: Page, query = "?wizard=images2", draft?: Record<string, unknown>) {
  await page.addInitScript(
    ([d, key]) => {
      sessionStorage.setItem("window-wizard-variant-v4", "images2");
      if (d && !sessionStorage.getItem(key as string)) sessionStorage.setItem(key as string, JSON.stringify(d));
    },
    [draft ?? null, DRAFT] as const,
  );
  await page.goto(`/intake${query}`);
  await page.getByTestId("wizard-bar").waitFor();
  await page.waitForTimeout(500);
}

const draftAt = (pageIndex: number, answers: Record<string, unknown> = {}, layout?: number) => ({
  v: 3,
  ...(layout ? { layout } : {}),
  page: pageIndex,
  answers: { associations: ["place-forest-edge", "moment-first-dance", "sense-perfume"], interestDomains: [], interests: [], intakeFlow: "images2", intakeVariant: "associations", location: "Utrecht", ...answers },
  limitChips: [],
  limitText: "",
  seed: "e2e",
  seen: [],
});

test.describe("the start page", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

  test("opens first with the three parts; only the place is required", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Een ontdekking begint bij jou");
    // Part A: visual choices (including an explicit "not known yet"), none chosen, each a proper touch target.
    const choices = page.locator("[data-context]");
    await expect(choices).toHaveCount(5);
    await expect(page.locator('[data-context="unknown"]')).toContainText("Nog onbekend");
    await expect(page.getByText(/oudere/i)).toHaveCount(0);
    for (const c of await choices.all()) {
      expect(await c.getAttribute("aria-pressed")).toBe("false");
      expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // Part B and C are there: the place, the distance, the optional limits.
    await expect(page.getByRole("combobox")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Vanuit welke plaats mogen we op ontdekking gaan?" })).toBeVisible();
    // Two sliders: the distance starts at 15 km, the budget (per person) waits until it is touched.
    await expect(page.getByTestId("distance-km-value")).toHaveText("Tot 15 km");
    await expect(page.getByTestId("budget-pp-value")).toContainText("Nog niets gekozen");
    await expect(page.getByText("Wat mag deze ervaring ongeveer kosten per persoon?")).toBeVisible();
    // The chips are grouped under headings.
    for (const heading of ["Omgeving", "Bereikbaarheid", "Gezelschap", "Eten en drinken", "Wanneer"]) await expect(page.getByText(heading, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alleen buiten", exact: true })).toBeVisible();
    // "Wie gaat er mee?" is gone.
    await expect(page.getByText("Wie gaat er mee")).toHaveCount(0);
    // The place is the one required answer.
    const next = page.getByRole("button", { name: "Verder", exact: true });
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#continue-hint")).toHaveText("Vul nog even in: je plaats.");
    await page.getByRole("combobox").fill("Utrecht");
    await expect(next).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#continue-hint")).toBeHidden();
    // No hidden "more options": no expander, no age, no "how", no free text.
    await expect(page.getByText("Meer opgeven")).toHaveCount(0);
    await expect(page.getByText("Hoe oud")).toHaveCount(0);
    await expect(page.locator("#situation-more, #limit-text")).toHaveCount(0);
    // No horizontal scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("searching for another adult with a name changes the wording of the next page", async ({ page }) => {
    await open(page);
    await page.locator('[data-context="adult"]').click();
    await page.getByRole("combobox").fill("Haarlem");
    await page.getByLabel("Hoe heet diegene? Met een naam wordt je boek persoonlijker.").fill("Oma Els");
    await page.getByRole("button", { name: "Verder", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waar gaat de nieuwsgierigheid van Oma Els naar uit?");
  });

  test("choosing a child changes the images and the wording, and 'terug' keeps the answers", async ({ page }) => {
    await open(page);
    await page.locator('[data-context="child"]').click();
    await expect(page.locator('[data-context="child"]')).toHaveAttribute("aria-pressed", "true");
    // Choosing again takes it back: the context is easy to change.
    await page.locator('[data-context="child"]').click();
    await expect(page.locator('[data-context="child"]')).toHaveAttribute("aria-pressed", "false");
    await page.locator('[data-context="child"]').click();
    await page.getByRole("combobox").fill("Haarlem");
    await page.locator("#budget-pp").fill("1");
    await expect(page.getByTestId("budget-pp-value")).toHaveText("Tot €25 per persoon");
    await page.locator("#distance-km").fill("4");
    await expect(page.getByTestId("distance-km-value")).toHaveText("Tot 50 km");
    await page.getByRole("button", { name: "Alleen buiten", exact: true }).click();
    await page.getByRole("button", { name: "Zonder auto bereikbaar", exact: true }).click();
    await page.getByRole("button", { name: "Verder", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waar gaat de nieuwsgierigheid naar uit?");
    // 18 images, none of them chosen yet.
    await expect(page.locator("main button[aria-pressed] img")).toHaveCount(18);
    // Back: everything is still there, nothing is asked again. (In dev, the Next.js indicator floats over the corner of the bar and
    // takes real clicks, so the button gets the click event directly.)
    await page.getByRole("button", { name: "Terug" }).dispatchEvent("click");
    await expect(page.locator('[data-context="child"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox")).toHaveValue("Haarlem");
    await expect(page.getByRole("button", { name: "Alleen buiten", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("distance-km-value")).toHaveText("Tot 50 km");
    await expect(page.getByTestId("budget-pp-value")).toHaveText("Tot €25 per persoon");
    const draft = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "{}"), DRAFT);
    expect(draft.answers.searchContext).toBe("child");
    expect(draft.answers.budget).toBe("25");
    expect(draft.answers.searchDistanceKm).toBe(50);
    expect(draft.answers.searchDistance).toBe("hour");
    expect(draft.answers.company).toEqual([]);
    expect(draft.limitChips).toEqual(expect.arrayContaining(["Alleen buiten", "Zonder auto bereikbaar"]));
    expect(draft.layout).toBe(2);
  });

  test("the later screens never ask for the place or the limits again, and the old situation screen is gone", async ({ page }) => {
    for (const index of [1, 2, 3]) {
      await open(page, "?wizard=images2", draftAt(index, {}, 2));
      await expect(page.locator("#location")).toHaveCount(0);
      await expect(page.getByText("Waar, wanneer en met wie?")).toHaveCount(0);
      await page.evaluate(() => sessionStorage.clear());
    }
  });

  test("a draft from before the start page lands on the matching page", async ({ page }) => {
    // Old order: images (0), concrete (1), situation (2), profile (3).
    await open(page, "?wizard=images2", draftAt(2));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Een ontdekking begint bij jou");
    await expect(page.getByRole("combobox")).toHaveValue("Utrecht");
  });
});
