import { expect, test } from "@playwright/test";

for (const path of ["/", "/sign-in"]) {
  test(`${path} carries the browser hardening headers`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    const csp = headers["content-security-policy"] ?? "";
    for (const directive of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain("unsafe-eval");
  });
}

test("credentials are never sent in a URL, even before hydration", async ({
  page,
}) => {
  await page.goto("/sign-in");
  // A native submit (JavaScript not loaded yet) must POST, not GET ?password=.
  await expect(page.locator("form")).toHaveAttribute("method", "post");
});
