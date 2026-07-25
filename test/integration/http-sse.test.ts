import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { WatchFactory } from "../../src/openspec/watch.js";
import {
  startTestServer,
  type TestServer,
} from "../helpers/server.js";
import {
  closeSseTestResources,
  connectSse,
  type SseClient,
} from "../helpers/sse.js";

const servers: TestServer[] = [];
const clients: SseClient[] = [];

afterEach(async () => {
  await closeSseTestResources(clients, servers);
});

async function start(): Promise<TestServer> {
  const server = await startTestServer();
  servers.push(server);
  return server;
}

async function connect(server: TestServer): Promise<SseClient> {
  const client = await connectSse(`${server.url}/api/events`);
  clients.push(client);
  return client;
}

async function postJson(
  server: TestServer,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${server.url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("real HTTP SSE lifecycle", () => {
  it("sends hello and an artifact mutation reload event", async () => {
    const server = await start();
    const client = await connect(server);

    expect(client.status).toBe(200);
    expect(await client.next()).toEqual({
      event: "hello",
      data: { ok: true, id: 1 },
    });

    const mutation = await fetch(
      `${server.url}/api/changes/add-dark-mode/proposal`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "## Why\n\nObserve an SSE mutation.\n",
        }),
      },
    );
    expect(mutation.status).toBe(200);

    expect(await client.next()).toMatchObject({
      event: "reload",
      data: {
        type: "change",
        reason: "write-proposal",
        changeName: "add-dark-mode",
      },
    });
  });

  it("sends a reload event for a local note mutation", async () => {
    const server = await start();
    const client = await connect(server);
    await client.next();

    const noteMutation = await fetch(
      `${server.url}/api/changes/add-dark-mode/notes`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Observe a note reload.\n" }),
      },
    );
    expect(noteMutation.status).toBe(200);
    expect(await client.next()).toMatchObject({
      event: "reload",
      data: {
        type: "change",
        reason: "write-notes",
        changeName: "add-dark-mode",
      },
    });
  });

  it("sends a reload event after creating a change", async () => {
    const server = await startTestServer({
      runCommand: async (_command, _args, cwd) => {
        const generated = join(
          cwd,
          "openspec",
          "changes",
          "sse-created-change",
        );
        mkdirSync(generated, { recursive: true });
        writeFileSync(join(generated, "proposal.md"), "created\n", "utf8");
        return { code: 0, stdout: "created\n", stderr: "" };
      },
    });
    servers.push(server);
    const client = await connect(server);
    await client.next();

    const response = await postJson(server, "/api/changes", {
      name: "sse-created-change",
    });
    expect(response.status).toBe(201);
    expect(await client.next()).toMatchObject({
      event: "reload",
      data: {
        type: "change",
        reason: "create",
        changeName: "sse-created-change",
      },
    });
  });

  it("sends a reload event after archiving a change", async () => {
    const server = await startTestServer({
      runCommand: async (_command, _args, cwd) => {
        renameSync(
          join(cwd, "openspec", "changes", "add-dark-mode"),
          join(
            cwd,
            "openspec",
            "changes",
            "archive",
            "2026-07-25-add-dark-mode",
          ),
        );
        return { code: 0, stdout: "archived\n", stderr: "" };
      },
    });
    servers.push(server);
    const client = await connect(server);
    await client.next();

    const response = await postJson(
      server,
      "/api/changes/add-dark-mode/archive",
      { confirm: true },
    );
    expect(response.status).toBe(200);
    expect(await client.next()).toMatchObject({
      event: "reload",
      data: {
        type: "change",
        reason: "archive",
        changeName: "add-dark-mode",
      },
    });
  });

  it("sends a reload event after a structured task mutation", async () => {
    const server = await start();
    const client = await connect(server);
    await client.next();

    const response = await postJson(
      server,
      "/api/changes/add-dark-mode/tasks/mutate",
      {
        type: "add",
        sectionIndex: 0,
        id: "1.3",
        text: "Observe the task event",
      },
    );
    expect(response.status).toBe(200);
    expect(await client.next()).toMatchObject({
      event: "reload",
      data: {
        type: "change",
        reason: "tasks-mutate",
        changeName: "add-dark-mode",
      },
    });
  });

  it("sends a reload event after toggling a task", async () => {
    const server = await start();
    const client = await connect(server);
    await client.next();

    const response = await postJson(
      server,
      "/api/changes/add-dark-mode/tasks/toggle",
      { taskId: "1.2", done: true },
    );
    expect(response.status).toBe(200);
    expect(await client.next()).toMatchObject({
      event: "reload",
      data: {
        type: "change",
        reason: "toggle",
        changeName: "add-dark-mode",
        taskId: "1.2",
      },
    });
  });

  it("sends a reload event after a filesystem watcher notification", async () => {
    let emitFilesystemEvent:
      | ((event: "rename" | "change", filename: string | Buffer | null) => void)
      | undefined;
    const watchFactory: WatchFactory = (_path, _options, listener) => {
      emitFilesystemEvent = listener;
      return {
        on: () => undefined,
        close: () => undefined,
      };
    };
    const server = await startTestServer({
      watchFactory,
      watchDebounceMs: 0,
    });
    servers.push(server);
    const client = await connect(server);
    await client.next();

    emitFilesystemEvent?.(
      "change",
      "changes/add-dark-mode/tasks.md",
    );

    const event = await client.next();
    expect(event).toMatchObject({
      event: "reload",
      data: {
        type: "change",
      },
    });
    expect((event.data as { path: string }).path).toContain(
      "openspec/changes/add-dark-mode/tasks.md",
    );
  });

  it("removes disconnected clients and closes active streams on shutdown", async () => {
    const server = await start();
    const first = await connect(server);
    await first.next();

    const connected = await fetch(`${server.url}/api/health`).then((response) =>
      response.json(),
    );
    expect(connected).toEqual({ ok: true, watchers: 1 });

    await first.close();
    await expect
      .poll(
        async () =>
          fetch(`${server.url}/api/health`)
            .then((response) => response.json())
            .then((body) => body.watchers),
        { timeout: 1000 },
      )
      .toBe(0);

    const second = await connect(server);
    await second.next();
    await expect(server.close()).resolves.toBeUndefined();
    await expect(server.close()).resolves.toBeUndefined();
    await expect(second.next(250)).rejects.toThrow(
      "SSE stream closed before the next event",
    );
  });
});
