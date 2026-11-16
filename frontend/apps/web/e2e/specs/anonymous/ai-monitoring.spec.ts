import { expect, test } from "@playwright/test";

test("monitoring shows shadow coverage, stale devices, and refresh failures", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "cg.locale", value: "en", url: baseURL! }]);
  let unavailable = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": baseURL!,
      "access-control-allow-credentials": "true",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
      return;
    }
    let data: unknown = [];
    let pagination = {};
    if (path.endsWith("/auth/me")) {
      data = {
        userId: "demo-admin",
        role: "ADMIN",
        accountState: "ACTIVE",
        firstName: "Demo",
        lastName: "Admin",
        email: "demo@example.test",
        sessionPolicy: {
          idleTimeoutSeconds: 1800,
          warningSeconds: 120,
          countdownSeconds: 60,
          activityHeartbeatSeconds: 60,
        },
      };
    } else if (path.endsWith("/admin/devices")) {
      if (unavailable) {
        await route.fulfill({
          status: 503,
          headers,
          json: {
            data: null,
            error: { code: "UNAVAILABLE", message: "Unavailable" },
          },
        });
        return;
      }
      const runtimeHealth = {
        runtimeVersion: "0.1.0",
        bootId: "demo",
        queueDepth: 2,
        cardiac: "READY",
        seizure: "READY",
        stroke: "WARMING_UP",
      };
      data = [
        {
          id: "demo-1",
          label: "Replay cabin",
          serialNumber: "CG-DEMO-1",
          status: "ACTIVE",
          aiMode: "SHADOW",
          pairedUserId: "demo-driver",
          pairedDriver: {
            firstName: "Demo",
            lastName: "Driver",
            email: "driver@example.test",
          },
          lastSeenAt: new Date().toISOString(),
          runtimeHealth,
        },
        {
          id: "demo-2",
          label: "Offline cabin",
          serialNumber: "CG-DEMO-2",
          status: "ACTIVE",
          aiMode: "SHADOW",
          pairedUserId: "demo-other",
          pairedDriver: null,
          lastSeenAt: "2020-01-01T00:00:00Z",
          runtimeHealth,
        },
      ];
      pagination = { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 };
    }
    await route.fulfill({
      headers,
      json: { data, meta: { pagination }, error: null },
    });
  });
  await page.goto("/dashboard/health");
  await expect(
    page.getByRole("heading", { name: "Monitoring coverage" }),
  ).toBeVisible();
  const replay = page.getByRole("row").filter({ hasText: "Replay cabin" });
  await expect(replay.getByText("Shadow", { exact: true })).toBeVisible();
  await expect(replay.getByText("Warming up", { exact: true })).toHaveCount(2);
  const offline = page.getByRole("row").filter({ hasText: "Offline cabin" });
  await expect(offline.getByText("Unavailable", { exact: true })).toHaveCount(
    4,
  );
  unavailable = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Monitoring could not" }),
  ).toContainText("outdated");
  await expect(replay.getByText("Unavailable", { exact: true })).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Monitoring coverage" }),
  ).toBeVisible();
});
