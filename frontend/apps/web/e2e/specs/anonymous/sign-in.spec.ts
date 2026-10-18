import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL } from "../../support/env";

// Sign-in is rate limited (5 attempts per minute per client): the whole suite
// stays under it, so keep failed attempts here to a minimum.

async function failedSignIn(page: Page, email: string): Promise<string> {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", "definitely-not-the-password-1!");
  await page.click('button[type="submit"]');
  // The form's own alert, not Next's (empty) route announcer.
  const alert = page.locator('p[role="alert"]');
  await expect(alert).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
  return alert.innerText();
}

test("renders the sign-in form", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/sign in/i);
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toHaveAttribute("type", "password");
});

test("a wrong password and an unknown account get the same answer", async ({
  page,
}) => {
  const wrongPassword = await failedSignIn(page, ADMIN_EMAIL);
  const unknownAccount = await failedSignIn(page, "nobody@cabinguard.test");

  // No account enumeration through the error message.
  expect(unknownAccount).toBe(wrongPassword);
  expect(wrongPassword).not.toMatch(/too many/i);
});
