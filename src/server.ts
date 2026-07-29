import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changeDir, type ProjectRoot } from "./openspec/discover.js";
import {
  applyTaskMutation,
  archiveChange,
  createChange,
  writeArtifact,
  type ArtifactName,
  type CommandRunner,
} from "./openspec/mutate.js";
import { notesPath, readNotes, writeNotes } from "./openspec/notes.js";
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
import { toggleTaskFile, type SectionDraft } from "./openspec/tasks.js";
import { watchOpenspec, type WatchFactory } from "./openspec/watch.js";

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

class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new HttpRequestError(400, "Invalid JSON body");
    }
    throw error;
  }
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      throw new HttpRequestError(400, "Malformed URL encoding");
    }
    throw error;
  }
}

function errorStatus(error: unknown): number {
  if (error instanceof HttpRequestError) return error.status;
  if (!(error instanceof Error)) return 500;
  if (error.message.startsWith("Change not found:")) return 404;
  if (error.message.startsWith("Task not found:")) return 404;
  if (error.message.startsWith("Invalid name. Use kebab-case:")) return 400;
  if (error.message.startsWith("Invalid change name:")) return 400;
  if (error.message.startsWith("Change already exists:")) return 409;
  if (error.message === "Archived changes are read-only") return 409;
  return 500;
}

type TaskMutation = Parameters<typeof applyTaskMutation>[2];

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSectionDraftArray(value: unknown): value is SectionDraft[] {
  return (
    Array.isArray(value) &&
    value.every(
      (section) =>
        section !== null &&
        typeof section === "object" &&
        typeof (section as Record<string, unknown>).title === "string" &&
        Array.isArray((section as Record<string, unknown>).tasks) &&
        ((section as Record<string, unknown>).tasks as unknown[]).every(
          (task) =>
            task !== null &&
            typeof task === "object" &&
            typeof (task as Record<string, unknown>).id === "string" &&
            typeof (task as Record<string, unknown>).text === "string" &&
            typeof (task as Record<string, unknown>).done === "boolean",
        ),
    )
  );
}

function isTaskMutation(value: unknown): value is TaskMutation {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case "add":
      return (
        Number.isInteger(action.sectionIndex) &&
        Number(action.sectionIndex) >= 0 &&
        typeof action.text === "string" &&
        (action.id === undefined || typeof action.id === "string")
      );
    case "update":
      return (
        typeof action.taskId === "string" &&
        (typeof action.text === "string" || typeof action.done === "boolean") &&
        (action.text === undefined || typeof action.text === "string") &&
        (action.done === undefined || typeof action.done === "boolean")
      );
    case "delete":
      return typeof action.taskId === "string";
    case "move":
      return (
        typeof action.taskId === "string" &&
        (action.direction === "up" || action.direction === "down")
      );
    case "add-section":
      return typeof action.title === "string";
    case "rename-section":
      return (
        Number.isInteger(action.sectionIndex) &&
        Number(action.sectionIndex) >= 0 &&
        typeof action.title === "string"
      );
    case "delete-section":
      return Number.isInteger(action.sectionIndex) && Number(action.sectionIndex) >= 0;
    case "replace":
      return isSectionDraftArray(action.sections);
    default:
      return false;
  }
}

function uiDir(): string {
  const candidates = [join(__dirname, "ui"), join(__dirname, "..", "src", "ui")];
  for (const c of candidates) {
    if (existsSync(join(c, "index.html"))) return c;
  }
  throw new Error("UI not found (dist/ui or src/ui). Run: npm run build");
}

function serveStatic(res: ServerResponse, urlPath: string) {
  const base = uiDir();
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const safe = rel.replace(/\.\./g, "");
  const sharedContract = join(
    __dirname,
    "..",
    "src",
    "shared",
    "search-contract.js",
  );
  let filePath = join(base, safe);
  if (safe === "/search-contract.js" && !existsSync(filePath)) {
    filePath = sharedContract;
  }
  if (
    (filePath !== sharedContract && !filePath.startsWith(base)) ||
    !existsSync(filePath)
  ) {
    sendText(res, 404, "Not found");
    return;
  }
  const ext = extname(filePath);
  sendText(res, 200, readFileSync(filePath, "utf8"), MIME[ext] ?? "application/octet-stream");
}

type SseClient = { id: number; res: ServerResponse };

export type ServerOptions = {
  root: ProjectRoot;
  mode?: "demo";
  host?: string;
  port?: number;
  includeArchive?: boolean;
  runCommand?: CommandRunner;
  watchFactory?: WatchFactory;
  watchDebounceMs?: number;
};

function tasksPayload(parsed: {
  completed: number;
  total: number;
  sections: unknown;
  raw?: string;
}) {
  return {
    completed: parsed.completed,
    total: parsed.total,
    sections: parsed.sections,
    raw: parsed.raw,
  };
}

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

  const watcher = watchOpenspec(
    root,
    (ev) => {
      broadcast("reload", ev);
    },
    opts.watchDebounceMs ?? 250,
    opts.watchFactory,
  );

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
        const project = getProjectInfo(root);
        return sendJson(
          res,
          200,
          opts.mode === "demo"
            ? {
                ...project,
                mode: "demo",
                label: "Fictional demo project",
              }
            : project,
        );
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

      if (method === "POST" && pathname === "/api/changes") {
        const body = await readJson<unknown>(req);
        if (!isJsonObject(body) || typeof body.name !== "string" || !body.name.trim()) {
          return sendJson(res, 400, { error: "name is required" });
        }
        if (body.description !== undefined && typeof body.description !== "string") {
          return sendJson(res, 400, { error: "description must be a string" });
        }
        const created = await createChange(root, body.name, {
          description:
            typeof body.description === "string" ? body.description : undefined,
          runCommand: opts.runCommand,
        });
        broadcast("reload", {
          type: "change",
          at: new Date().toISOString(),
          reason: "create",
          changeName: created.name,
        });
        return sendJson(res, 201, created);
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
        const name = decodePathSegment(changeMatch[1]);
        const detail = getChangeDetail(root, name);
        return sendJson(res, 200, {
          ...detail,
          notes: readNotes(root, name),
        });
      }

      const archiveMatch = pathname.match(/^\/api\/changes\/([^/]+)\/archive$/);
      if (method === "POST" && archiveMatch) {
        const name = decodePathSegment(archiveMatch[1]);
        const body = await readJson<unknown>(req);
        if (!isJsonObject(body) || body.confirm !== true) {
          return sendJson(res, 400, { error: "confirm: true is required (no magic undo)" });
        }
        if (body.skipSpecs !== undefined && typeof body.skipSpecs !== "boolean") {
          return sendJson(res, 400, { error: "skipSpecs must be a boolean" });
        }
        const result = await archiveChange(root, name, {
          skipSpecs: typeof body.skipSpecs === "boolean" ? body.skipSpecs : undefined,
          runCommand: opts.runCommand,
        });
        broadcast("reload", {
          type: "change",
          at: new Date().toISOString(),
          reason: "archive",
          changeName: name,
        });
        return sendJson(res, 200, { ok: true, name, ...result });
      }

      const notesMatch = pathname.match(/^\/api\/changes\/([^/]+)\/notes$/);
      if (notesMatch) {
        const name = decodePathSegment(notesMatch[1]);
        changeDir(root, name);
        if (method === "GET") {
          return sendJson(res, 200, { content: readNotes(root, name) });
        }
        if (method === "PUT") {
          const body = await readJson<unknown>(req);
          if (!isJsonObject(body) || typeof body.content !== "string") {
            return sendJson(res, 400, { error: "content (string) is required" });
          }
          const content = writeNotes(root, name, body.content);
          broadcast("reload", {
            type: "change",
            path: notesPath(root, name),
            at: new Date().toISOString(),
            reason: "write-notes",
            changeName: name,
          });
          return sendJson(res, 200, { content });
        }
      }

      const artifactMatch = pathname.match(/^\/api\/changes\/([^/]+)\/(proposal|design|tasks)$/);
      if (method === "PUT" && artifactMatch) {
        const name = decodePathSegment(artifactMatch[1]);
        const artifact = artifactMatch[2] as ArtifactName;
        const body = await readJson<unknown>(req);

        if (!isJsonObject(body)) {
          return sendJson(res, 400, { error: "content (string) is required" });
        }
        if (
          artifact === "tasks" &&
          "sections" in body
        ) {
          if (!isSectionDraftArray(body.sections)) {
            return sendJson(res, 400, { error: "invalid task sections" });
          }
          const { parsed, path } = applyTaskMutation(root, name, {
            type: "replace",
            sections: body.sections,
          });
          broadcast("reload", {
            type: "change",
            path,
            at: new Date().toISOString(),
            reason: "tasks-replace",
            changeName: name,
          });
          return sendJson(res, 200, tasksPayload(parsed));
        }

        if (typeof body.content !== "string") {
          return sendJson(res, 400, { error: "content (string) is required" });
        }
        const written = writeArtifact(root, name, artifact, body.content);
        broadcast("reload", {
          type: "change",
          path: written.path,
          at: new Date().toISOString(),
          reason: `write-${artifact}`,
          changeName: name,
        });
        if (artifact === "tasks") {
          const { parseTasksMarkdown } = await import("./openspec/tasks.js");
          return sendJson(res, 200, tasksPayload(parseTasksMarkdown(written.content)));
        }
        return sendJson(res, 200, { content: written.content });
      }

      const tasksMutateMatch = pathname.match(/^\/api\/changes\/([^/]+)\/tasks\/mutate$/);
      if (method === "POST" && tasksMutateMatch) {
        const name = decodePathSegment(tasksMutateMatch[1]);
        const body = await readJson<unknown>(req);
        if (!isJsonObject(body) || !("type" in body)) {
          return sendJson(res, 400, { error: "task mutation type is required" });
        }
        if (!isTaskMutation(body)) {
          return sendJson(res, 400, { error: "invalid task mutation" });
        }
        const { parsed, path } = applyTaskMutation(root, name, body);
        broadcast("reload", {
          type: "change",
          path,
          at: new Date().toISOString(),
          reason: "tasks-mutate",
          changeName: name,
        });
        return sendJson(res, 200, tasksPayload(parsed));
      }

      const toggleMatch = pathname.match(/^\/api\/changes\/([^/]+)\/tasks\/toggle$/);
      if (method === "POST" && toggleMatch) {
        const name = decodePathSegment(toggleMatch[1]);
        if (name.startsWith("archive/")) {
          return sendJson(res, 409, {
            error: "Archived changes are read-only",
          });
        }
        const body = await readJson<unknown>(req);
        if (!isJsonObject(body) || typeof body.taskId !== "string" || !body.taskId) {
          return sendJson(res, 400, { error: "taskId is required" });
        }
        if (body.done !== undefined && typeof body.done !== "boolean") {
          return sendJson(res, 400, { error: "done must be a boolean" });
        }
        const path = tasksPathFor(root, name);
        const { parsed, task } = toggleTaskFile(
          path,
          body.taskId,
          typeof body.done === "boolean" ? body.done : undefined,
        );
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
          ...tasksPayload(parsed),
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
      sendJson(res, errorStatus(err), { error: message });
    }
  });

  return new Promise<{ url: string; close: () => Promise<void> }>((resolvePromise, reject) => {
    const handleStartupError = (error: Error) => {
      watcher.close();
      reject(error);
    };
    server.once("error", handleStartupError);
    try {
      server.listen(port, host, () => {
        server.off("error", handleStartupError);
        const address = server.address() as AddressInfo;
        const url = `http://${host}:${address.port}`;
        let closePromise: Promise<void> | undefined;

        resolvePromise({
          url,
          close: () => {
            closePromise ??= new Promise((resClose, rejClose) => {
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
            });
            return closePromise;
          },
        });
      });
    } catch (error) {
      server.off("error", handleStartupError);
      watcher.close();
      reject(error);
    }
  });
}
