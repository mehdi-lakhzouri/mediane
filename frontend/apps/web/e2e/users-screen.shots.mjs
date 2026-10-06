/**
 * Design + behaviour review for the user management screen. Signs in, exercises
 * the table, and captures each state. Run while the web app and API are up.
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
  viewport: { width: 1440, height: 980 },
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
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );

await page.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 });

await page.click('a[href="/dashboard/drivers"]');
await page.waitForURL("**/dashboard/drivers");
await page.waitForSelector("table tbody tr");
await page.waitForTimeout(600);
await shot("01-users-table");

const rowCount = await page.locator("table tbody tr").count();
check("table renders rows from the API", rowCount > 0, `${rowCount} rows`);

// Pagination options must offer 5 / 10 / 25 / 50 / 100.
await page.click('[aria-label="Rows per page"]');
await page.waitForTimeout(350);
const sizes = await page.locator('[data-slot="select-item"]').allInnerTexts();
check(
  "page sizes are 5/10/25/50/100",
  JSON.stringify(sizes.map((s) => s.trim())) ===
    JSON.stringify(["5", "10", "25", "50", "100"]),
  sizes.join(","),
);
await shot("02-page-sizes");
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

// Selection reveals the bulk action bar.
await page
  .locator('table tbody tr td input, table tbody tr td button[role="checkbox"]')
  .first()
  .click();
await page.waitForTimeout(200);
await page.locator('table tbody tr td button[role="checkbox"]').nth(1).click();
await page.waitForTimeout(400);
const bulkVisible = await page
  .getByRole("button", { name: "Suspend" })
  .isVisible();
check("selecting rows reveals bulk actions", bulkVisible);
await shot("03-bulk-actions");

// Row action menu.
await page.keyboard.press("Escape");
await page.locator('[aria-label^="Actions for"]').first().click();
await page.waitForTimeout(450);
const menuVisible = await page
  .locator('[data-slot="dropdown-menu-content"]')
  .isVisible();
check("row actions menu opens", menuVisible);
await shot("04-row-actions");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Details sheet.
await page.locator('[aria-label^="Actions for"]').first().click();
await page.waitForTimeout(350);
await page.getByRole("menuitem", { name: /View & edit/i }).click();
await page.waitForSelector('[data-slot="sheet-content"]');
await page.waitForTimeout(600);
await shot("05-details-sheet");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// Search narrows the result set server-side.
await page.getByRole("button", { name: "Clear" }).click();
await page.waitForTimeout(300);
await page.fill('[aria-label="Search users"]', "amira");
await page.waitForTimeout(900);
const searched = await page.locator("table tbody tr").count();
check(
  "search filters the list",
  searched >= 1 && searched < rowCount,
  `${searched} rows`,
);
await shot("06-search");

// Invite modal.
await page.fill('[aria-label="Search users"]', "");
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Invite user" }).click();
await page.waitForSelector('[data-slot="dialog-content"]');
await page.waitForTimeout(600);
await shot("07-invite-modal");
await page.keyboard.press("Escape");

// Narrow viewport.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
await shot("08-mobile");

console.log(
  problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no console errors",
);
await browser.close();
