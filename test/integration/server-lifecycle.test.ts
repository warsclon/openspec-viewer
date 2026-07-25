import { existsSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import type { WatchFactory } from "../../src/openspec/watch.js";
import { startServer, type ServerOptions } from "../../src/server.js";
import { createTestProject } from "../helpers/fixture.js";
import {
  closeTestServers,
  startTestServer,
  type TestServer,
  withTestServer,
} from "../helpers/server.js";

const servers: TestServer[] = [];

afterEach(async () => {
  await closeTestServers(servers);
});

describe("server lifecycle", () => {
  it("reports an ephemeral URL and cleans up idempotently", async () => {
    const server = await startTestServer();
    servers.push(server);

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.url).not.toMatch(/:0$/);
    expect(existsSync(server.projectDir)).toBe(true);

    const response = await fetch(`${server.url}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, watchers: 0 });

    await server.close();
    expect(existsSync(server.projectDir)).toBe(false);
    await expect(server.close()).resolves.toBeUndefined();
  });

  it("isolates concurrent servers and temporary projects", async () => {
    const [first, second] = await Promise.all([startTestServer(), startTestServer()]);
    servers.push(first, second);

    expect(first.url).not.toBe(second.url);
    expect(first.projectDir).not.toBe(second.projectDir);

    const [firstHealth, secondHealth] = await Promise.all([
      fetch(`${first.url}/api/health`),
      fetch(`${second.url}/api/health`),
    ]);
    await expect(firstHealth.json()).resolves.toEqual({ ok: true, watchers: 0 });
    await expect(secondHealth.json()).resolves.toEqual({ ok: true, watchers: 0 });

    const changedProposal = "## Why\n\nOnly the first test project changes.\n";
    const [noteWrite, proposalWrite] = await Promise.all([
      fetch(`${first.url}/api/changes/add-dark-mode/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "First server only.\n" }),
      }),
      fetch(`${first.url}/api/changes/add-dark-mode/proposal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: changedProposal }),
      }),
    ]);
    expect(noteWrite.status).toBe(200);
    expect(proposalWrite.status).toBe(200);

    const [firstDetail, secondDetail] = await Promise.all([
      fetch(`${first.url}/api/changes/add-dark-mode`).then((response) => response.json()),
      fetch(`${second.url}/api/changes/add-dark-mode`).then((response) => response.json()),
    ]);
    expect(firstDetail).toMatchObject({
      notes: "First server only.\n",
      proposal: changedProposal,
    });
    expect(secondDetail).toMatchObject({
      notes: "",
      proposal: expect.stringContaining("Readers need a comfortable theme"),
    });
  });

  it("closes its watcher when the HTTP listener cannot start", async () => {
    const project = createTestProject();
    const root = findOpenspecRoot(project.projectDir);
    const blocker = createNetServer();
    let watcherCloseCalls = 0;
    const watchFactory: WatchFactory = () => ({
      on: () => undefined,
      close: () => {
        watcherCloseCalls += 1;
      },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        blocker.once("error", reject);
        blocker.listen(0, "127.0.0.1", resolve);
      });
      const port = (blocker.address() as AddressInfo).port;
      const options: ServerOptions & { watchFactory: WatchFactory } = {
        root,
        host: "127.0.0.1",
        port,
        watchFactory,
      };

      await expect(startServer(options)).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
      expect(watcherCloseCalls).toBe(1);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
      project.cleanup();
    }
  });

  it("closes its watcher when HTTP listen throws synchronously", async () => {
    const project = createTestProject();
    const root = findOpenspecRoot(project.projectDir);
    let watcherCloseCalls = 0;
    const watchFactory: WatchFactory = () => ({
      on: () => undefined,
      close: () => {
        watcherCloseCalls += 1;
      },
    });

    try {
      await expect(
        startServer({
          root,
          host: "127.0.0.1",
          port: -1,
          watchFactory,
        }),
      ).rejects.toThrow();
      expect(watcherCloseCalls).toBe(1);
    } finally {
      project.cleanup();
    }
  });

  it("closes its watcher once after successful shutdown", async () => {
    let watcherCloseCalls = 0;
    const server = await startTestServer({
      watchFactory: () => ({
        on: () => undefined,
        close: () => {
          watcherCloseCalls += 1;
        },
      }),
    });
    servers.push(server);

    await server.close();
    await server.close();
    expect(watcherCloseCalls).toBe(1);
  });

  it("removes server and fixture resources when a test callback fails", async () => {
    let projectDir = "";

    await expect(
      withTestServer(async (server) => {
        projectDir = server.projectDir;
        const response = await fetch(`${server.url}/api/not-a-route`);
        expect(response.status).toBe(404);
        throw new Error("simulated assertion failure");
      }),
    ).rejects.toThrow("simulated assertion failure");

    expect(projectDir).not.toBe("");
    expect(existsSync(projectDir)).toBe(false);
  });

  it("attempts every owned close and surfaces teardown failures", async () => {
    let closeCalls = 0;
    let delayedCloseCompleted = false;
    let releaseDelayedClose: (() => void) | undefined;
    const delayedClose = new Promise<void>((resolve) => {
      releaseDelayedClose = resolve;
    });
    const failing: TestServer = {
      projectDir: "/fictional/failing",
      url: "http://127.0.0.1:1",
      close: async () => {
        closeCalls += 1;
        throw new Error("simulated close failure");
      },
    };
    const succeeding: TestServer = {
      projectDir: "/fictional/succeeding",
      url: "http://127.0.0.1:2",
      close: async () => {
        closeCalls += 1;
        await delayedClose;
        delayedCloseCompleted = true;
      },
    };
    const owned = [failing, succeeding];

    const cleanup = closeTestServers(owned);
    await Promise.resolve();
    expect(closeCalls).toBe(2);
    releaseDelayedClose?.();

    await expect(cleanup).rejects.toThrow(
      "simulated close failure",
    );
    expect(closeCalls).toBe(2);
    expect(delayedCloseCompleted).toBe(true);
    expect(owned).toEqual([]);
  });
});
