import { createRequire } from "node:module";
import { percentile } from "./stats.mjs";
import { sleep } from "./util.mjs";

const require = createRequire(import.meta.url);

export function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright not found. Run `npm install && npx playwright install chromium` inside bench/.");
  }
}

export const PROFILES = {
  // Lighthouse "mobile" (slow 4G + 4x CPU slowdown)
  mobile: { width: 412, height: 823, mobile: true, down: 1638.4, up: 750, rtt: 150, cpu: 4 },
  // fast connection, mid-range laptop
  fast: { width: 1350, height: 940, mobile: false, down: 10240, up: 5120, rtt: 40, cpu: 2 },
  // no throttling at all
  desktop: { width: 1350, height: 940, mobile: false, cpu: 1 },
};

const INIT = () => {
  const m = (window.__m = { lcp: 0, cls: 0, fcp: 0, long: [] });
  const obs = (type, cb) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true });
    } catch {}
  };
  obs("largest-contentful-paint", (e) => (m.lcp = e.startTime));
  obs("layout-shift", (e) => {
    if (!e.hadRecentInput) m.cls += e.value;
  });
  obs("paint", (e) => {
    if (e.name === "first-contentful-paint") m.fcp = e.startTime;
  });
  obs("longtask", (e) => m.long.push([e.startTime, e.duration]));
};

const TYPE_MAP = {
  Document: "htmlBytes",
  Script: "jsBytes",
  Stylesheet: "cssBytes",
  Font: "fontBytes",
  Image: "imgBytes",
};

/** One cold-cache page load. Returns a flat record of metrics. */
export async function measureLoad(browser, url, profileName) {
  const p = PROFILES[profileName] ?? PROFILES.mobile;
  const context = await browser.newContext({
    viewport: { width: p.width, height: p.height },
    isMobile: p.mobile,
    hasTouch: p.mobile,
    serviceWorkers: "block",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(INIT);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (p.down) {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: p.rtt,
        downloadThroughput: (p.down * 1024) / 8,
        uploadThroughput: (p.up * 1024) / 8,
      });
    }
    if (p.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });

    const types = new Map();
    const bytes = { htmlBytes: 0, jsBytes: 0, cssBytes: 0, fontBytes: 0, imgBytes: 0, otherBytes: 0 };
    let requests = 0;
    let totalBytes = 0;
    cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
    cdp.on("Network.requestWillBeSent", (e) => {
      if (!e.request.url.startsWith("data:")) requests++;
      if (e.type) types.set(e.requestId, e.type);
    });
    cdp.on("Network.loadingFinished", (e) => {
      const key = TYPE_MAP[types.get(e.requestId)] ?? "otherBytes";
      bytes[key] += e.encodedDataLength;
      totalBytes += e.encodedDataLength;
    });

    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await sleep(600);

    const r = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const m = window.__m;
      const fcp = m.fcp || 0;
      const tbt = m.long.reduce((s, [start, d]) => (start >= fcp ? s + Math.max(0, d - 50) : s), 0);
      return {
        ttfb: nav.responseStart,
        dcl: nav.domContentLoadedEventEnd,
        load: nav.loadEventEnd,
        fcp,
        lcp: m.lcp,
        cls: m.cls,
        tbt,
      };
    });
    return { ...r, ...bytes, totalBytes, requests };
  } finally {
    await context.close();
  }
}

/** Sustained HTTP load on `url` for `seconds` using `concurrency` keep-alive workers. */
export async function loadTest(url, { seconds = 5, concurrency = 16 } = {}) {
  const lat = [];
  let errors = 0;
  const end = performance.now() + seconds * 1000;
  const t0 = performance.now();
  const worker = async () => {
    while (performance.now() < end) {
      const s = performance.now();
      try {
        const res = await fetch(url, { redirect: "follow" });
        await res.arrayBuffer();
        if (!res.ok) errors++;
        else lat.push(performance.now() - s);
      } catch {
        errors++;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  const dur = (performance.now() - t0) / 1000;
  return {
    rps: lat.length / dur,
    p50: percentile(lat, 0.5),
    p95: percentile(lat, 0.95),
    errors,
  };
}
