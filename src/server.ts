import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectRoot } from "./openspec/discover.js";
import {
  getChangeDetail,
  getProjectInfo,
  listChanges,
  tasksPathFor,
} from "./openspec/project.js";
import { toggleTaskFile } from "./openspec/tasks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function uiDir(): string {
  const candidates = [join(__dirname, "ui"), join(__dirname, "..", "src", "ui")];
  for (const c of candidates) {
    if (existsSync(join(c, "index.html"))) return c;
  }
  throw new Error("No se encontró la UI (dist/ui o src/ui). ¿Corriste npm run build?");
}

function serveStatic(res: ServerResponse, urlPath: string) {
  const base = uiDir();
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const safe = rel.replace(/\.\./g, "");
  const filePath = join(base, safe);
  if (!filePath.startsWith(base) || !existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }
  const ext = extname(filePath);
  sendText(res, 200, readFileSync(filePath, "utf8"), MIME[ext] ?? "application/octet-stream");
}

export type ServerOptions = {
  root: ProjectRoot;
  host?: string;
  port?: number;
  includeArchive?: boolean;
};

export function startServer(opts: ServerOptions) {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 4321;
  const includeArchive = opts.includeArchive ?? false;
  const { root } = opts;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      const { pathname } = url;
      const method = req.method ?? "GET";

      if (method === "GET" && pathname === "/api/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (method === "GET" && pathname === "/api/project") {
        return sendJson(res, 200, getProjectInfo(root));
      }

      if (method === "GET" && pathname === "/api/changes") {
        return sendJson(res, 200, {
          changes: listChanges(root, includeArchive),
        });
      }

      const changeMatch = pathname.match(/^\/api\/changes\/([^/]+)$/);
      if (method === "GET" && changeMatch) {
        const name = decodeURIComponent(changeMatch[1]);
        return sendJson(res, 200, getChangeDetail(root, name));
      }

      const toggleMatch = pathname.match(/^\/api\/changes\/([^/]+)\/tasks\/toggle$/);
      if (method === "POST" && toggleMatch) {
        const name = decodeURIComponent(toggleMatch[1]);
        const body = JSON.parse((await readBody(req)) || "{}") as {
          taskId?: string;
          done?: boolean;
        };
        if (!body.taskId) {
          return sendJson(res, 400, { error: "taskId requerido" });
        }
        const path = tasksPathFor(root, name);
        const { parsed, task } = toggleTaskFile(path, body.taskId, body.done);
        return sendJson(res, 200, {
          task,
          completed: parsed.completed,
          total: parsed.total,
          sections: parsed.sections,
        });
      }

      if (method === "GET" && (pathname === "/" || pathname.startsWith("/assets/") || pathname.match(/\.(css|js|svg)$/))) {
        return serveStatic(res, pathname);
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  });

  return new Promise<{ url: string; close: () => Promise<void> }>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      resolvePromise({
        url,
        close: () =>
          new Promise((resClose, rejClose) => {
            server.close((e) => (e ? rejClose(e) : resClose()));
          }),
      });
    });
  });
}
