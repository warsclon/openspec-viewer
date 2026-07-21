#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { findOpenspecRoot } from "./openspec/discover.js";
import { startServer } from "./server.js";

function printHelp() {
  console.log(`openspec-viewer — UI web local para OpenSpec

Uso:
  openspec-viewer [options] [path]

Opciones:
  -p, --port <n>     Puerto (default: 4321)
  --host <host>      Host (default: 127.0.0.1)
  --path <dir>       Proyecto a escanear (default: cwd)
  --no-archive       Ocultar changes archivados (por defecto se muestran)
  --no-open          No abrir el navegador
  -h, --help         Esta ayuda
  -V, --version      Versión

Ejemplos:
  openspec-viewer
  openspec-viewer ../mi-proyecto
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
      throw new Error(`Opción desconocida: ${a}`);
    } else {
      rest.push(a);
    }
  }

  if (rest[0]) opts.path = resolve(rest[0]);
  if (!Number.isFinite(opts.port) || opts.port <= 0) {
    throw new Error(`Puerto inválido: ${opts.port}`);
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
    console.log("0.3.0");
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
  console.log(`  proyecto: ${root.projectDir}`);
  console.log(`  openspec: ${root.openspecDir}`);
  console.log(`  UI:       ${url}`);
  console.log("");
  console.log("  Ctrl+C para salir (las tareas se guardan al vuelo en tasks.md)");
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
