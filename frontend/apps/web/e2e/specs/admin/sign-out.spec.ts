import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../../support/env";
import { freshCode } from "../../support/totp";

// A separate session, so signing out does not revoke the shared one.
test.use({ storageState: { cookies: [], origins: [] } });

test("an enrolled admin signs in with a code and signs out", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/mfa/verify");

  await page.locator('input[name="verification-code"]').fill(await freshCode());
  await page.waitForURL("**/dashboard");

  await page.getByRole("button", { name: /account menu for/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL("**/sign-in");

  // The revoked session no longer opens the console.
  await page.goto("/dashboard");
  await page.waitForURL("**/sign-in");
  await expect(page.locator("#email")).toBeVisible();
});
