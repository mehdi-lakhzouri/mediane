#!/usr/bin/env node
/**
 * Runs a Node tool installed in one sub-project on the files pre-commit passes,
 * from that sub-project's directory (so its own config applies).
 *
 *   node scripts/git-hooks/run-in.mjs <project-dir> <package> [tool args...] -- <files...>
 *   e.g. node scripts/git-hooks/run-in.mjs backend eslint --max-warnings 0
 *
 * Cross-platform on purpose: no shell, no npx (.cmd shims need a shell on Windows).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";

const [projectDir, pkg, ...rest] = process.argv.slice(2);
if (!projectDir || !pkg) {
  console.error("usage: run-in.mjs <project-dir> <package> [args...] [files...]");
  process.exit(2);
}

const cwd = resolve(projectDir);
// pre-commit appends repo-relative file paths: make them relative to the project.
const prefix = `${projectDir.replace(/\/$/, "")}/`;
const args = rest.map((arg) =>
  arg.startsWith(prefix) ? relative(cwd, resolve(arg)) : arg,
);

let bin;
try {
  const require = createRequire(join(cwd, "package.json"));
  const manifestPath = require.resolve(`${pkg}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entry =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[pkg];
  bin = join(dirname(manifestPath), entry);
} catch {
  console.error(
    `${pkg} is not installed in ${projectDir}: run the install there first.`,
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [bin, ...args], {
  cwd,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
