import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type {
  AdminIncident,
  AdminIncidentDetail,
  IncidentStatus,
} from "../../../lib/api/admin-incidents";
import { incidentReference } from "../../../lib/api/admin-incidents";

function incident(index: number, status: IncidentStatus): AdminIncident {
  const openedAt = new Date(Date.now() - index * 60_000).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    status,
    driver: {
      id: `driver-${index}`,
      firstName: "Driver",
      lastName: `Demo ${index}`,
      email: `driver${index}@example.test`,
    },
    openedAt,
    respondBy:
      status === "AWAITING_RESPONSE"
        ? new Date(Date.parse(openedAt) + 30_000).toISOString()
        : null,
    acknowledgedAt: status === "FALSE_ALARM" ? openedAt : null,
    acknowledgedVia: status === "FALSE_ALARM" ? "APP" : null,
    escalatedAt:
      status === "ESCALATED" || status === "RESOLVED" ? openedAt : null,
    resolvedAt: status === "RESOLVED" ? openedAt : null,
    resolvedVia: status === "RESOLVED" ? "SYSTEM" : null,
    eventCount: 2,
    notificationCount: status === "ESCALATED" ? 2 : 0,
  };
}

async function mockIncidents(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  items: AdminIncident[],
  locale = "en",
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.addCookies([
    { name: "cg.locale", value: locale, url: baseURL },
  ]);
  const state = {
    failList: false,
    failDetail: false,
    queries: [] as URLSearchParams[],
  };
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
    const failure = async () => {
      await route.fulfill({
        status: 503,
        headers,
        json: {
          data: null,
          error: { code: "UNAVAILABLE", message: "Unavailable" },
        },
      });
    };
    if (url.pathname.endsWith("/auth/me")) {
      data = {
        userId: "demo-admin",
        role: "ADMIN",
        accountState: "ACTIVE",
        firstName: "Demo",
        lastName: "Admin",
        email: "admin@example.test",
        sessionPolicy: {
          idleTimeoutSeconds: 1800,
          warningSeconds: 120,
          countdownSeconds: 60,
          activityHeartbeatSeconds: 60,
        },
      };
    } else if (url.pathname.endsWith("/notifications/unread-count"))
      data = { unread: 0 };
    else if (url.pathname.endsWith("/admin/incidents/stats")) {
      if (state.failList) {
        await failure();
        return;
      }
      const count = (status: string) =>
        items.filter((item) => item.status === status).length;
      data = {
        total: items.length,
        awaitingResponse: count("AWAITING_RESPONSE"),
        escalated: count("ESCALATED"),
        resolved: count("RESOLVED"),
        falseAlarm: count("FALSE_ALARM"),
      };
    } else if (url.pathname.endsWith("/admin/incidents")) {
      if (state.failList) {
        await failure();
        return;
      }
      state.queries.push(url.searchParams);
      const query = url.searchParams.get("search")?.toLowerCase() ?? "";
      const status = url.searchParams.get("status"),
        period = url.searchParams.get("period");
      let filtered = items.filter(
        (item) =>
          (!query ||
            `${item.driver.firstName} ${item.driver.lastName} ${item.driver.email} ${item.id}`
              .toLowerCase()
              .includes(query)) &&
          (!status || item.status === status),
      );
      if (period) {
        const days = period === "24h" ? 1 : period === "7d" ? 7 : 30;
        filtered = filtered.filter(
          (item) => Date.parse(item.openedAt) >= Date.now() - days * 86_400_000,
        );
      }
      const sort = url.searchParams.get("sortBy") ?? "openedAt",
        dir = url.searchParams.get("sortDir") === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const value = (item: AdminIncident) =>
          sort === "driver"
            ? item.driver.lastName
            : sort === "status"
              ? item.status
              : sort === "respondBy"
                ? (item.respondBy ?? "")
                : item.openedAt;
        return (
          value(a).localeCompare(value(b), undefined, { numeric: true }) * dir
        );
      });
      const pageNumber = Number(url.searchParams.get("page") ?? 1),
        size = Number(url.searchParams.get("pageSize") ?? 5);
      data = filtered.slice((pageNumber - 1) * size, pageNumber * size);
      pagination = {
        page: pageNumber,
        pageSize: size,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
      };
    } else if (url.pathname.includes("/admin/incidents/")) {
      if (state.failDetail) {
        await failure();
        return;
      }
      const item = items.find((entry) => url.pathname.endsWith(entry.id))!;
      const detail: AdminIncidentDetail = {
        ...item,
        timeline: [
          { id: "entry-1", kind: "OPENED", at: item.openedAt },
          { id: "entry-2", kind: "ESCALATED", at: item.openedAt },
        ],
        notifications: [
          {
            id: "log-1",
            kind: "ALERT",
            channel: "LOG",
            status: "SENT",
            attemptedAt: item.openedAt,
          },
          {
            id: "sms-1",
            kind: "ALERT",
            channel: "SMS",
            status: "FAILED",
            attemptedAt: item.openedAt,
          },
        ],
      };
      data = detail;
    }
    await route.fulfill({
      headers,
      json: { data, meta: { pagination }, error: null },
    });
  });
  return state;
}

test("incident register uses server pagination, filters, sorting and global statistics", async ({
  page,
  context,
  baseURL,
}) => {
  const statuses: IncidentStatus[] = [
    "AWAITING_RESPONSE",
    "ESCALATED",
    "RESOLVED",
    "FALSE_ALARM",
  ];
  const items = Array.from({ length: 7 }, (_, index) =>
    incident(index + 1, statuses[index % 4]),
  );
  items[6].openedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const state = await mockIncidents(page, context, baseURL!, items);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/incidents");
  await expect(
    page.getByRole("heading", { name: "Incidents", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  const stats = page.getByRole("region", { name: "Fleet incident statistics" });
  await expect(stats.locator("article").first().locator(".sr-only")).toHaveText(
    "7",
  );
  await page.screenshot({
    path: "../../../.tmp-incidents-review/incidents-table.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Search incidents" })
    .fill("driver7@example.test");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("Driver Demo 7");
  expect(state.queries.at(-1)?.get("page")).toBe("1");
  await expect(stats.locator("article").first().locator(".sr-only")).toHaveText(
    "7",
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Filter incident status" }).click();
  await page.getByRole("option", { name: "Escalated", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  expect(state.queries.at(-1)?.get("status")).toBe("ESCALATED");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Filter incident period" }).click();
  await page
    .getByRole("option", { name: "Last 24 hours", exact: true })
    .click();
  await expect.poll(() => state.queries.at(-1)?.get("period")).toBe("24h");
  await expect(page.getByText("6 incident(s)", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("button", { name: "Driver", exact: true }).click();
  await expect.poll(() => state.queries.at(-1)?.get("sortBy")).toBe("driver");
  await page.getByRole("button", { name: "Cards view" }).click();
  const card = page.getByRole("article").filter({ hasText: "Driver Demo 1" });
  await expect(card).toBeVisible();
  expect(
    await card
      .locator("dd")
      .evaluateAll((fields) =>
        fields.every((field) => field.scrollWidth <= field.clientWidth + 1),
      ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../../.tmp-incidents-review/incidents-cards.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("textbox", { name: "Search incidents" })
    .fill("missing-driver");
  await expect(
    page.getByRole("heading", { name: "No matching incidents" }),
  ).toBeVisible();
});

test("incident details show response milestones, timeline and honest dispatch status", async ({
  page,
  context,
  baseURL,
}) => {
  const item = incident(2, "ESCALATED");
  const state = await mockIncidents(page, context, baseURL!, [item]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/incidents");
  await page
    .getByRole("button", { name: `View ${incidentReference(item.id)}` })
    .click();
  const details = page.getByRole("dialog");
  await expect(
    details.getByRole("heading", { name: "Incident details" }),
  ).toBeVisible();
  await expect(
    details.getByText(item.driver.email, { exact: true }),
  ).toBeVisible();
  await expect(
    details.getByRole("heading", { name: "Timeline" }),
  ).toBeVisible();
  await expect(
    details.getByText("Escalation initiated", { exact: true }),
  ).toBeVisible();
  await expect(
    details.getByText("Recorded locally", { exact: true }),
  ).toBeVisible();
  await expect(details.getByText("Failed", { exact: true })).toBeVisible();
  await expect(
    details.getByText("Accepted by channel", { exact: true }),
  ).toHaveCount(0);
  await details
    .getByText("Channel acceptance does not confirm delivery", { exact: false })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../../../.tmp-incidents-review/incidents-details.png",
    fullPage: true,
    animations: "disabled",
  });
  state.failDetail = true;
  await details.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(details.getByRole("alert")).toContainText("last known state");
});

test("French cards fit narrow screens and failures preserve the last snapshot", async ({
  page,
  context,
  baseURL,
}) => {
  const state = await mockIncidents(
    page,
    context,
    baseURL!,
    [incident(1, "AWAITING_RESPONSE")],
    "fr",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/incidents");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Vue cartes" }).click();
  const card = page.getByRole("article").filter({ hasText: "Driver Demo 1" });
  await expect(card).toBeVisible();
  expect(
    await card
      .locator("dd")
      .evaluateAll((fields) =>
        fields.every((field) => field.scrollWidth <= field.clientWidth + 1),
      ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../../.tmp-incidents-review/incidents-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  state.failList = true;
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Les incidents" }),
  ).toContainText("anciennes");
  await expect(card).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Statistiques des incidents de la flotte" })
      .getByText("—", { exact: true }),
  ).toHaveCount(5);
});

test("empty register explains replay and an initial outage does not report zero incidents", async ({
  page,
  context,
  baseURL,
}) => {
  const state = await mockIncidents(page, context, baseURL!, []);
  state.failList = true;
  await page.goto("/dashboard/incidents");
  await expect(
    page.getByRole("heading", { name: "Incidents could not be loaded" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Fleet incident statistics" })
      .getByText("—", { exact: true }),
  ).toHaveCount(5);
  state.failList = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No incidents recorded" }),
  ).toBeVisible();
  await expect(page.getByText(/Replayed AI scenarios are saved/)).toBeVisible();
});
