import { test, expect } from "@playwright/test";

// The landing-hero window: the app's own rectangular sash window with eight real images, never wider than the screen,
// never taller than what fits under the header on a computer, and (unless motion is reduced) one pane at a time swaps.

const PHONES = [
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
];

async function loadedPaneImages(page: import("@playwright/test").Page) {
  return page.locator("main figure .window-pane-open img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).map((i) => ({ alt: i.alt, loaded: i.complete && i.naturalWidth > 0 })),
  );
}

for (const vp of PHONES) {
  test.describe(`hero window on a phone ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });

    test("eight images, inside the screen, no horizontal scroll", async ({ page }) => {
      await page.goto("/?venster=1");
      const figure = page.locator("main figure").first();
      await figure.scrollIntoViewIfNeeded();
      await expect(figure.locator(".window-pane-open")).toHaveCount(8);
      await expect.poll(async () => (await loadedPaneImages(page)).filter((i) => i.loaded).length, { timeout: 20000 }).toBe(8);
      const box = (await figure.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}

test.describe("hero window on a computer", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("fits under the header and swaps one pane at a time", async ({ page }) => {
    await page.goto("/?venster=1");
    const figure = page.locator("main figure").first();
    await expect(figure.locator(".window-pane-open")).toHaveCount(8);
    const box = (await figure.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    expect(box.width).toBeLessThanOrEqual(560);
    // The glass shows the same rectangular layout as the app: two columns, four rows (offsets, so the arrival animation does not matter).
    const rects = await figure.locator(".window-pane-open").evaluateAll((els) => els.map((e) => ({ x: Math.round((e as HTMLElement).offsetLeft), y: Math.round((e as HTMLElement).offsetTop) })));
    expect(new Set(rects.map((r) => r.x)).size).toBe(2);
    expect(new Set(rects.map((r) => r.y)).size).toBe(4);
    const before = (await loadedPaneImages(page)).map((i) => i.alt).join("|");
    // The first swap comes after about four seconds, the next one 3.4 seconds later.
    await expect.poll(async () => (await loadedPaneImages(page)).map((i) => i.alt).join("|"), { timeout: 12000 }).not.toBe(before);
  });
});

test.describe("hero window with reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("stays as it is", async ({ page }) => {
    await page.goto("/?venster=1");
    await expect(page.locator("main figure .window-pane-open")).toHaveCount(8);
    const before = (await loadedPaneImages(page)).map((i) => i.alt).join("|");
    await page.waitForTimeout(9000);
    expect((await loadedPaneImages(page)).map((i) => i.alt).join("|")).toBe(before);
    // Complete without any animation: every pane is fully visible.
    const opacities = await page.locator("main figure .window-pane-open").evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
    expect(opacities.every((o) => o === "1")).toBe(true);
  });
});
