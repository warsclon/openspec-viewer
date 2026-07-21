import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectRoot } from "./openspec/discover.js";
import {
  buildSpecChangeGraph,
  getChangeDetail,
  getOverview,
  getProjectInfo,
  listChanges,
  listNextUp,
  tasksPathFor,
} from "./openspec/project.js";
import { searchProject } from "./openspec/search.js";
import { toggleTaskFile } from "./openspec/tasks.js";
import { watchOpenspec } from "./openspec/watch.js";

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

type SseClient = { id: number; res: ServerResponse };

export type ServerOptions = {
  root: ProjectRoot;
  host?: string;
  port?: number;
  includeArchive?: boolean;
};

export function startServer(opts: ServerOptions) {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 4321;
  const includeArchive = opts.includeArchive ?? true;
  const { root } = opts;

  const sseClients = new Map<number, SseClient>();
  let sseSeq = 1;

  const broadcast = (event: string, data: unknown) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients.values()) {
      try {
        client.res.write(payload);
      } catch {
        sseClients.delete(client.id);
      }
    }
  };

  const watcher = watchOpenspec(root, (ev) => {
    broadcast("reload", ev);
  });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      const { pathname } = url;
      const method = req.method ?? "GET";

      if (method === "GET" && pathname === "/api/health") {
        return sendJson(res, 200, { ok: true, watchers: sseClients.size });
      }

      if (method === "GET" && pathname === "/api/events") {
        const id = sseSeq++;
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, id })}\n\n`);
        sseClients.set(id, { id, res });
        const keepAlive = setInterval(() => {
          try {
            res.write(`: ping ${Date.now()}\n\n`);
          } catch {
            clearInterval(keepAlive);
          }
        }, 25000);
        req.on("close", () => {
          clearInterval(keepAlive);
          sseClients.delete(id);
        });
        return;
      }

      if (method === "GET" && pathname === "/api/project") {
        return sendJson(res, 200, getProjectInfo(root));
      }

      if (method === "GET" && pathname === "/api/search") {
        const q = url.searchParams.get("q") ?? "";
        return sendJson(res, 200, {
          query: q,
          hits: searchProject(root, q, { includeArchive }),
        });
      }

      if (method === "GET" && pathname === "/api/changes") {
        const changes = listChanges(root, includeArchive);
        return sendJson(res, 200, {
          changes,
          overview: getOverview(root, changes),
          nextUp: listNextUp(changes),
          graph: buildSpecChangeGraph(root, changes),
        });
      }

      if (method === "GET" && pathname === "/api/graph") {
        const changes = listChanges(root, includeArchive);
        return sendJson(res, 200, buildSpecChangeGraph(root, changes));
      }

      if (method === "GET" && pathname === "/api/next") {
        const changes = listChanges(root, includeArchive);
        return sendJson(res, 200, { items: listNextUp(changes) });
      }

      const changeMatch = pathname.match(/^\/api\/changes\/([^/]+)$/);
      if (method === "GET" && changeMatch) {
        const name = decodeURIComponent(changeMatch[1]);
        return sendJson(res, 200, getChangeDetail(root, name));
      }

      const toggleMatch = pathname.match(/^\/api\/changes\/([^/]+)\/tasks\/toggle$/);
      if (method === "POST" && toggleMatch) {
        const name = decodeURIComponent(toggleMatch[1]);
        if (name.startsWith("archive/")) {
          return sendJson(res, 400, {
            error: "Change archivado es read-only (como los commits de prod un viernes).",
          });
        }
        const body = JSON.parse((await readBody(req)) || "{}") as {
          taskId?: string;
          done?: boolean;
        };
        if (!body.taskId) {
          return sendJson(res, 400, { error: "taskId requerido" });
        }
        const path = tasksPathFor(root, name);
        const { parsed, task } = toggleTaskFile(path, body.taskId, body.done);
        broadcast("reload", {
          type: "change",
          path,
          at: new Date().toISOString(),
          reason: "toggle",
          changeName: name,
          taskId: body.taskId,
        });
        return sendJson(res, 200, {
          task,
          completed: parsed.completed,
          total: parsed.total,
          sections: parsed.sections,
        });
      }

      if (
        method === "GET" &&
        (pathname === "/" || pathname.startsWith("/assets/") || pathname.match(/\.(css|js|svg)$/))
      ) {
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
            watcher.close();
            for (const c of sseClients.values()) {
              try {
                c.res.end();
              } catch {
                // ignore
              }
            }
            sseClients.clear();
            server.close((e) => (e ? rejClose(e) : resClose()));
          }),
      });
    });
  });
}
