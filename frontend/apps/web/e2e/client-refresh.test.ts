/**
 * Unit check for the refresh interceptor, with fetch stubbed. The browser
 * checks in refresh.check.mjs exercise the real API but cannot force several
 * client calls to 401 at the same instant, which is what single-flight guards.
 *
 * Run: node e2e/client-refresh.test.ts
 */
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test/api/v1";

const { api, setCsrfToken, onSessionLost, ApiError } = await import(
  "../lib/api/client.ts"
);

type Handler = (path: string, method: string) => Response;

function envelope(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ok(data: unknown): Response {
  return envelope(200, { data, meta: { requestId: "r", timestamp: "t" }, error: null });
}

function unauthorized(): Response {
  return envelope(401, {
    data: null,
    meta: { requestId: "r", timestamp: "t" },
    error: { code: "SESSION_INVALID", message: "nope" },
  });
}

let calls: string[] = [];
let handler: Handler;

globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  calls.push(`${method} ${url.pathname}`);
  return Promise.resolve(handler(url.pathname, method));
}) as typeof fetch;

const countRefreshes = () =>
  calls.filter((c) => c === "POST /api/v1/auth/refresh").length;

// --- one refresh is shared by a burst of concurrent 401s --------------------
{
  calls = [];
  setCsrfToken("csrf-1");
  let accessValid = false;

  handler = (path) => {
    if (path.endsWith("/auth/refresh")) {
      accessValid = true;
      return ok({ csrfToken: "csrf-2" });
    }
    return accessValid ? ok({ userId: "u1" }) : unauthorized();
  };

  const results = await Promise.all([
    api.get<{ userId: string }>("/auth/me"),
    api.get<{ userId: string }>("/auth/me"),
    api.get<{ userId: string }>("/auth/me"),
    api.get<{ userId: string }>("/auth/me"),
  ]);

  assert.equal(countRefreshes(), 1, `expected 1 refresh, got ${countRefreshes()}`);
  results.forEach((r) => assert.equal(r.userId, "u1"));
  console.log("PASS  four concurrent 401s share a single refresh");
}

// --- a failed refresh surfaces the 401 and signals the shell once ----------
{
  calls = [];
  setCsrfToken("csrf-1");
  let lost = 0;
  const stop = onSessionLost(() => {
    lost += 1;
  });

  handler = (path) =>
    path.endsWith("/auth/refresh") ? unauthorized() : unauthorized();

  await assert.rejects(
    () => api.get("/auth/me"),
    (err: unknown) => err instanceof ApiError && err.status === 401,
  );
  stop();

  assert.equal(countRefreshes(), 1, "refresh should be attempted exactly once");
  assert.equal(lost, 1, "session-lost should fire once");
  console.log("PASS  a failed refresh reports the 401 and signals once");
}

// --- the refresh endpoint itself never recurses ----------------------------
{
  calls = [];
  setCsrfToken("csrf-1");
  handler = () => unauthorized();

  await assert.rejects(() => api.post("/auth/refresh"));
  assert.equal(countRefreshes(), 1, "POST /auth/refresh must not retry itself");
  console.log("PASS  /auth/refresh does not refresh-loop");
}

// --- a 401 on login is reported, never refreshed ---------------------------
{
  calls = [];
  setCsrfToken("csrf-1");
  handler = () => unauthorized();

  await assert.rejects(() => api.post("/auth/login", { email: "a@b.c" }));
  assert.equal(countRefreshes(), 0, "login must not trigger a refresh");
  console.log("PASS  a rejected login does not trigger a refresh");
}

console.log("\nall client refresh checks passed");
