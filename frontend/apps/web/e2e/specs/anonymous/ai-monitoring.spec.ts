import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import type { AdminDevice } from "../../../lib/api/admin-devices";

function device(
  index: number,
  overrides: Partial<AdminDevice> = {},
): AdminDevice {
  return {
    id: `device-${index}`,
    label: `Cabin ${String(index).padStart(3, "0")}`,
    serialNumber: `CG-DEMO-${index}`,
    status: "ACTIVE",
    associationId: `association-${index}`,
    pairedUserId: `driver-${index}`,
    pairedDriver: {
      firstName: "Driver",
      lastName: String(index),
      email: `driver${index}@example.test`,
    },
    lastSeenAt: new Date().toISOString(),
    pairedAt: "2026-10-01T10:00:00Z",
    createdAt: "2026-10-01T09:00:00Z",
    revokedAt: null,
    secretRotatedAt: null,
    firmwareVersion: "1.2.0",
    runtimeHealth: {
      runtimeVersion: "0.2.0",
      bootId: "demo",
      queueDepth: 0,
      cardiac: "READY",
      seizure: "READY",
      stroke: "READY",
    },
    ...overrides,
  };
}

async function mockMonitoring(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  devices: AdminDevice[],
  locale = "en",
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.addCookies([
    { name: "cg.locale", value: locale, url: baseURL },
  ]);
  const state = { unavailable: false, pages: [] as number[] };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      "access-control-allow-origin": baseURL,
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
    let data: unknown = [],
      pagination = {};
    if (url.pathname.endsWith("/auth/me")) {
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
    } else if (url.pathname.endsWith("/admin/devices")) {
      if (state.unavailable) {
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
      const current = Number(url.searchParams.get("page") ?? 1),
        size = Number(url.searchParams.get("pageSize") ?? 10);
      state.pages.push(current);
      data = devices.slice((current - 1) * size, current * size);
      pagination = {
        page: current,
        pageSize: size,
        totalItems: devices.length,
        totalPages: Math.ceil(devices.length / size),
      };
    }
    await route.fulfill({
      headers,
      json: { data, meta: { pagination }, error: null },
    });
  });
  return state;
}

test("monitoring shows shadow coverage, stale devices, and refresh failures", async ({
  page,
  context,
  baseURL,
}) => {
  const runtimeHealth = {
    runtimeVersion: "0.2.0",
    bootId: "demo",
    queueDepth: 2,
    cardiac: "READY",
    seizure: "READY",
    stroke: "WARMING_UP",
  };
  const state = await mockMonitoring(page, context, baseURL!, [
    device(1, { label: "Replay cabin", runtimeHealth }),
    device(2, {
      label: "Offline cabin",
      lastSeenAt: "2020-01-01T00:00:00Z",
      pairedDriver: null,
      runtimeHealth,
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/health");
  await expect(
    page.getByRole("heading", { name: "Monitoring coverage" }),
  ).toBeVisible();
  const replay = page.getByRole("row").filter({ hasText: "Replay cabin" });
  await expect(replay.getByText("Warming up", { exact: true })).toHaveCount(2);
  const offline = page.getByRole("row").filter({ hasText: "Offline cabin" });
  await expect(offline.getByText("Unavailable", { exact: true })).toHaveCount(
    4,
  );
  await expect(page.getByRole("button", { name: "Cards view" })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Rows per page" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../../.tmp-health-review/health-table.png",
    fullPage: true,
    animations: "disabled",
  });
  state.unavailable = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Monitoring could not" }),
  ).toContainText("outdated");
  await expect(replay.getByText("Unavailable", { exact: true })).toHaveCount(4);
  const stats = page.getByRole("region", {
    name: "Fleet monitoring statistics",
  });
  await expect(stats.getByText("—", { exact: true })).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Cards view" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Replay cabin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Monitoring coverage" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../../.tmp-health-review/health-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("fleet counts, search, sorting, filters, details and card view use all API pages", async ({
  page,
  context,
  baseURL,
}) => {
  const devices = Array.from({ length: 105 }, (_, index) => device(index + 1));
  devices[0] = device(1, { lastSeenAt: "2020-01-01T00:00:00Z" });
  const state = await mockMonitoring(page, context, baseURL!, devices);
  await page.goto("/dashboard/health");
  await expect(
    page.getByRole("row").filter({ hasText: "Cabin 001" }),
  ).toBeVisible();
  expect([...new Set(state.pages)]).toEqual([1, 2]);
  await expect(page.locator("tbody tr")).toHaveCount(5);
  const stats = page.getByRole("region", {
    name: "Fleet monitoring statistics",
  });
  await expect(stats.locator("article").first().locator(".sr-only")).toHaveText(
    "105",
  );
  const search = page.getByRole("textbox", {
    name: "Search monitoring devices",
  });
  await search.fill("driver105@example.test");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("row").filter({ hasText: "Cabin 105" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View details for CG-DEMO-105" })
    .click();
  const details = page.getByRole("dialog");
  await expect(
    details.getByRole("heading", { name: "Device details" }),
  ).toBeVisible();
  await expect(
    details.getByText("driver105@example.test", { exact: true }),
  ).toBeVisible();
  await expect(details.getByText("0.2.0", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../../../.tmp-health-review/health-details.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await search.fill("");
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Cabin 105");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Cabin 100");
  await page
    .getByRole("combobox", { name: "Filter monitoring availability" })
    .click();
  await page
    .getByRole("option", { name: "Offline devices", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("Cabin 001");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("button", { name: "Cards view" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Cabin 105" }),
  ).toBeVisible();
  const cardFieldsFit = await page
    .getByRole("article")
    .filter({ hasText: "Cabin 105" })
    .locator("dd")
    .evaluateAll((fields) =>
      fields.every((field) => field.scrollWidth <= field.clientWidth + 1),
    );
  expect(cardFieldsFit).toBe(true);
  await page.screenshot({
    path: "../../../.tmp-health-review/health-cards.png",
    fullPage: true,
    animations: "disabled",
  });
  await search.fill("missing-device");
  await expect(
    page.getByRole("heading", { name: "No matching devices" }),
  ).toBeVisible();
});

test("French monitoring expires stale detector readiness even when refresh still works", async ({
  page,
  context,
  baseURL,
}) => {
  await page.clock.install();
  await mockMonitoring(page, context, baseURL!, [device(1)], "fr");
  await page.goto("/dashboard/health");
  await expect(
    page.getByRole("heading", { name: "Couverture de surveillance" }),
  ).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Cabin 001" });
  await expect(row.getByText("Disponible", { exact: true })).toHaveCount(4);
  await page.clock.fastForward(121_000);
  await expect(row.getByText("Indisponible", { exact: true })).toHaveCount(4);
  await expect(
    row.getByText("Aucun signal depuis plus de 2 minutes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Filtrer la disponibilité" }),
  ).toBeVisible();
});

test("an initial API failure shows unknown counts and recovers on refresh", async ({
  page,
  context,
  baseURL,
}) => {
  const state = await mockMonitoring(page, context, baseURL!, [device(1)]);
  state.unavailable = true;
  await page.goto("/dashboard/health");
  await expect(
    page.getByRole("heading", { name: "Devices could not be loaded" }),
  ).toBeVisible();
  const stats = page.getByRole("region", {
    name: "Fleet monitoring statistics",
  });
  await expect(stats.getByText("—", { exact: true })).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "No devices registered yet" }),
  ).toHaveCount(0);
  state.unavailable = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Cabin 001" });
  await expect(row.getByText("Ready", { exact: true })).toHaveCount(4);
  await expect(
    page.getByRole("alert").filter({ hasText: "Monitoring could not" }),
  ).toHaveCount(0);
});
