import { expect, test } from "@playwright/test";

test("the dashboard loads for an enrolled admin", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: /account menu for/i }),
  ).toBeVisible();
});

test("the settings page shows MFA on with a full set of recovery codes", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  await expect(page.getByText(/\b10 of 10\b/).first()).toBeVisible();
});

test("the console runs under its Content Security Policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  for (const path of [
    "/dashboard",
    "/dashboard/settings",
    "/dashboard/families",
    "/dashboard/audit",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: /account menu for/i }),
    ).toBeVisible();
  }
  expect(violations).toEqual([]);
});

test("session cookies are HttpOnly and SameSite=Strict", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: /account menu for/i }),
  ).toBeVisible();

  const cookies = await page.context().cookies();
  const session = cookies.filter((c) => /cg_(at|rt)$/.test(c.name));
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) {
    expect(cookie.httpOnly, cookie.name).toBe(true);
    expect(cookie.sameSite, cookie.name).toBe("Strict");
  }
});
