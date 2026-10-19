/**
 * Responsive dashboard audit with API fixtures.
 *
 * Run while the web app is available (defaults to http://localhost:3000):
 *   node e2e/responsive-dashboard.check.mjs
 *
 * The widths model a 1440px browser at common zoom levels. Browser zoom
 * reduces the CSS viewport, so 110% is approximately 1309 CSS pixels, etc.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API_PATTERN = "http://localhost:4000/api/v1/**";
const NOW = "2026-10-08T09:30:00.000Z";
const SHOT_DIR = process.env.SHOT_DIR;

if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });

const viewports = [
  { label: "100%", width: 1440, height: 900 },
  { label: "110%", width: 1309, height: 818 },
  { label: "125%", width: 1152, height: 720 },
  { label: "150%", width: 960, height: 600 },
  { label: "mobile", width: 390, height: 844 },
];

const paths = [
  "/dashboard",
  "/dashboard/drivers",
  "/dashboard/families",
  "/dashboard/invitations",
  "/dashboard/health",
  "/dashboard/incidents",
  "/dashboard/audit",
  "/dashboard/profile",
  "/dashboard/settings",
  "/dashboard/settings#security",
  "/dashboard/settings#team",
  "/dashboard/settings#notifications",
  "/dashboard/settings#preferences",
];

const user = {
  userId: "11111111-1111-4111-8111-111111111111",
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@cabinguard.test",
  firstName: "Mariam",
  lastName: "Diallo",
  role: "ADMIN",
  status: "ACTIVE",
  accountState: "ACTIVE",
  sessionPolicy: {
    idleTimeoutSeconds: 1800,
    warningSeconds: 20,
    countdownSeconds: 10,
    activityHeartbeatSeconds: 60,
  },
  mfaEnabled: true,
  lastLoginAt: NOW,
  createdAt: "2026-01-12T08:00:00.000Z",
  deletedAt: null,
};

const users = Array.from({ length: 8 }, (_, index) => ({
  ...user,
  id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
  userId: undefined,
  email: `driver${index + 1}@cabinguard.test`,
  firstName: ["Amara", "Noah", "Fatou", "Liam"][index % 4],
  lastName: ["Okafor", "Mensah", "Traoré", "Adeyemi"][index % 4],
  role: "DRIVER",
  lastLoginAt: NOW,
}));

const invitations = users.slice(0, 6).map((entry, index) => ({
  invitationId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  userId: entry.id,
  email: entry.email,
  firstName: entry.firstName,
  lastName: entry.lastName,
  role: "DRIVER",
  userStatus: "INVITED",
  userDeletedAt: null,
  status: index % 3 === 0 ? "ACCEPTED" : "PENDING",
  invitedBy: {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
  },
  createdAt: NOW,
  expiresAt: "2026-10-15T09:30:00.000Z",
  acceptedAt: index % 3 === 0 ? NOW : null,
  revokedAt: null,
}));

const families = Array.from({ length: 6 }, (_, index) => ({
  id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  name: `${["Okafor", "Mensah", "Traoré"][index % 3]} family`,
  createdAt: NOW,
  memberCount: 2 + (index % 5),
  owner: {
    userId: users[index].id,
    firstName: users[index].firstName,
    lastName: users[index].lastName,
  },
}));

const audit = Array.from({ length: 7 }, (_, index) => ({
  id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  action: index % 2 ? "USER_UPDATED" : "LOGIN_SUCCEEDED",
  category: index % 2 ? "ACCOUNT" : "ACCESS",
  outcome: "SUCCESS",
  actorType: "USER",
  actorUserId: user.id,
  actor: {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  },
  targetType: "USER",
  targetId: users[index % users.length].id,
  requestId: `req-${index}`,
  ipAddress: "192.0.2.10",
  userAgent: "Chrome on Windows",
  metadata: null,
  createdAt: NOW,
}));

const sessions = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    channel: "WEB",
    device: { label: "Chrome on Windows", platform: "WINDOWS", app: false },
    ipAddress: "192.0.2.10",
    signedInAt: NOW,
    lastActiveAt: NOW,
    current: true,
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    channel: "MOBILE",
    device: { label: "Pixel 9 · Android 16", platform: "ANDROID", app: true },
    ipAddress: "192.0.2.11",
    signedInAt: NOW,
    lastActiveAt: NOW,
    current: false,
  },
];

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("cg.sidebar.collapsed", "0");
  localStorage.setItem(
    "cg.dashboard-preferences",
    JSON.stringify({ density: "comfortable", timezone: "browser" }),
  );
});

await context.route(API_PATTERN, async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace("/api/v1", "");
  let data = null;
  let pagination;

  if (path === "/auth/me") data = user;
  else if (path === "/auth/activity") {
    data = { expiresAt: "2026-10-08T10:00:00.000Z" };
  } else if (path === "/auth/mfa") {
    data = {
      enabled: true,
      enabledAt: NOW,
      required: true,
      recoveryCodesRemaining: 8,
      recoveryCodesLow: false,
    };
  } else if (path === "/auth/sessions") data = sessions;
  else if (path === `/admin/users/${user.id}`) data = user;
  else if (path === "/admin/users") {
    data = users;
    pagination = pageMeta(users.length);
  } else if (path === "/admin/invitations/stats") {
    data = {
      total: 18,
      pending: 7,
      accepted: 9,
      expired: 1,
      revoked: 1,
      superseded: 0,
      acceptanceRate: 50,
    };
  } else if (path === "/admin/invitations") {
    data = invitations;
    pagination = pageMeta(invitations.length);
  } else if (path === "/admin/families/stats") {
    data = {
      totalFamilies: 14,
      totalMembers: 49,
      fullFamilies: 2,
      pendingRequests: 3,
      maxMembersPerFamily: 10,
      availableSeats: 91,
      averageMembers: 3.5,
    };
  } else if (path === "/admin/families") {
    data = families;
    pagination = pageMeta(families.length);
  } else if (path === "/admin/audit/stats") {
    data = {
      total: 148,
      last24Hours: 12,
      securityEvents: 4,
      failures: 2,
      uniqueActors: 8,
    };
  } else if (path === "/admin/audit") {
    data = audit;
    pagination = pageMeta(audit.length);
  } else if (path === "/admin/devices") {
    data = [];
    pagination = pageMeta(0);
  } else if (path === "/notifications/unread-count") data = { unread: 3 };
  else if (path === "/health") data = { status: "ok", database: "up" };
  else {
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify(
        envelope(null, undefined, {
          code: "SERVICE_UNAVAILABLE",
          message: `No responsive fixture for ${path}`,
        }),
      ),
    });
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(envelope(data, pagination)),
  });
});

const failures = [];
const page = await context.newPage();
page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));

for (const viewport of viewports) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  for (const path of paths) {
    await page.goto(`${WEB}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 10_000 });
    await page.waitForTimeout(650);

    const auditResult = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const main = document.querySelector("main");
      const viewportWidth = window.innerWidth;
      const offenders = [...document.querySelectorAll("main *")]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          )
            return false;
          const rect = element.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1 || rect.right <= 0)
            return false;
          if (
            element.closest("[data-slot='table-container'], [role='tablist']")
          )
            return false;
          return rect.left < viewportWidth && rect.right > viewportWidth + 2;
        })
        .slice(0, 5)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 140),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        });
      return {
        viewportWidth,
        documentWidth: Math.max(root.scrollWidth, body.scrollWidth),
        mainWidth: main?.scrollWidth ?? 0,
        mainClientWidth: main?.clientWidth ?? 0,
        offenders,
      };
    });

    const overflow = auditResult.documentWidth > auditResult.viewportWidth + 1;
    const mainOverflow =
      auditResult.mainWidth > auditResult.mainClientWidth + 1 &&
      auditResult.offenders.length > 0;
    const status = overflow || mainOverflow ? "FAIL" : "PASS";
    console.log(`${status} ${viewport.label.padEnd(6)} ${path}`);
    if (SHOT_DIR && (path === "/dashboard" || path === "/dashboard/settings")) {
      const routeName = path === "/dashboard" ? "overview" : "settings";
      await page.screenshot({
        path: `${SHOT_DIR}/${viewport.label.replace("%", "")}-${routeName}.png`,
        fullPage: true,
      });
    }
    if (status === "FAIL") {
      failures.push(
        `${viewport.label} ${path}: viewport=${auditResult.viewportWidth}, document=${auditResult.documentWidth}, main=${auditResult.mainWidth}/${auditResult.mainClientWidth}, offenders=${JSON.stringify(auditResult.offenders)}`,
      );
    }
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${WEB}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("main");
await page.getByRole("button", { name: "Switch to top navigation" }).click();
await page.waitForTimeout(400);

const topNavigation = page.getByRole("navigation", {
  name: "Dashboard navigation",
});
const navbarVisible = await topNavigation.isVisible();
const savedNavbarMode = await page.evaluate(
  () => localStorage.getItem("cg.dashboard.navigation-mode") === "navbar",
);
console.log(
  `${navbarVisible && savedNavbarMode ? "PASS" : "FAIL"} desktop navigation mode switch`,
);
if (!navbarVisible || !savedNavbarMode) {
  failures.push("top navigation did not become visible or persist its mode");
}

await topNavigation.getByRole("link", { name: "Users" }).click();
await page.waitForURL("**/dashboard/drivers");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("main");
const navbarRestored = await page
  .getByRole("button", { name: "Switch to sidebar navigation" })
  .isVisible();
console.log(`${navbarRestored ? "PASS" : "FAIL"} navigation mode persistence`);
if (!navbarRestored)
  failures.push("top navigation was not restored after reload");

await page
  .getByRole("button", { name: "Switch to sidebar navigation" })
  .click();
await page.waitForTimeout(400);

await page.setViewportSize({ width: 1152, height: 720 });
await page.goto(`${WEB}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("main");
await page.waitForTimeout(650);
await page.keyboard.press("Control+K");
await page.waitForSelector('[role="dialog"]');
console.log("PASS shortcut Ctrl+K opens dashboard search");

for (const viewport of [viewports[2], viewports[3], viewports[4]]) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await page.goto(`${WEB}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main");
  await page.waitForTimeout(350);
  await page.keyboard.press("Control+K");
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor();
  const box = await dialog.boundingBox();
  const fits =
    box &&
    box.x >= -1 &&
    box.x + box.width <= viewport.width + 1 &&
    box.y >= -1 &&
    box.y < viewport.height;
  console.log(
    `${fits ? "PASS" : "FAIL"} ${viewport.label.padEnd(6)} search dialog`,
  );
  if (!fits)
    failures.push(`${viewport.label}: search dialog is outside viewport`);
  await page.keyboard.press("Escape");
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${WEB}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("main");
await page.getByRole("button", { name: /open menu|ouvrir le menu/i }).click();
const drawer = page.locator("aside");
await drawer.waitFor();
const drawerBox = await drawer.boundingBox();
const drawerFits = !!drawerBox && drawerBox.width <= 390;
console.log(`${drawerFits ? "PASS" : "FAIL"} mobile sidebar drawer`);
if (!drawerFits) failures.push("mobile sidebar drawer exceeds viewport");

await browser.close();

if (failures.length) {
  console.error(`\nResponsive audit failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("\nResponsive dashboard audit passed.");

function pageMeta(totalItems) {
  return { page: 1, pageSize: 20, totalItems, totalPages: 1 };
}

function envelope(data, pagination, error = null) {
  return {
    data,
    meta: {
      requestId: "responsive-check",
      timestamp: NOW,
      ...(pagination ? { pagination } : {}),
    },
    error,
  };
}
