import { test, expect, type Page } from "@playwright/test";

// P0-1: on a phone the options at the bottom of an intake screen must stay reachable. The
// fixed bottom bar (Back + Next) has to sit on the bottom of the screen, not on the bottom of
// the content, and the last option or field must end above it.

const VIEWPORTS = [
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
];

// Every screen has the bottom bar (Back + Next, or "Klopt, open mijn venster" on the profile).
const SCREENS = [
  { index: 0, id: "worlds" },
  { index: 1, id: "places" },
  { index: 2, id: "moments" },
  { index: 3, id: "senses" },
  { index: 4, id: "situation" },
  { index: 5, id: "profile" },
];

async function openScreen(page: Page, index: number) {
  await page.addInitScript((i) => {
    sessionStorage.setItem("window-wizard-variant-v3", "associations");
    sessionStorage.setItem(
      "window-venster-draft-v1",
      JSON.stringify({
        v: 3,
        page: i,
        answers: { associations: ["place-forest-edge"], interestDomains: ["nature"] },
        limitChips: [],
        limitText: "",
        seed: "e2e",
        seen: [],
      }),
    );
  }, index);
  await page.goto("/intake?wizard=associations");
  await page.getByTestId("wizard-bar").waitFor();
  // Let the page-in animation finish: the bug only showed once it had.
  await page.waitForTimeout(600);
}

/** Marks the lowest interactive element of the content (outside the bar) and returns its geometry. */
async function inspectBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="wizard-bar"]')!;
    const barRect = bar.getBoundingClientRect();
    const candidates = [...document.querySelectorAll<HTMLElement>("main button, main input, main textarea, main select, main a")].filter((el) => {
      if (bar.contains(el)) return false;
      if (el.closest("header")) return false;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    let last: HTMLElement | null = null;
    let lastBottom = -Infinity;
    for (const el of candidates) {
      const b = el.getBoundingClientRect().bottom + window.scrollY;
      if (b > lastBottom) {
        lastBottom = b;
        last = el;
      }
    }
    if (!last) return null;
    last.setAttribute("data-e2e-last", "1");
    const r = last.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1));
    return {
      viewportHeight: window.innerHeight,
      barBottom: barRect.bottom,
      barTop: barRect.top,
      lastBottom: r.bottom,
      coveredByBar: !!top && bar.contains(top),
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`phone ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });

    for (const screen of SCREENS) {
      test(`${screen.id}: the bar sits on the screen and the last option is reachable`, async ({ page }) => {
        await openScreen(page, screen.index);
        const g = await inspectBottom(page);
        expect(g, "an interactive element above the bar").not.toBeNull();
        // The bar is fixed to the bottom of the screen, whatever the content height.
        expect(Math.abs(g!.barBottom - g!.viewportHeight)).toBeLessThanOrEqual(1);
        // The lowest option ends above the bar and nothing of the bar is on top of it.
        expect(g!.lastBottom).toBeLessThanOrEqual(g!.barTop + 1);
        expect(g!.coveredByBar).toBe(false);
        // On the profile screen the lowest element is the pay button, disabled until the two legal boxes are ticked: reachable is enough.
        if (screen.id === "profile") {
          await expect(page.locator('[data-e2e-last="1"]')).toBeDisabled();
          return;
        }
        await page.locator('[data-e2e-last="1"]').click({ timeout: 5000 });
      });
    }
  });
}

test.describe("keyboard open on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a focused free-text field stays above the bar", async ({ page }) => {
    await openScreen(page, 5);
    // A phone keyboard takes about half the screen.
    await page.setViewportSize({ width: 390, height: 420 });
    const field = page.locator("main textarea, main input:not([type]), main input[type='text']").last();
    await field.focus();
    await page.waitForTimeout(300);
    const [fieldBottom, barTop] = await Promise.all([
      field.evaluate((el) => el.getBoundingClientRect().bottom),
      page.getByTestId("wizard-bar").evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(fieldBottom).toBeLessThanOrEqual(barTop + 1);
  });
});
