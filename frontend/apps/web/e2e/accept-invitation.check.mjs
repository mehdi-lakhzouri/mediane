/**
 * Walks the driver's half of the onboarding chain against the real API:
 * accept the emailed link, confirm the token leaves the address bar, and
 * confirm replaying it is refused.
 *
 * ACCEPT_URL comes from a freshly issued invitation.
 */
import { chromium } from "@playwright/test";

const ACCEPT_URL = process.env.ACCEPT_URL;
if (!ACCEPT_URL) {
  console.error("Set ACCEPT_URL.");
  process.exit(1);
}
const OUT = process.env.SHOT_DIR ?? "./shots";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

const check = (name, ok, detail = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);

await page.goto(ACCEPT_URL, { waitUntil: "networkidle" });
await page.waitForSelector("text=all set", { timeout: 15000 });
await page.screenshot({ path: `${OUT}/01-accepted.png` });

check("the emailed link is accepted", true);
check(
  "the token is scrubbed from the address bar",
  !page.url().includes("token="),
  page.url(),
);

// Replaying the same link must be refused. Step 1 scrubbed the fragment, so go
// somewhere else first: navigating back to a URL that differs only by its hash
// would be a same-document move and would not remount the page.
await page.goto("about:blank");
await page.goto(ACCEPT_URL, { waitUntil: "networkidle" });
await page.waitForSelector("text=confirm this link", { timeout: 15000 });
await page.screenshot({ path: `${OUT}/02-replayed.png` });
check("replaying the same link is refused", true);

// A link with no token at all lands on the same message, not a crash.
await page.goto("about:blank");
await page.goto(ACCEPT_URL.split("#")[0], { waitUntil: "networkidle" });
await page.waitForSelector("text=confirm this link", { timeout: 15000 });
check("a link with no token fails cleanly", true);

console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no page errors");
await browser.close();
