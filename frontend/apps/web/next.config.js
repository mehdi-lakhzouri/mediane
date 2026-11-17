import process from "node:process";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// On Vercel the browser stays on this origin; an external rewrite reaches the VPS.
// Direct API origins remain supported for local development.
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
const sameOriginApi = apiBaseUrl === "/api/v1";
const apiOrigin = sameOriginApi ? "" : new URL(apiBaseUrl).origin;
const proxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

if (sameOriginApi && !proxyTarget) {
  throw new Error(
    "API_PROXY_TARGET is required when NEXT_PUBLIC_API_BASE_URL=/api/v1",
  );
}
if (proxyTarget) {
  const target = new URL(proxyTarget);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/"
  ) {
    throw new Error(
      "API_PROXY_TARGET must be an HTTP(S) origin without a path or credentials",
    );
  }
  if (process.env.VERCEL && target.protocol !== "https:") {
    throw new Error("API_PROXY_TARGET must use HTTPS on Vercel");
  }
}

/**
 * 'unsafe-inline' scripts: Next.js streams per-page inline scripts (RSC
 * payload) and the root layout sets the theme inline. A nonce-based policy
 * needs a proxy and dynamic rendering of every page; until then the rest of
 * the policy still blocks framing, plugins, <base> hijacking, foreign form
 * targets and calls to any origin other than the API.
 */
function securityHeaders(isDev) {
  const contentSecurityPolicy = [
    "default-src 'self'",
    // Dev only: React Refresh evaluates code and HMR uses a websocket.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Ignored by browsers over plain http; effective once served over https.
    ...(isDev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]),
  ];
}

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    transpilePackages: ["@repo/ui"],
    // Self-contained server for the container image (apps/web/Dockerfile).
    output: "standalone",
    // Trace files from the workspace root so @repo/* packages are included.
    outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
    // No "X-Powered-By: Next.js" fingerprint.
    poweredByHeader: false,
    experimental: {
      // Nudge coding agents about security upgrades for this app.
      agentUpgrade: "security",
    },
    async rewrites() {
      return sameOriginApi
        ? [
            {
              source: "/api/v1/:path*",
              destination: `${proxyTarget}/api/v1/:path*`,
            },
          ]
        : [];
    },
    async headers() {
      // Let NestJS own API headers, including its file content/security headers.
      return [
        { source: "/((?!api/v1(?:/|$)).*)", headers: securityHeaders(isDev) },
      ];
    },
  };
}
