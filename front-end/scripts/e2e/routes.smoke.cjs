/**
 * USSCOS E2E — Phase 1/2: route smoke test.
 * Navigates every public route, captures console errors, page errors,
 * and failed network requests. Detects blank/empty error states.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5199";

const STATIC_ROUTES = [
  "/",
  "/about",
  "/athletes",
  "/groups",
  "/events",
  "/news",
  "/gallery",
  "/sponsorships",
  "/contact",
  "/donate",
  "/faq",
  "/terms",
  "/privacy",
  "/refund-cancellation",
  "/seeking-sponsorship",
  "/apply",
  "/sponsorships/sponsor",
  "/admin/login",
];

const IGNORED_FAILED = [
  /favicon/,
  /\.(png|jpg|jpeg|webp|svg|gif|ico)/i,
];

async function captureRoute(page, path) {
  const report = { path, consoleErrors: [], pageErrors: [], failedRequests: [], bodyText: null };
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => report.pageErrors.push(String(err)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!IGNORED_FAILED.some((re) => re.test(url))) {
      report.failedRequests.push(`${req.failure()?.errorText || "failed"}: ${url}`);
    }
  });
  try {
    const resp = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    report.status = resp ? resp.status() : null;
    await page.waitForTimeout(2500);
    report.bodyText = (await page.locator("body").innerText()).slice(0, 3000);
  } catch (err) {
    report.gotoError = String(err);
    if (!report.bodyText) {
      try {
        await page.waitForTimeout(1500);
        report.bodyText = (await page.locator("body").innerText()).slice(0, 3000);
      } catch { report.bodyText = ""; }
    }
  }
  return report;
}

const TEXT_EMPTY_HITS = [/something went wrong/i, /failed to load/i, /error/i];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  for (const route of STATIC_ROUTES) {
    results.push(await captureRoute(page, route));
  }

  // dynamic detail routes: grab real ids from list pages
  try {
    await page.goto(BASE + "/athletes", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    const firstLink = page.locator('a[href^="/athletes/"]').first();
    if (await firstLink.count()) {
      const href = await firstLink.getAttribute("href");
      results.push(await captureRoute(page, href));
    }
  } catch { /* no public athletes */ }

  try {
    await page.goto(BASE + "/news", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    const firstLink = page.locator('a[href^="/news/"]').first();
    if (await firstLink.count()) {
      const href = await firstLink.getAttribute("href");
      await page.goto(BASE, { waitUntil: "networkidle" });
      results.push(await captureRoute(page, href));
    }
  } catch { /* no published news */ }

  await browser.close();

  for (const r of results) {
    const problems = [];
    if (r.gotoError) problems.push(`goto:${r.gotoError.slice(0, 120)}`);
    if (r.consoleErrors.length) problems.push(`console(${r.consoleErrors.length})`);
    if (r.pageErrors.length) problems.push(`pageerror(${r.pageErrors.length})`);
    if (r.failedRequests.length) problems.push(`failedReq(${r.failedRequests.length})`);
    if (r.status && r.status >= 500) problems.push(`http:${r.status}`);
    if (!r.bodyText || r.bodyText.trim().length < 5) problems.push("EMPTY BODY");
    console.log(`\n=== ${r.path} [${r.status}] ${problems.length ? "ISSUES: " + problems.join(",") : "OK"}`);
    for (const f of r.failedRequests) console.log(`    FAILED: ${f}`);
    if (r.pageErrors.length) console.log(`    PAGEERR: ${r.pageErrors.join(" | ").slice(0, 500)}`);
    if (r.consoleErrors.length) console.log(`    CONSOLE: ${r.consoleErrors.join(" | ").slice(0, 800)}`);
  }
  console.log(`\nROUTES TESTED: ${results.length}`);
}

main().catch((e) => {
  console.error("E2E CRASH", e);
  process.exit(1);
});