/**
 * Design review harness: signs in and captures the dashboard in the states that
 * matter. Run with `node e2e/dashboard.shots.mjs` while the web app and the API
 * are both running. Credentials come from the environment, never hard-coded.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const EMAIL = process.env.CG_EMAIL;
const PASSWORD = process.env.CG_PASSWORD;
const OUT = process.env.SHOT_DIR ?? "./shots";

if (!EMAIL || !PASSWORD) {
  console.error("Set CG_EMAIL and CG_PASSWORD.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const problems = [];
page.on("console", (msg) => {
  if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
});
page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));

const shot = async (name, target = page) => {
  await target.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`captured ${name}`);
};

// 1. Sign-in screen: must look exactly as it did before this work.
await page.goto(WEB, { waitUntil: "networkidle" });
await shot("01-login");

// 2. Sign in and land on the dashboard.
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 });
await page.waitForSelector("text=Overview", { timeout: 20000 });
await page.waitForTimeout(600);
await shot("02-dashboard-expanded");

// 3. Account menu at the bottom of the sidebar.
await page.click('[aria-label^="Account menu"]');
await page.waitForSelector("text=Sign out");
// Let the open animation finish so the panel is captured fully opaque.
await page.waitForTimeout(500);
await shot("03-account-menu");
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

// 4. Collapse from the top bar, then hover a rail item for its tooltip.
await page.click('[aria-label="Collapse sidebar"]');
await page.waitForTimeout(500);
await page.hover('a[href="/dashboard/drivers"]');
await page.waitForTimeout(500);
await shot("04-collapsed-tooltip");

// 5. A section page, still collapsed.
await page.click('a[href="/dashboard/drivers"]');
await page.waitForTimeout(700);
await shot("05-section-page");

// 6. Narrow viewport with the drawer open.
await page.click('[aria-label="Expand sidebar"]');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("06-mobile");
await page.click('[aria-label="Open menu"]');
await page.waitForTimeout(500);
await shot("07-mobile-drawer");

console.log(
  problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no console errors",
);

await browser.close();
