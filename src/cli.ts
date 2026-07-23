#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findOpenspecRoot } from "./openspec/discover.js";
import { startServer } from "./server.js";

function packageVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp() {
  console.log(`openspec-viewer — local web UI for OpenSpec

Usage:
  openspec-viewer [options] [path]

Options:
  -p, --port <n>     Port (default: 4321)
  --host <host>      Host (default: 127.0.0.1)
  --path <dir>       Project to scan (default: cwd)
  --no-archive       Hide archived changes (shown by default)
  --no-open          Do not open the browser
  -h, --help         Show help
  -V, --version      Show version

Examples:
  openspec-viewer
  openspec-viewer ../my-project
  openspec-viewer --port 5173 --path ./apps/api
`);
}

function parseArgs(argv: string[]) {
  const opts = {
    port: 4321,
    host: "127.0.0.1",
    path: process.cwd(),
    archive: true,
    open: true,
    help: false,
    version: false,
  };

  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--version" || a === "-V") opts.version = true;
    else if (a === "--no-open") opts.open = false;
    else if (a === "--no-archive") opts.archive = false;
    else if (a === "--archive") opts.archive = true;
    else if (a === "--port" || a === "-p") opts.port = Number(argv[++i]);
    else if (a === "--host") opts.host = argv[++i] ?? opts.host;
    else if (a === "--path") opts.path = resolve(argv[++i] ?? ".");
    else if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    } else {
      rest.push(a);
    }
  }

  if (rest[0]) opts.path = resolve(rest[0]);
  if (!Number.isFinite(opts.port) || opts.port <= 0) {
    throw new Error(`Invalid port: ${opts.port}`);
  }
  return opts;
}

function openBrowser(url: string) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  if (opts.version) {
    console.log(packageVersion());
    return;
  }

  const root = findOpenspecRoot(opts.path);
  const { url } = await startServer({
    root,
    host: opts.host,
    port: opts.port,
    includeArchive: opts.archive,
  });

  console.log("");
  console.log("  OpenSpec Viewer");
  console.log(`  project:  ${root.projectDir}`);
  console.log(`  openspec: ${root.openspecDir}`);
  console.log(`  UI:       ${url}`);
  console.log("");
  console.log("  Ctrl+C to quit · live reload on · ⌘K/Ctrl+K search · #/change/… deep links");
  console.log("");

  if (opts.open) {
    try {
      openBrowser(url);
    } catch {
      // browser optional
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
