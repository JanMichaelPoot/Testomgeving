import { test, expect, type Page } from "@playwright/test";

// The start page chips "Met jonge kinderen", "Met de rolstoel bereikbaar" and "Rustig tempo" decide which activities page 2 offers:
// what is known not to suit them (src/lib/discovery/suitability.ts) is never shown, also not after "Andere activiteiten".
// A Dutch browser, a phone.

const DRAFT = "window-venster-draft-images2";

async function open(page: Page, pageIndex: number, limitChips: string[]) {
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
    },
    limitChips,
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

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "nl-NL" });

async function allOffered(page: Page): Promise<string[]> {
  const seen = new Set<string>();
  const collect = async () => {
    for (const alt of await page.locator("main button[aria-pressed]:has(img)").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent || ""))) seen.add(alt);
  };
  await collect();
  for (let i = 0; i < 4; i++) {
    const more = page.getByTestId("set-more");
    if (!(await more.isVisible().catch(() => false))) break;
    await more.click();
    await page.waitForTimeout(200);
    await collect();
  }
  return [...seen];
}

test("the activities page without a need still offers what the needs would leave out", async ({ page }) => {
  await open(page, 2, []);
  await expect(page.locator("main button[aria-pressed]:has(img)")).toHaveCount(18);
});

test("with young children, a wheelchair and a calm pace, page 2 offers a full set without the known conflicts", async ({ page }) => {
  await open(page, 2, ["Met jonge kinderen", "Met de rolstoel bereikbaar", "Rustig tempo"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dit past bij jouw beelden: waar heb je zin in?");
  expect(await page.locator("main button[aria-pressed]:has(img)").count()).toBeGreaterThanOrEqual(12);
  const offered = (await allOffered(page)).join(" | ");
  expect(offered.length).toBeGreaterThan(0);
  // A few ids that every need rules out (supervised, heavy, climbing, adults only).
  expect(offered).not.toMatch(/mountainbik|klimmen|boulderen|urbex|abseilen|buurtvrijwilliger|boogparcours|vrije val|bungee/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("with no alcohol, few stimuli and meeting people, page 2 offers a full set without drinking, noise or solitude", async ({ page }) => {
  await open(page, 2, ["Zonder alcohol", "Rustig en voorspelbaar", "Mensen ontmoeten"]);
  expect(await page.locator("main button[aria-pressed]:has(img)").count()).toBeGreaterThanOrEqual(12);
  const offered = (await allOffered(page)).join(" | ");
  expect(offered.length).toBeGreaterThan(0);
  expect(offered).not.toMatch(/bier brouwen|wijn proeven|cocktails|borrel|karaoke|festival|stand-up|niets doen/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("without Dutch, page 2 offers a full set without what is done in Dutch", async ({ page }) => {
  await open(page, 2, ["Zonder Nederlands"]);
  expect(await page.locator("main button[aria-pressed]:has(img)").count()).toBeGreaterThanOrEqual(12);
  const offered = (await allOffered(page)).join(" | ");
  expect(offered.length).toBeGreaterThan(0);
  expect(offered).not.toMatch(/stand-up|poetry|debatclub|voedselbank|buurtvrijwilliger|genealogie|volksuniversiteit|leesclub/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
