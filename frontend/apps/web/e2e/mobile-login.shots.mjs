/**
 * Verifies the mobile sign-in layout: below xl, only the compact brand mark
 * and the login form render — no headline, subtitle, feature cards or
 * footer-values strip. Desktop (xl) must stay exactly as it was.
 *
 * Note: `locator(...).count()` matches DOM presence, not visibility — a
 * `display:none` element still counts. Every check here filters on
 * `:visible` (or calls `.isVisible()`) so hidden-but-present desktop markup
 * can't produce a false pass/fail.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3012";
const OUT = process.env.SHOT_DIR ?? "./shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const check = (name, ok, detail = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);

async function page_for(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  p.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return { ctx, p };
}

const visibleCount = (p, text) => p.locator(`text=${text}`).locator("visible=true").count();

const marketingTexts = [
  "Health awareness",
  "Monitor wellbeing",
  "Smarter, safer journeys",
  "Your data, your family",
  "Safer drivers. Brighter tomorrows.",
  "Stronger tomorrows",
];

// --- Mobile (iPhone-ish width) ----------------------------------------------
{
  const { ctx, p } = await page_for({ width: 390, height: 844 });
  await p.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);

  check("the sign-in form is visible on mobile", await p.locator("#email").isVisible());
  check(
    "a compact brand mark is visible on mobile",
    (await p.getByRole("img", { name: "Mediane", exact: true }).locator("visible=true").count()) === 1,
    "Mediane wordmark is visible",
  );

  for (const text of marketingTexts) {
    const n = await visibleCount(p, text);
    check(`marketing copy is not VISIBLE on mobile: "${text}"`, n === 0, `visible=${n}`);
  }

  await p.screenshot({ path: `${OUT}/01-mobile-light.png` });

  await p.locator('button[aria-label*="dark mode" i]').click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/02-mobile-dark.png` });

  const bodyHeight = await p.evaluate(() => document.body.scrollHeight);
  check(
    "no excessive empty mobile page height",
    bodyHeight < 844 * 1.3,
    `scrollHeight=${bodyHeight}`,
  );

  await ctx.close();
}

// --- Tablet / just-below-xl (1279px) ----------------------------------------
{
  const { ctx, p } = await page_for({ width: 1279, height: 900 });
  await p.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  check(
    "marketing copy still not visible just below the xl breakpoint",
    (await visibleCount(p, "Health awareness")) === 0,
  );
  await p.screenshot({ path: `${OUT}/03-tablet-1279.png` });
  await ctx.close();
}

// --- Desktop (xl, unchanged) -------------------------------------------------
{
  const { ctx, p } = await page_for({ width: 1440, height: 900 });
  await p.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2200); // let the hero typewriter finish
  check(
    "the full hero headline is visible again at xl",
    await p.getByRole("heading", { level: 1, name: /every journey/i }).isVisible(),
  );
  check(
    "the feature cards are visible again at xl",
    (await visibleCount(p, "Monitor wellbeing")) === 1,
  );
  check(
    "the mobile-only compact brand mark is hidden at xl",
    (await p.locator("div.flex.xl\\:hidden").locator("visible=true").count()) === 0,
  );
  await p.screenshot({ path: `${OUT}/04-desktop-xl.png` });
  await ctx.close();
}

console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no console errors");
await browser.close();
