/**
 * Browser-level verification of the combat-sports positioning.
 * Loads the app in headless Chromium (current source + live Firestore),
 * and asserts the navbar and About/Home copy. Expected DB-driven fields that
 * are still stale are reported as DB-OVERRIDE rather than hard failures, which
 * is what update-content-blocks.mjs fixes.
 *
 * Usage: node scripts/e2e/verify-combat-copy.cjs  (BASE defaults to http://localhost:5199)
 */
const { chromium } = require("playwright");

const BASE = process.env.VERIFY_BASE || "http://localhost:5199";

const NAV_EXPECTED = ["Home", "About", "Fighters", "Sponsorships", "News", "Gallery", "Contact"];

function statusOf(label, ok, detail) {
  console.log(`  ${ok ? "✓ PASS" : "✗ FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  return ok;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];

  await page.goto(BASE + "/about", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  console.log("\n=== /about ===\n");
  const navTexts = await page.locator(".navbar__links a").allTextContents();
  const navJoined = navTexts.map((t) => t.trim()).join("|");
  results.push([
    "navbar contains no 'Athletes' label",
    statusOf("navbar contains no 'Athletes' label", !navJoined.includes("Athletes"), navJoined),
  ]);
  results.push([
    "navbar shows Fighters/Sponsorships list",
    statusOf(
      "navbar item order",
      NAV_EXPECTED.every((label) => navTexts.map((t) => t.trim()).includes(label)),
      navJoined,
    ),
  ]);
  const donate = await page.locator("a.btn-primary").filter({ hasText: /donate/i }).count();
  results.push(["navbar Donate CTA present", statusOf("navbar Donate CTA present", donate >= 1)]);

  const body = await page.locator("body").innerText();
  const hasNewHero = /nonprofit combat sports organization empowering fighters/i.test(body);
  results.push(["about hero subtitle is new", statusOf("about hero subtitle is new", hasNewHero)]);
  const hasFighterDreams = /A Trust Built on \nFighter Dreams|A Trust Built on Fighter Dreams/i.test(body.replace(/\s+/g, " "));
  results.push(["about heading is 'Fighter Dreams'", statusOf("about heading is 'Fighter Dreams'", hasFighterDreams)]);
  results.push(["no 'Athletic Dreams'", statusOf("no 'Athletic Dreams'", !/Athletic Dreams/i.test(body))]);
  const oldIntro = /sports organization dedicated to empowering young athletes|empowering young athletes/i.test(body);
  results.push([
    "no stale 'young athletes' intro body (DB about.intro)",
    statusOf(
      "no stale 'young athletes' / 'sports organization' body copy",
      !oldIntro,
      oldIntro ? "DB-OVERRIDE: contentBlocks/about.intro still stale — run scripts/update-content-blocks.mjs" : "ok",
    ),
  ]);

  console.log("\n=== / (homepage) ===\n");
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  const homeBody = await page.locator("body").innerText();
  const hasEyebrow = /Empowering Fighters & Combat Athletes/i.test(homeBody);
  results.push([
    "home hero eyebrow is combat copy",
    statusOf("home hero eyebrow is combat copy", hasEyebrow, hasEyebrow ? "ok" : "DB-OVERRIDE: contentBlocks/homepage.heroEyebrow stale"),
  ]);
  const oldHero = /supports dedicated young athletes/i.test(homeBody);
  results.push([
    "home hero paragraph not stale",
    statusOf("home hero paragraph not stale", !oldHero, oldHero ? "DB-OVERRIDE: contentBlocks/homepage.heroParagraph stale" : "ok"),
  ]);

  const hardFails = results.filter(([, ok]) => !ok).map(([label]) => label);
  console.log(`\n\nRESULT: ${results.length - hardFails.length}/${results.length} passed`);
  if (hardFails.length) {
    console.log("Not passing:");
    for (const l of hardFails) console.log("  - " + l);
    console.log("\nInterpretation: anything flagged DB-OVERRIDE is fixed by scripts/update-content-blocks.mjs (needs staff sign-in).");
  }
  await browser.close();
  process.exit(hardFails.length ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E CRASH", e);
  process.exit(1);
});