import { expect, test } from "@playwright/test";

// Links meant for the driver app: without the app, the browser lands on a page
// that hands them over, and never redeems the single-use token itself.

test("a driver invitation hands the token over to the app, unused", async ({
  page,
}) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) apiCalls.push(request.url());
  });

  await page.goto("/mobile/accept-invitation#token=one-time-token-123");

  await expect(
    page.getByRole("heading", { name: /open mediane on your phone/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /open in the mediane app/i }),
  ).toHaveAttribute(
    "href",
    "cabinguard://app/accept-invitation#token=one-time-token-123",
  );
  expect(apiCalls).toEqual([]);
});

test("a family invitation link opens the same way", async ({ page }) => {
  await page.goto("/mobile/join-family#K7M4-QX9P");
  await expect(
    page.getByRole("link", { name: /open in the mediane app/i }),
  ).toHaveAttribute("href", "cabinguard://app/join-family#K7M4-QX9P");
});

test("a link without its token says so", async ({ page }) => {
  await page.goto("/mobile/accept-invitation");
  // The page's own alert, not Next's (empty) route announcer.
  await expect(page.locator('p[role="alert"]')).toContainText(/incomplete/i);
});

test("only the app's own links exist under /mobile", async ({ request }) => {
  const response = await request.get("/mobile/dashboard");
  expect(response.status()).toBe(404);
});

test("the site proves to Android that it belongs to the app", async ({
  request,
}) => {
  const response = await request.get("/.well-known/assetlinks.json");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");
  const [statement] = (await response.json()) as Array<{
    target: { package_name: string; sha256_cert_fingerprints: string[] };
  }>;
  expect(statement.target.package_name).toBe("com.cabinguard.mobile");
  expect(statement.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
});
