/**
 * USSCOS E2E — Phase 4: public form submissions against real Firebase.
 * Contact (/contact), Sponsorship Request wizard (/apply), Sponsor Application (/sponsorships/sponsor).
 * Captures toast text, console errors, page errors, and any Firestore denials.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5199";

function attachCollector(page, logs) {
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || /permission|denied|error/i.test(t)) logs.console.push(`[${m.type()}] ${t}`);
  });
  page.on("pageerror", (e) => logs.pageErrors.push(String(e)));
  page.on("requestfailed", (r) => {
    if (/firestore|googleapis|firebase/i.test(r.url())) logs.failed.push(`${r.failure()?.errorText}: ${r.url()}`);
  });
  return logs;
}

async function toastText(page) {
  const toasts = await page
    .locator('[role="toast"], .toast, [data-sonner-toast], .sonner-toaster div')
    .allInnerTexts()
    .catch(() => []);
  return toasts.join(" || ");
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = { console: [], pageErrors: [], failed: [] };
  attachCollector(page, logs);

  // ---- CONTACT ----
  await page.goto(BASE + "/contact", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('form input[name="name"]', "E2E Contact Tester");
  await page.fill('form input[name="email"]', "e2e-contact@example.com");
  await page.fill('form input[name="phone"]', "+91 98765 43210");
  await page.fill('form input[name="subject"]', "Sponsorship inquiry");
  await page.fill("form textarea", "Testing the contact form end to end for the production audit.");
  await page.check('form input[type="checkbox"]');
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log("== CONTACT ==");
  console.log("TOAST:", (await toastText(page)) || "(none)");
  console.log("CONSOLE:", logs.console.join(" | ") || "(none)");
  console.log("PAGEERR:", logs.pageErrors.join(" | ") || "(none)");
  console.log("FAILED:", logs.failed.join(" | ") || "(none)");
  console.log("BODY-FRAG:", (await page.locator("body").innerText()).slice(0, 260).replace(/\n/g, " / "));

  // ---- SPONSORSHIP REQUEST (wizard) ----
  logs.console.length = 0;
  logs.pageErrors.length = 0;
  logs.failed.length = 0;
  await page.goto(BASE + "/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[name="athleteName"]', "E2E Athlete Dev");
  await page.fill('input[name="dateOfBirth"]', "2004-03-12");
  await page.fill('input[name="location"]', "Chennai, Tamil Nadu");
  await page.fill('input[name="phone"]', "+91 90000 11111");
  await page.fill('input[name="email"]', "e2e-athlete@example.com");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.waitForTimeout(600);
  await page.fill('input[name="sport"]', "Track & Field");
  await page.fill('input[name="currentRanking"]', "State-level");
  await page.fill('input[name="coach"]', "E2E Coach");
  await page.fill('input[name="academy"]', "E2E Sports Academy");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.waitForTimeout(600);
  await page.fill('textarea[name="majorAchievements"]', "District gold 2025");
  await page.fill('textarea[name="upcomingCompetitions"]', "Nationals 2026");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.waitForTimeout(600);
  await page.fill('input[name="amountRequested"]', "50000");
  await page.fill('textarea[name="purposeOfFunding"]', "Training and travel to nationals.");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Next/ }).click(); // Documents (demo step) -> Social/Review
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /SUBMIT APPLICATION/ }).click();
  await page.waitForTimeout(5000);
  console.log("\n== SPONSORSHIP REQUEST (wizard) ==");
  console.log("TOAST:", (await toastText(page)) || "(none)");
  console.log("CONSOLE:", logs.console.join(" | ") || "(none)");
  console.log("PAGEERR:", logs.pageErrors.join(" | ") || "(none)");
  console.log("FAILED:", logs.failed.join(" | ") || "(none)");
  console.log("SUCCESS-UI:", /Application Received!/i.test(await page.locator("body").innerText()));

  // ---- SPONSOR APPLICATION ----
  logs.console.length = 0;
  logs.pageErrors.length = 0;
  logs.failed.length = 0;
  await page.goto(BASE + "/sponsorships/sponsor?type=athlete&athlete=E2E%20Athlete%20Dev", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);
  await page.fill('input[name="sponsorName"]', "E2E Sponsor Dev");
  await page.fill('input[name="sponsorCompany"]', "E2E Sponsor Corp");
  await page.fill('input[name="email"]', "e2e-sponsor@example.com");
  await page.fill('input[name="phone"]', "+91 80000 22222");
  await page.fill('input[name="amount"]', "25000");
  await page.fill('input[name="supportType"]', "Training Equipment");
  await page.fill("textarea", "Supporting this athlete's training and equipment needs for 2026.");
  await page.getByRole("button", { name: /SUBMIT REQUEST/ }).click();
  await page.waitForTimeout(5000);
  console.log("\n== SPONSOR APPLICATION ==");
  console.log("TOAST:", (await toastText(page)) || "(none)");
  console.log("CONSOLE:", logs.console.join(" | ") || "(none)");
  console.log("PAGEERR:", logs.pageErrors.join(" | ") || "(none)");
  console.log("FAILED:", logs.failed.join(" | ") || "(none)");
  console.log("SUCCESS-UI:", /Thank You for Your Support!/i.test(await page.locator("body").innerText()));

  // ---- DONATE (pledge) ----
  logs.console.length = 0;
  logs.pageErrors.length = 0;
  logs.failed.length = 0;
  await page.goto(BASE + "/donate", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[name="customAmount"]', "2500");
  await page.fill('input[name="name"]', "E2E Donor Dev");
  await page.fill('input[name="email"]', "e2e-donor@example.com");
  await page.fill('input[name="phone"]', "+91 70000 33333");
  await page.check('input[type="checkbox"]');
  await page.getByRole("button", { name: /PLEDGE/ }).click();
  await page.waitForTimeout(5000);
  console.log("\n== DONATION PLEDGE ==");
  console.log("TOAST:", (await toastText(page)) || "(none)");
  console.log("CONSOLE:", logs.console.join(" | ") || "(none)");
  console.log("PAGEERR:", logs.pageErrors.join(" | ") || "(none)");
  console.log("FAILED:", logs.failed.join(" | ") || "(none)");
  console.log("SUCCESS-UI:", /Thank You for Your Support!/i.test(await page.locator("body").innerText()));

  await browser.close();
}

main().catch((e) => {
  console.error("CRASH", e);
  process.exit(1);
});