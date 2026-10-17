import { expect, test as setup } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../support/env";
import {
  currentStep,
  decodeBase32,
  saveAuthenticator,
  totp,
} from "../support/totp";

/** First sign-in of the bootstrap admin: enroll an authenticator, keep the session. */
setup("admin enrolls an authenticator on first sign-in", async ({ page }) => {
  await page.goto("/sign-in");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/mfa/setup");

  const secret = (await page.locator(".mfa-key-row code").innerText()).replace(
    /\s/g,
    "",
  );
  await page.getByRole("button", { name: /scanned the code/i }).click();
  const step = currentStep();
  await page
    .locator('input[name="verification-code"]')
    .fill(totp(decodeBase32(secret), step));
  saveAuthenticator(secret, step);
  await page.getByRole("button", { name: /verify securely/i }).click();

  await expect(page.locator(".mfa-recovery-grid li")).toHaveCount(10);
  await page.getByLabel(/stored these codes/i).check();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("link", { name: /continue to dashboard/i }).click();
  await page.waitForURL("**/dashboard");

  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
