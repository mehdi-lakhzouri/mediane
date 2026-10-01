/**
 * Proves the silent-refresh path end to end against the real API.
 *
 *  1. access cookie dropped, refresh cookie kept  -> one POST /auth/refresh, user stays in
 *  2. both cookies dropped                        -> one refresh attempt, then sign-in
 */
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const EMAIL = process.env.CG_EMAIL;
const PASSWORD = process.env.CG_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set CG_EMAIL and CG_PASSWORD.");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const calls = [];
page.on("request", (req) => {
  const url = new URL(req.url());
  if (url.pathname.startsWith("/api/v1/auth")) {
    calls.push(`${req.method()} ${url.pathname}`);
  }
});
const since = () => {
  const taken = [...calls];
  calls.length = 0;
  return taken;
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

await page.goto(WEB, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 });
await page.waitForSelector("text=Overview");
since();

// 1. Expired access token, valid refresh token.
await context.clearCookies({ name: "cg_at" });
await page.goto(`${WEB}/dashboard/drivers`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const afterExpiry = since();
check(
  "recovers from an expired access token without leaving the dashboard",
  page.url().includes("/dashboard") &&
    afterExpiry.filter((c) => c === "POST /api/v1/auth/refresh").length === 1,
  `url=${new URL(page.url()).pathname} calls=[${afterExpiry.join(", ")}]`,
);
check(
  "a new access cookie was issued",
  (await context.cookies()).some((c) => c.name === "cg_at"),
);

// Concurrency (single-flight) is covered by e2e/client-refresh.test.ts, which
// can drive the client directly; a page-level fetch would bypass it.

// 2. No refresh token either: one attempt, then back to sign-in.
await context.clearCookies();
since();
await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle" });
await page.waitForURL(`${WEB}/`, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
const afterDeath = since();
check(
  "a dead session lands on sign-in instead of looping",
  new URL(page.url()).pathname === "/" &&
    afterDeath.filter((c) => c === "POST /api/v1/auth/refresh").length <= 1,
  `url=${new URL(page.url()).pathname} calls=[${afterDeath.join(", ")}]`,
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length} check(s) failed`
    : `\nall ${results.length} checks passed`,
);
process.exit(failed.length ? 1 : 0);
