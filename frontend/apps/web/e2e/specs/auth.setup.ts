import { expect, test as setup } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../support/env";
import {
  currentStep,
  decodeBase32,
  saveAuthenticator,
  totp,
} from "../support/totp";

/**
 * First sign-in of the bootstrap admin. Two-step verification is optional,
 * so the password alone opens the console; the admin then turns it on from
 * Settings > Security, which the other specs rely on.
 */
setup(
  "admin signs in, then turns two-step verification on",
  async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");

    await page.goto("/dashboard/settings#security");
    await page.getByRole("button", { name: "Turn on", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /turn on two-step verification/i }),
    ).toBeVisible();

    const secret = (await dialog.locator("p.font-mono").innerText()).replace(
      /\s/g,
      "",
    );
    const step = currentStep();
    await dialog
      .locator('input[name="verification-code"]')
      .fill(totp(decodeBase32(secret), step));
    saveAuthenticator(secret, step);
    await dialog.getByRole("button", { name: /confirm new app/i }).click();

    await expect(dialog.locator("ol li")).toHaveCount(10);
    await dialog.getByLabel(/stored these codes/i).check();
    await dialog.getByRole("button", { name: /^done$/i }).click();
    await expect(dialog).toBeHidden();

    await page.context().storageState({ path: "e2e/.auth/admin.json" });
  },
);
