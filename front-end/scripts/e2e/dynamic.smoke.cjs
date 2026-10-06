/**
 * USSCOS E2E — dynamic/public visibility vs live Firestore.
 * Detail routes with real + bogus IDs; public list/empty states.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5199";
const ATHLETE_ID = "oluXyV9x1uU5p2IBdzF9"; // Mohammed Asraf (approved) in live project

function attachCollector(page, logs) {
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || /permission|denied|error|failed/i.test(t)) logs.console.push(`[${m.type()}] ${t}`);
  });
  page.on("pageerror", (e) => logs.pageErrors.push(String(e)));
  page.on("requestfailed", (r) => {
    if (/firestore|googleapis|firebase/i.test(r.url())) logs.failed.push(`${r.failure()?.errorText}: ${r.url()}`);
  });
}

async function testRoute(page, name, path, expectFragments) {
  const logs = { console: [], pageErrors: [], failed: [] };
  attachCollector(page, logs);
  const resp = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const body = await page.locator("body").innerText();
  const frags = expectFragments.map((f) => (body.includes(f) ? `✓ "${f}"` : `✗ MISSING "${f}"`)).join("  ");
  const issues = [];
  if (logs.pageErrors.length) issues.push("PAGEERR");
  if (logs.failed.length) issues.push(`NETFAIL(${logs.failed.length})`);
  const permErrors = logs.console.filter((x) => /permission|insufficient/i.test(x));
  if (permErrors.length) issues.push(`PERM(${permErrors.length})`);
  console.log(`[${issues.length ? "FAIL" : "OK "}] ${name} ${path}  ${issues.length ? issues.join(",") : ""}`);
  console.log(`     fragments: ${frags}`);
  if (issues.length) {
    console.log(`     console: ${logs.console.slice(0, 5).join(" | ") || "(none)"}`);
    console.log(`     pageerr: ${logs.pageErrors.slice(0, 3).join(" | ") || "(none)"}`);
    console.log(`     failed: ${logs.failed.slice(0, 3).join(" | ") || "(none)"}`);
  }
  return body;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await testRoute(page, "Athlete detail (real, approved)", `/athletes/${ATHLETE_ID}`, ["Mohammed Asraf", "Boxing"]);
  await testRoute(page, "Athlete detail (bogus id)", "/athletes/definitely-not-a-real-id-999", ["404"]);
  await testRoute(page, "News detail (no docs)", "/news/definitely-not-a-real-id-999", ["404"]);
  await testRoute(page, "Sponsor athlete detail", `/sponsorships/athlete/${ATHLETE_ID}`, ["Spon"]);
  await testRoute(page, "Sponsor academy detail (bogus)", "/sponsorships/academy/bogus-academy-id", ["404"]);
  await testRoute(page, "Athletes list (public)", "/athletes", ["Mohammed Asraf"]);
  await testRoute(page, "News list (empty)", "/news", ["No", "yet"]);
  await testRoute(page, "Gallery (empty)", "/gallery", []);
  await testRoute(page, "Events (empty)", "/events", []);
  await testRoute(page, "Groups route", "/groups", []);

  await browser.close();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error("CRASH", e);
  process.exit(1);
});