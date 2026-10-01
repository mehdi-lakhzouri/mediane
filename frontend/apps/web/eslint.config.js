import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  // Standalone Node scripts (design review captures, manual auth checks). They
  // run under Node via Playwright, not in the browser, and are not part of the
  // Next build.
  { ignores: ["e2e/**"] },
];
