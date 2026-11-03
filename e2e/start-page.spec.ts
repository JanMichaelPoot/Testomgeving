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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Laten we beginnen met een paar dingen");
    // Part A: five visual choices, none chosen, each a proper touch target.
    const choices = page.locator("[data-context]");
    await expect(choices).toHaveCount(4);
    await expect(page.getByText(/oudere/i)).toHaveCount(0);
    for (const c of await choices.all()) {
      expect(await c.getAttribute("aria-pressed")).toBe("false");
      expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // Part B and C are there: the place, the distance, the optional limits.
    await expect(page.getByRole("combobox")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tot €25", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alleen buiten", exact: true })).toBeVisible();
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

  test("a gift opens it without 'voor mezelf', and the choice changes the wording of the next page", async ({ page }) => {
    await open(page, "?wizard=images2&for=gift&s=e2e-1");
    await expect(page.locator('[data-context="self"]')).toHaveCount(0);
    await expect(page.locator("[data-context]")).toHaveCount(3);
    await page.locator('[data-context="adult"]').click();
    await page.getByRole("combobox").fill("Haarlem");
    await page.getByLabel("Hoe heet diegene? Met een naam wordt je boek persoonlijker.").fill("Oma Els");
    await page.getByRole("button", { name: "Verder", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welke beelden zouden Oma Els nieuwsgierig maken?");
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
    await page.getByRole("button", { name: "Tot €25", exact: true }).click();
    await page.getByRole("button", { name: "Alleen buiten", exact: true }).click();
    await page.getByRole("button", { name: "Zonder auto bereikbaar", exact: true }).click();
    await page.getByRole("button", { name: "Verder", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welke beelden zouden nieuwsgierig maken?");
    // 18 images, none of them chosen yet.
    await expect(page.locator("main button[aria-pressed] img")).toHaveCount(18);
    // Back: everything is still there, nothing is asked again. (In dev, the Next.js indicator floats over the corner of the bar and
    // takes real clicks, so the button gets the click event directly.)
    await page.getByRole("button", { name: "Terug" }).dispatchEvent("click");
    await expect(page.locator('[data-context="child"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox")).toHaveValue("Haarlem");
    await expect(page.getByRole("button", { name: "Alleen buiten", exact: true })).toHaveAttribute("aria-pressed", "true");
    const draft = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "{}"), DRAFT);
    expect(draft.answers.searchContext).toBe("child");
    expect(draft.answers.budget).toBe("25");
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Laten we beginnen met een paar dingen");
    await expect(page.getByRole("combobox")).toHaveValue("Utrecht");
  });
});
