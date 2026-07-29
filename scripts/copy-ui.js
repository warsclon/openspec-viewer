import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "ui");
const dest = join(root, "dist", "ui");

if (!existsSync(src)) {
  console.error("UI source missing:", src);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
cpSync(join(root, "src", "shared"), join(root, "dist", "shared"), {
  recursive: true,
});
copyFileSync(
  join(root, "src", "shared", "search-contract.js"),
  join(dest, "search-contract.js"),
);
chmodSync(join(root, "dist", "cli.js"), 0o755);
console.log("Copied UI → dist/ui");
