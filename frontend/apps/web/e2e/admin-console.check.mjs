/**
 * Browser walk-through of the console pages added for MFA and families,
 * against a running API:
 *  - Settings > security: regenerate recovery codes, replace the
 *    authenticator with a recovery code, change the password with a code.
 *  - Families: find a family, add a driver, change the owner, remove a
 *    member, dissolve.
 *
 *   ADMIN_EMAIL=... PASSWORD=... FAMILY_NAME=... ADD_DRIVER=... \
 *     WEB_URL=http://localhost:3012 node e2e/admin-console.check.mjs
 *
 * The admin must exist WITHOUT an authenticator (first sign-in sets it up);
 * the family must exist with an owner and one member; ADD_DRIVER is the first
 * name of an active driver without a family.
 */
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3012";
const OUT = process.env.SHOT_DIR ?? "./shots";
const { ADMIN_EMAIL, PASSWORD, FAMILY_NAME, ADD_DRIVER } = process.env;
if (!ADMIN_EMAIL || !PASSWORD || !FAMILY_NAME || !ADD_DRIVER) {
  throw new Error(
    "ADMIN_EMAIL, PASSWORD, FAMILY_NAME and ADD_DRIVER are required",
  );
}
mkdirSync(OUT, { recursive: true });

// --- the authenticator app ------------------------------------------------
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const decode = (text) => {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of text.replace(/\s/g, "").toUpperCase()) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};
const totp = (secret, step) => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(message).digest();
  const o = h[h.length - 1] & 15;
  const n =
    ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
};
const stepNow = () => Math.floor(Date.now() / 30_000);
let usedStep = 0;
/** Codes are never accepted twice: wait for a fresh 30-second step. */
async function freshCode(secret) {
  while (stepNow() <= usedStep) await new Promise((r) => setTimeout(r, 500));
  usedStep = stepNow();
  return totp(secret, usedStep);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) {
    problems.push(`console: ${m.text()}`);
  }
});
const dialog = () => page.getByRole("dialog");

// --- first sign-in: authenticator setup -------------------------------------
await page.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
await page.fill("#email", ADMIN_EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/mfa/setup");
const keyText = await page.locator(".mfa-secret code").innerText();
let secret = decode(keyText);
await page.getByRole("button", { name: /scanned the code/i }).click();
await page
  .locator('input[name="verification-code"]')
  .fill(await freshCode(secret));
await page.getByRole("button", { name: /verify securely/i }).click();
await page
  .getByRole("heading", { name: /save your recovery codes/i })
  .waitFor();
let recovery = (
  await page.locator('ol[aria-label="Recovery codes"] li').allInnerTexts()
).map((t) => t.replace(/^\d+\.\s*/, "").trim());
await page.getByLabel(/stored these codes/i).check();
await page.getByRole("button", { name: /^continue$/i }).click();
await page.getByRole("link", { name: /continue to dashboard/i }).click();
await page.waitForURL("**/dashboard");
check("admin enrolled an authenticator and reached the console", true);

// --- settings > security -----------------------------------------------------
await page.goto(`${WEB}/dashboard/settings`, { waitUntil: "networkidle" });
await page.getByText("10 of 10 left").waitFor();
check("security page shows MFA on with 10 recovery codes", true);
await page.screenshot({ path: `${OUT}/01-settings.png` });

await page.getByRole("button", { name: /generate new codes/i }).click();
await dialog()
  .getByLabel(/confirm with a code/i)
  .fill(await freshCode(secret));
await dialog()
  .getByRole("button", { name: /^generate$/i })
  .click();
await dialog()
  .getByText(/your new recovery codes/i)
  .waitFor();
const regenerated = await dialog().locator("ol li").allInnerTexts();
check(
  "regenerating shows 10 new codes",
  regenerated.length === 10 && !regenerated.includes(recovery[0]),
);
await page.screenshot({ path: `${OUT}/02-regenerated.png` });
const done = dialog().getByRole("button", { name: /^done$/i });
check("closing needs the 'stored' confirmation", await done.isDisabled());
await dialog()
  .getByLabel(/stored these codes/i)
  .check();
await done.click();
recovery = regenerated;

// Replace the authenticator using a recovery code (phone lost).
await page.getByRole("button", { name: /replace authenticator/i }).click();
await dialog()
  .getByLabel(/current code or recovery code/i)
  .fill(recovery[0]);
await dialog()
  .getByRole("button", { name: /^continue$/i })
  .click();
await dialog()
  .getByAltText(/QR code for the new authenticator/i)
  .waitFor();
const newKey = (await dialog().locator("p.font-mono").innerText()).replace(
  /\s/g,
  "",
);
const newSecret = decode(newKey);
await page.screenshot({ path: `${OUT}/03-replace-scan.png` });
usedStep = 0; // a different secret: its steps are unused
await dialog()
  .getByLabel(/code from the new app/i)
  .fill(totp(newSecret, stepNow()));
usedStep = stepNow();
await dialog()
  .getByRole("button", { name: /confirm new app/i })
  .click();
await dialog()
  .getByText(/your new recovery codes/i)
  .waitFor();
recovery = await dialog().locator("ol li").allInnerTexts();
await dialog()
  .getByLabel(/stored these codes/i)
  .check();
await dialog()
  .getByRole("button", { name: /^done$/i })
  .click();
secret = newSecret;
check(
  "authenticator replaced with a recovery code; new codes shown",
  recovery.length === 10,
);

// Change the password with a code from the NEW app.
const NEW_PASSWORD = `${PASSWORD}-v2`;
await page.getByRole("button", { name: /change password/i }).click();
await dialog().getByLabel("Current password").fill(PASSWORD);
await dialog().getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
await dialog().getByLabel("Confirm new password").fill(NEW_PASSWORD);
await dialog()
  .getByLabel(/verification code/i)
  .fill(await freshCode(secret));
await dialog()
  .getByRole("button", { name: /change password/i })
  .click();
await page
  .getByText(/password changed/i)
  .first()
  .waitFor();
check("password changed with a code from the new authenticator", true);

// --- families ---------------------------------------------------------------
await page.goto(`${WEB}/dashboard/families`, { waitUntil: "networkidle" });
await page.getByLabel("Search families").fill(FAMILY_NAME);
const row = page.getByRole("row", { name: new RegExp(FAMILY_NAME) });
await row.waitFor();
check(
  "the family is listed with its owner and 2/10 members",
  /Amira/.test(await row.innerText()) && /2 \/ 10/.test(await row.innerText()),
);
await page.screenshot({ path: `${OUT}/04-families.png` });

await row.click();
const sheet = page.getByRole("dialog");
await sheet.getByText("Bilel", { exact: false }).first().waitFor();
await sheet.getByRole("button", { name: /add a driver/i }).click();
await sheet.getByLabel("Search a driver").fill(ADD_DRIVER);
await sheet.getByRole("button", { name: /^add$/i }).first().click();
await sheet.getByText("3 / 10 members").waitFor();
check("a driver was added from the console", true);
await page.screenshot({ path: `${OUT}/05-family-sheet.png` });

await sheet.getByRole("button", { name: /actions for bilel/i }).click();
await page.getByRole("menuitem", { name: /make owner/i }).click();
await page
  .getByRole("alertdialog")
  .getByRole("button", { name: /make owner/i })
  .click();
await page
  .getByText(/ownership transferred/i)
  .first()
  .waitFor();
const bilelRow = sheet.locator("li", { hasText: "Bilel" });
check("ownership moved to Bilel", /Owner/.test(await bilelRow.innerText()));

await sheet
  .getByRole("button", { name: new RegExp(`actions for ${ADD_DRIVER}`, "i") })
  .click();
await page.getByRole("menuitem", { name: /remove from family/i }).click();
await page
  .getByRole("alertdialog")
  .getByRole("button", { name: /^remove$/i })
  .click();
await sheet.getByText("2 / 10 members").waitFor();
check("a member was removed", true);

await sheet.getByRole("button", { name: /dissolve family/i }).click();
const confirmBox = page.getByRole("alertdialog");
await confirmBox.locator("input").fill(FAMILY_NAME);
await confirmBox.getByRole("button", { name: /^dissolve$/i }).click();
await page
  .getByText(/family dissolved/i)
  .first()
  .waitFor();
await page.waitForTimeout(800);
check(
  "the family is gone from the list after dissolving",
  (await page.getByRole("row", { name: new RegExp(FAMILY_NAME) }).count()) ===
    0,
);

console.log(
  problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no page errors",
);
await browser.close();
process.exit(results.every(Boolean) && problems.length === 0 ? 0 : 1);
