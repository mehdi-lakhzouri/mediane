/**
 * Verifies the light/dark toggle on the sign-in and invitation-acceptance
 * screens: visible control, working switch, persistence across reload, and no
 * flash-of-wrong-theme on a fresh load with a saved dark preference.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "./shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`captured ${name}`);
};
const check = (name, ok, detail = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);

const attr = () =>
  page.evaluate(() => document.documentElement.getAttribute("data-theme"));

// 1. Fresh load: light by default.
await page.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
check("defaults to light with no saved preference", (await attr()) === "light");
await shot("01-light");

// 2. Toggle to dark.
const toggle = page.locator('button[aria-label*="dark mode" i]');
await toggle.waitFor({ state: "visible" });
await toggle.click();
await page.waitForTimeout(500);
check("switches to dark on click", (await attr()) === "dark");
await shot("02-dark");

// 3. Persists across a hard reload (no flash check requires a fresh context,
// done in step 5 below).
await page.reload({ waitUntil: "networkidle" });
check("stays dark after reload", (await attr()) === "dark");
await shot("03-dark-reloaded");

// 4. Toggle back to light.
await page.locator('button[aria-label*="light mode" i]').click();
await page.waitForTimeout(500);
check("switches back to light", (await attr()) === "light");

// 5. Fresh browser context (simulates a new visit) with dark saved beforehand:
// the attribute must already be "dark" at the very first check, proving the
// no-FOUC script ran before our own JS could.
const darkContext = await browser.newContext();
const darkPage = await darkContext.newPage();
await darkPage.addInitScript(() => {
  localStorage.setItem("cg.signin.theme", "dark");
});
// domcontentloaded fires once the HTML is fully parsed, i.e. after a
// synchronous beforeInteractive script has run but before React hydrates —
// the real checkpoint for "did the visitor ever see the wrong theme".
await darkPage.goto(`${WEB}/sign-in`, { waitUntil: "domcontentloaded" });
const earlyTheme = await darkPage.evaluate(
  () => document.documentElement.getAttribute("data-theme"),
);
check(
  "a saved dark preference is applied before first paint",
  earlyTheme === "dark",
  `data-theme at DOMContentLoaded = ${earlyTheme}`,
);
await darkPage.waitForLoadState("networkidle");
await darkPage.screenshot({ path: `${OUT}/04-fresh-visit-dark.png` });
await darkContext.close();

// 6. The invitation-acceptance screen inherits the same saved preference.
const acceptContext = await browser.newContext();
const acceptPage = await acceptContext.newPage();
await acceptPage.addInitScript(() => {
  localStorage.setItem("cg.signin.theme", "dark");
});
await acceptPage.goto(`${WEB}/accept-invitation`, { waitUntil: "networkidle" });
await acceptPage.waitForTimeout(500);
await acceptPage.screenshot({ path: `${OUT}/05-accept-invitation-dark.png` });
await acceptContext.close();

console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no console errors");
await browser.close();
