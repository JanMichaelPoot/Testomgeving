// A repeatable speed baseline of the pages, as a phone on a slow connection sees them (4x slower processor, 1.6 Mbps, 150 ms), plus an unthrottled desktop run.
// Prints, per page and run: the time to the first byte, the first paint (FCP), the largest paint (LCP) and what it was, layout shifts (CLS), and the weight by kind.
// The first run of a page may hit a cold server function (a long first byte); the second shows the warm site. Free: it only loads public pages.
//
//   npx tsx scripts/perf-baseline.ts                       the live site
//   npx tsx scripts/perf-baseline.ts http://localhost:3000 a local production build (next build && next start)
//   npx tsx scripts/perf-baseline.ts https://www.windowinto.nl / /intake /wat-zit-erin
//
// Targets (Google's "good"): FCP 1.8 s, LCP 2.5 s, CLS 0.1, first byte 0.8 s. Not run in CI: network timings vary too much to be a test.
import { chromium, devices } from "@playwright/test";

const base = (process.argv[2] ?? "https://www.windowinto.nl").replace(/\/$/, "");
const pages = process.argv.length > 3 ? process.argv.slice(3) : ["/", "/intake", "/wat-zit-erin"];
const origin = new URL(base).origin;

async function measure(profile: "mobile" | "desktop", path: string, run: number) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...(profile === "mobile" ? devices["Pixel 5"] : { viewport: { width: 1350, height: 940 } }),
    locale: "nl-NL",
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: "window_analytics_consent", value: "denied" }] }] },
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  if (profile === "mobile") {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const seen = new Map<string, { type: string; size: number }>();
  cdp.on("Network.requestWillBeSent", (e: { requestId: string; type?: string }) => seen.set(e.requestId, { type: e.type ?? "Other", size: 0 }));
  cdp.on("Network.loadingFinished", (e: { requestId: string; encodedDataLength: number }) => {
    const r = seen.get(e.requestId);
    if (r) r.size = e.encodedDataLength;
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: { t: number; tag?: string; url?: string } | null; __cls: number };
    w.__lcp = null;
    w.__cls = 0;
    new PerformanceObserver((l) => {
      const e = l.getEntries().pop() as PerformanceEntry & { element?: Element; url?: string };
      w.__lcp = { t: Math.round(e.startTime), tag: e.element?.tagName, url: e.url };
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(base + path, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(3000);
  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const w = window as unknown as { __lcp: { t: number; tag?: string; url?: string } | null; __cls: number };
    return { ttfb: Math.round(n.responseStart), fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0), lcp: w.__lcp, cls: +w.__cls.toFixed(3) };
  });
  const by: Record<string, number> = {};
  let total = 0;
  for (const r of seen.values()) {
    by[r.type] = (by[r.type] ?? 0) + r.size;
    total += r.size;
  }
  const kb = (n: number) => `${Math.round(n / 1024)} kB`;
  const lcp = m.lcp ? `${m.lcp.t} ms (${m.lcp.tag ?? "?"}${m.lcp.url ? ` ${new URL(m.lcp.url, origin).pathname.slice(0, 50)}` : ""})` : "-";
  console.log(
    `${profile.padEnd(7)} run ${run} ${path.padEnd(14)} first byte ${String(m.ttfb).padStart(4)} ms · FCP ${String(m.fcp).padStart(4)} ms · LCP ${lcp} · CLS ${m.cls} · ${kb(total)} (script ${kb(by.Script ?? 0)}, image ${kb(by.Image ?? 0)}, font ${kb(by.Font ?? 0)})`,
  );
  await browser.close();
}

(async () => {
  console.log(`Speed baseline of ${base}\n`);
  for (const profile of ["mobile", "desktop"] as const) for (const path of pages) for (const run of [1, 2]) await measure(profile, path, run);
})();
