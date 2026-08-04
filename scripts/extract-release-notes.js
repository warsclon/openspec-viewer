#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md section for one released version to stdout, for use
 * as GitHub Release notes.
 *
 * Usage: node scripts/extract-release-notes.js <version|vX.Y.Z>
 */
import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: extract-release-notes.js <version>");
  process.exit(1);
}
const version = input.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`"${input}" is not a plain semantic version`);
  process.exit(1);
}

const lines = readFileSync("CHANGELOG.md", "utf8").split("\n");
const marker = `## [${version}] - `;
const start = lines.findIndex(
  (line) =>
    line.startsWith(marker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(line.slice(marker.length).trim()),
);
if (start === -1) {
  console.error(`CHANGELOG.md has no dated entry for version ${version}`);
  process.exit(1);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i += 1) {
  if (lines[i].startsWith("## [")) {
    end = i;
    break;
  }
}

const section = lines
  .slice(start + 1, end)
  .join("\n")
  .trim();
if (!section) {
  console.error(`CHANGELOG.md entry for ${version} is empty`);
  process.exit(1);
}
console.log(section);
