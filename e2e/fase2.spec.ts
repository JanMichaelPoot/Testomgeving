import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Fase 2 of the improvement brief in a real browser: the positioning, sample and FAQ sections on phone widths (no horizontal scroll, tap
// targets of 44 px on the controls that matter), the lightbox by keyboard, and the guarantee at the pay button. With E2E_SCREENSHOTS=1
// it also writes a screenshot of the landing page and of every intake step at 390 px into docs/fase-2-screens/.

const WIDTHS = [360, 390, 430];

// The site starts in the language of the browser when nothing is chosen: these tests read the Dutch copy.
test.use({ locale: "nl-NL" });

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function tooSmall(page: Page, selector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden";
      })
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.h < 44);
  }, selector);
}

for (const width of WIDTHS) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("landing page: no horizontal scroll, the new sections are there, controls are 44 px", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("h1")).toContainText("Weet je niet goed wat je met je vrije tijd wilt?");
      await expect(page.locator("#voorbeeld")).toBeVisible();
      await expect(page.locator("#waarom h3")).toHaveCount(4);
      await expect(page.locator("#faq details")).toHaveCount(6);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      // The two ways in sit side by side with the same weight on wide phones, stacked on narrow ones: both are real tap targets.
      const hero = page.locator("main section").first();
      expect(await tooSmall(page, "main section:first-of-type a, header button")).toEqual([]);
      expect(await hero.locator("a").count()).toBeGreaterThanOrEqual(2);
      expect(await tooSmall(page, "#voorbeeld button, #faq summary")).toEqual([]);
    });

    test("the 'what is inside' page and its FAQ", async ({ page }) => {
      await page.goto("/wat-zit-erin");
      await expect(page.locator("h1")).toContainText("Wat zit er in je Idea Book?");
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.locator("#faq summary").first().click();
      await expect(page.locator("#faq details").first()).toHaveAttribute("open", "");
      expect(await tooSmall(page, "#faq summary")).toEqual([]);
    });
  });
}

test.describe("sample book lightbox", () => {
  test("opens a page, moves with the arrow keys, closes with Escape and gives focus back", async ({ page }) => {
    await page.goto("/");
    const first = page.locator("#voorbeeld ul button").first();
    await first.scrollIntoViewIfNeeded();
    await first.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Pagina 1 van 3");
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toContainText("Pagina 2 van 3");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toContainText("Pagina 3 van 3");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test("the same page in English", async ({ page, context }) => {
    await context.addCookies([{ name: "window_locale", value: "en", url: "http://localhost:3000" }]);
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Not sure what to do with your free time?");
    await expect(page.locator("#voorbeeld img").first()).toHaveAttribute("src", /en-cover/);
  });
});

test.describe("trust and guarantee", () => {
  test("founder note and testimonials stay hidden while they are empty; the guarantee is on the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#vertrouwen")).toContainText("Klopt een plek niet?");
    await expect(page.locator("#vertrouwen blockquote")).toHaveCount(0);
    await expect(page.locator("#vertrouwen")).not.toContainText("Waarom ik dit maak");
  });

  test("the guarantee stands under the pay button on the profile screen", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("window-wizard-variant-v4", "images2");
      sessionStorage.setItem(
        "window-venster-draft-images2",
        JSON.stringify({
          v: 3,
          page: 3,
          answers: { associations: ["place-forest-edge", "moment-first-dance", "sense-perfume"], interestDomains: [], interests: [], intakeFlow: "images2", intakeVariant: "associations" },
          limitChips: [],
          limitText: "",
          seed: "e2e",
          seen: [],
        }),
      );
    });
    await page.goto("/intake?wizard=images2");
    await expect(page.locator("#bestellen")).toContainText("Klopt een plek niet? Je krijgt gratis een nieuw boek.");
  });
});

// --- screenshots for the pull request (opt-in)
const SHOTS = path.join(process.cwd(), "docs", "fase-2-screens");

test.describe("screenshots", () => {
  test.skip(!process.env.E2E_SCREENSHOTS, "set E2E_SCREENSHOTS=1 to write the pull request screenshots");
  test.use({ viewport: { width: 390, height: 844 } });

  test("landing page and every intake step at 390 px", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, "01-landing-top.jpg"), type: "jpeg", quality: 60 });
    await page.locator("#voorbeeld").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "02-landing-sample.jpg"), type: "jpeg", quality: 60 });
    await page.locator("#waarom").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "03-landing-differences.jpg"), type: "jpeg", quality: 60 });
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page.locator("#faq summary").first().click();
    await page.screenshot({ path: path.join(SHOTS, "04-landing-faq.jpg"), type: "jpeg", quality: 60 });

    const steps = ["images", "concrete", "situation", "profile"];
    for (const [index, id] of steps.entries()) {
      const p = await page.context().newPage();
      await p.setViewportSize({ width: 390, height: 844 });
      await p.addInitScript((i) => {
        sessionStorage.setItem("window-wizard-variant-v4", "images2");
        sessionStorage.setItem(
          "window-venster-draft-images2",
          JSON.stringify({
            v: 3,
            page: i,
            answers: { associations: ["place-forest-edge", "moment-first-dance", "sense-perfume"], interestDomains: [], interests: [], intakeFlow: "images2", intakeVariant: "associations" },
            limitChips: [],
            limitText: "",
            seed: "e2e",
            seen: [],
          }),
        );
      }, index);
      await p.goto("/intake?wizard=images2");
      await p.getByTestId("wizard-bar").waitFor();
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(SHOTS, `0${5 + index}-intake-${id}.jpg`), type: "jpeg", quality: 60 });
      if (id === "profile") {
        await p.locator("#bestellen").scrollIntoViewIfNeeded();
        await p.screenshot({ path: path.join(SHOTS, "09-intake-profile-pay.jpg"), type: "jpeg", quality: 60 });
      }
      await p.close();
    }
  });
});
