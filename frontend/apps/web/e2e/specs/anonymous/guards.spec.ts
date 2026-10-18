import { expect, test } from "@playwright/test";
import { API_URL } from "../../support/env";

test("the console sends a visitor without a session to sign in", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.waitForURL("**/sign-in");
});

test("the API refuses an anonymous call to an admin route", async ({
  request,
}) => {
  const response = await request.get(`${API_URL}/admin/users`);
  expect(response.status()).toBe(401);
});

test("API responses carry the hardening headers", async ({ request }) => {
  const response = await request.get(`${API_URL}/health`);
  expect(response.ok()).toBe(true);

  const headers = response.headers();
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("default-src");
  expect(
    headers["x-frame-options"] ?? headers["content-security-policy"],
  ).toMatch(/DENY|SAMEORIGIN|frame-ancestors/i);
});
