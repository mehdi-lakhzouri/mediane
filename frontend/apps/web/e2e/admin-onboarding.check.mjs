/**
 * Browser walk-through of an invited administrator's first sign-ins, against
 * a running API: temporary password -> own password -> authenticator setup ->
 * recovery codes -> console; then signing in again with a TOTP code and with
 * a recovery code.
 *
 *   ADMIN_EMAIL=... TEMP_PASSWORD=... WEB_URL=http://localhost:3012 \
 *     node e2e/admin-onboarding.check.mjs
 *
 * The admin must exist with mustChangePassword=true (see the PR description).
 */
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3012";
const OUT = process.env.SHOT_DIR ?? "./shots";
const EMAIL = process.env.ADMIN_EMAIL;
const TEMP = process.env.TEMP_PASSWORD;
const NEW_PASSWORD = "Browser-Admin-Own-Passphrase-7";
if (!EMAIL || !TEMP) throw new Error("ADMIN_EMAIL and TEMP_PASSWORD are required");
mkdirSync(OUT, { recursive: true });

// --- TOTP (RFC 6238), to act as the authenticator app ----------------------
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(text) {
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
}
function totp(secret, step) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const hash = createHmac("sha1", secret).update(message).digest();
  const offset = hash[hash.length - 1] & 15;
  const binary =
    ((hash[offset] & 127) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}
const stepNow = () => Math.floor(Date.now() / 30_000);
/** A code is never accepted twice: wait for a step that was not used yet. */
async function codeAfter(secret, usedStep) {
  while (stepNow() <= usedStep) await new Promise((r) => setTimeout(r, 500));
  return { code: totp(secret, stepNow()), step: stepNow() };
}

const results = [];
// Next.js renders its own role="alert" (the route announcer): target ours.
const errorAlert = () => page.locator('p[role="alert"]');
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  // 4xx answers are expected (wrong codes on purpose); anything else is not.
  if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) {
    problems.push(`console: ${m.text()}`);
  }
});

async function signIn(password) {
  await page.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
}

// 1. Temporary password -> forced change.
await signIn(TEMP);
await page.waitForURL("**/change-password");
check("temporary password leads to /change-password", true);
await page.screenshot({ path: `${OUT}/01-change-password.png` });

await page.fill("#current-password", TEMP);
await page.fill("#new-password", NEW_PASSWORD);
await page.fill("#confirm-password", NEW_PASSWORD);
await page.screenshot({ path: `${OUT}/02-change-password-filled.png` });
await page.click('button[type="submit"]');
await page.waitForURL("**/mfa/setup");
check("new password leads to /mfa/setup", true);

// 2. The console is closed until the authenticator is set up.
await page.goto(`${WEB}/dashboard`);
await page.waitForURL("**/mfa/setup");
check("/dashboard redirects to /mfa/setup while MFA is not set up", true);

// 3. Scan step: read the setup key like a user typing it into their app.
const keyLocator = page.locator(".mfa-secret code");
await keyLocator.waitFor();
await page.locator('img[alt^="QR code"]').waitFor();
const secret = base32Decode(await keyLocator.innerText());
check("QR code and setup key shown", secret.length === 20, `${secret.length} bytes`);
await page.screenshot({ path: `${OUT}/03-mfa-scan.png` });
await page.getByRole("button", { name: /scanned the code/i }).click();

// 4. Wrong code first, then the right one.
await page.locator('input[name="verification-code"]').fill("000000");
await page.getByRole("button", { name: /verify securely/i }).click();
await errorAlert().waitFor();
check(
  "a wrong code is refused",
  /doesn.t match/i.test(await errorAlert().innerText()),
);
let used = stepNow() - 1;
let next = await codeAfter(secret, used);
await page.locator('input[name="verification-code"]').fill(next.code);
used = next.step;
await page.getByRole("button", { name: /verify securely/i }).click();

// 5. Recovery codes, shown once.
await page.getByRole("heading", { name: /save your recovery codes/i }).waitFor();
const codes = await page.locator('ol[aria-label="Recovery codes"] li').allInnerTexts();
const recoveryCodes = codes.map((t) => t.replace(/^\d+\.\s*/, "").trim());
check("10 recovery codes shown", recoveryCodes.length === 10, recoveryCodes[0]);
const continueButton = page.getByRole("button", { name: /^continue$/i });
check("continue is disabled until the codes are saved", await continueButton.isDisabled());
await page.screenshot({ path: `${OUT}/04-recovery-codes.png` });
await page.getByLabel(/stored these codes/i).check();
await continueButton.click();
await page.getByRole("link", { name: /continue to dashboard/i }).click();
await page.waitForURL("**/dashboard");
check("setup finished: the console opens", true);
await page.screenshot({ path: `${OUT}/05-dashboard.png` });

// 6. Sign in again: password, then a TOTP code.
await context.clearCookies();
await signIn(NEW_PASSWORD);
await page.waitForURL("**/mfa/verify");
check("password now leads to /mfa/verify", true);
await page.screenshot({ path: `${OUT}/06-mfa-verify.png` });
next = await codeAfter(secret, used);
used = next.step;
await page.locator('input[name="verification-code"]').fill(next.code); // auto-submits
await page.waitForURL("**/dashboard");
check("the TOTP code signs in", true);

// 7. And with a recovery code (lost phone).
await context.clearCookies();
await signIn(NEW_PASSWORD);
await page.waitForURL("**/mfa/verify");
await page.getByRole("button", { name: /use a recovery code/i }).click();
await page.fill("#recovery-code", recoveryCodes[0].toLowerCase());
await page.screenshot({ path: `${OUT}/07-mfa-recovery.png` });
await page.getByRole("button", { name: /verify and sign in/i }).click();
await page.waitForURL("**/dashboard");
check("a recovery code signs in", true);

// 8. That recovery code is spent.
await context.clearCookies();
await signIn(NEW_PASSWORD);
await page.waitForURL("**/mfa/verify");
await page.getByRole("button", { name: /use a recovery code/i }).click();
await page.fill("#recovery-code", recoveryCodes[0]);
await page.getByRole("button", { name: /verify and sign in/i }).click();
await errorAlert().waitFor();
check(
  "a used recovery code is refused",
  /not valid or was already used/i.test(await errorAlert().innerText()),
);

// 9. Reloading the code screen does not keep the challenge.
await page.reload();
await page.waitForURL(WEB + "/");
check("reloading /mfa/verify sends back to sign in", true);

console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no page errors");
await browser.close();
process.exit(results.every(Boolean) && problems.length === 0 ? 0 : 1);
