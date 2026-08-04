#!/usr/bin/env node
/**
 * Release gate: fails unless the release tag, package.json version, and
 * CHANGELOG.md agree. Runs before any publication step.
 *
 * Usage: node scripts/verify-release-tag.js <tag>
 *   <tag> defaults to $GITHUB_REF_NAME (e.g. "v0.6.0").
 */
import { readFileSync } from "node:fs";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tag) {
  console.error(
    "No release tag provided (argument or GITHUB_REF_NAME required)",
  );
  process.exit(1);
}

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(
    `✗ Tag "${tag}" is not a plain semantic version tag of the form vX.Y.Z`,
  );
  process.exit(1);
}

const failures = [];
const version = tag.slice(1);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

if (pkg.version !== version) {
  failures.push(
    `Tag ${tag} does not match package.json version ${pkg.version}`,
  );
}
if (pkg.name !== "@warsclon/openspec-viewer") {
  failures.push(
    `package.json name is "${pkg.name}", expected "@warsclon/openspec-viewer"`,
  );
}

const marker = `## [${version}] - `;
const hasDatedEntry = readFileSync("CHANGELOG.md", "utf8")
  .split("\n")
  .some(
    (line) =>
      line.startsWith(marker) &&
      /^\d{4}-\d{2}-\d{2}$/.test(line.slice(marker.length).trim()),
  );
if (!hasDatedEntry) {
  failures.push(
    `CHANGELOG.md has no dated "## [${version}] - YYYY-MM-DD" entry`,
  );
}

if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}
console.log(`✓ Tag ${tag} agrees with package.json and CHANGELOG.md`);
