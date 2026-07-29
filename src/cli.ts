#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  readFileSync,
  realpathSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTemporaryDemoProject,
  type TemporaryDemoProject,
} from "./demo.js";
import { findOpenspecRoot } from "./openspec/discover.js";
import { startServer, type ServerOptions } from "./server.js";

function packageVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const HELP = `openspec-viewer — local web UI for OpenSpec

Usage:
  openspec-viewer [options] [path]

Options:
  -p, --port <n>     Port (default: 4321; 0 selects an ephemeral port)
  --host <host>      Host (default: 127.0.0.1)
  --path <dir>       Project to scan (default: cwd)
  --demo             Open the bundled fictional project in a temporary copy
  --no-archive       Hide archived changes (shown by default)
  --no-open          Do not open the browser
  -h, --help         Show help
  -V, --version      Show version

Examples:
  openspec-viewer
  openspec-viewer --demo
  openspec-viewer ../my-project
  openspec-viewer --port 5173 --path ./apps/api
`;

export function parseArgs(argv: string[], cwd = process.cwd()) {
  const opts = {
    port: 4321,
    host: "127.0.0.1",
    path: cwd,
    demo: false,
    archive: true,
    open: true,
    help: false,
    version: false,
  };

  const rest: string[] = [];
  let explicitPath = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--version" || a === "-V") opts.version = true;
    else if (a === "--no-open") opts.open = false;
    else if (a === "--demo") opts.demo = true;
    else if (a === "--no-archive") opts.archive = false;
    else if (a === "--archive") opts.archive = true;
    else if (a === "--port" || a === "-p") {
      const rawPort = argv[++i];
      opts.port =
        rawPort !== undefined && /^\d+$/.test(rawPort)
          ? Number(rawPort)
          : Number.NaN;
    }
    else if (a === "--host") opts.host = argv[++i] ?? opts.host;
    else if (a === "--path") {
      explicitPath = true;
      opts.path = resolve(cwd, argv[++i] ?? ".");
    }
    else if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    } else {
      rest.push(a);
    }
  }

  if (rest[0]) {
    explicitPath = true;
    opts.path = resolve(cwd, rest[0]);
  }
  if (opts.demo && explicitPath) {
    throw new Error("--demo cannot be combined with a project path");
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) {
    throw new Error(`Invalid port: ${opts.port}`);
  }
  return opts;
}

export type BrowserLaunchHandle = {
  once(event: "error", listener: (error: Error) => void): unknown;
  unref(): void;
};

export type BrowserLauncher = (
  command: string,
  args: string[],
) => BrowserLaunchHandle | void;

const defaultBrowserLauncher: BrowserLauncher = (command, args) => {
  return spawn(command, args, { detached: true, stdio: "ignore" });
};

export function openBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
  launch: BrowserLauncher = defaultBrowserLauncher,
): void {
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = launch(cmd, args);
  if (child) {
    child.once("error", () => {
      // Opening a browser is optional; the local server remains available.
    });
    child.unref();
  }
}

export type CliDependencies = {
  cwd?: string;
  log?: (message?: string) => void;
  start?: (options: ServerOptions) => ReturnType<typeof startServer>;
  open?: (url: string) => void;
};

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {},
): Promise<Awaited<ReturnType<typeof startServer>> | undefined> {
  const opts = parseArgs(argv, dependencies.cwd);
  const log = dependencies.log ?? console.log;
  if (opts.help) {
    log(HELP);
    return undefined;
  }
  if (opts.version) {
    log(packageVersion());
    return undefined;
  }

  const demoProject: TemporaryDemoProject | undefined = opts.demo
    ? createTemporaryDemoProject()
    : undefined;
  let started: Awaited<ReturnType<typeof startServer>>;
  let root;
  try {
    root = findOpenspecRoot(demoProject?.projectDir ?? opts.path);
    const server = await (dependencies.start ?? startServer)({
      root,
      host: opts.host,
      port: opts.port,
      includeArchive: opts.archive,
      mode: opts.demo ? "demo" : undefined,
    });
    let closePromise: Promise<void> | undefined;
    started = {
      url: server.url,
      close: () => {
        closePromise ??= (async () => {
          try {
            await server.close();
          } finally {
            demoProject?.cleanup();
          }
        })();
        return closePromise;
      },
    };
  } catch (error) {
    demoProject?.cleanup();
    throw error;
  }
  const server = started;
  const { url } = server;

  log("");
  log("  OpenSpec Viewer");
  log(
    `  project:  ${opts.demo ? "Fictional demo project (temporary copy)" : root.projectDir}`,
  );
  log(`  openspec: ${opts.demo ? "isolated demo data" : root.openspecDir}`);
  log(`  UI:       ${url}`);
  log("");
  log("  Ctrl+C to quit · live reload on · ⌘K/Ctrl+K search · #/change/… deep links");
  log("");

  if (opts.open) {
    try {
      (dependencies.open ?? openBrowser)(url);
    } catch {
      // browser optional
    }
  }
  return server;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  runCli(process.argv.slice(2))
    .then((server) => {
      if (!server) return;
      const shutdown = (signal: NodeJS.Signals) => {
        void server.close().finally(() => {
          process.off("SIGINT", onSigint);
          process.off("SIGTERM", onSigterm);
          process.kill(process.pid, signal);
        });
      };
      const onSigint = () => shutdown("SIGINT");
      const onSigterm = () => shutdown("SIGTERM");
      process.once("SIGINT", onSigint);
      process.once("SIGTERM", onSigterm);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
