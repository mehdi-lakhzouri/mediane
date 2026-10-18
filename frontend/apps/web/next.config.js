import process from "node:process";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// The only other origin the browser talks to (inlined at build time, like the client).
const apiOrigin = new URL(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1",
).origin;

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
    `connect-src 'self' ${apiOrigin}${isDev ? " ws: wss:" : ""}`,
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
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders(isDev) }];
    },
  };
}
