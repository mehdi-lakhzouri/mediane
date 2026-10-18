import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  // Self-contained server for the container image (apps/web/Dockerfile).
  output: "standalone",
  // Trace files from the workspace root so @repo/* packages are included.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default nextConfig;
