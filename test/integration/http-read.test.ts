import { afterEach, describe, expect, it } from "vitest";
import {
  closeTestServers,
  startTestServer,
  type TestServer,
} from "../helpers/server.js";

const servers: TestServer[] = [];

afterEach(async () => {
  await closeTestServers(servers);
});

async function start(): Promise<TestServer> {
  const server = await startTestServer();
  servers.push(server);
  return server;
}

async function getJson(server: TestServer, path: string): Promise<{
  response: Response;
  body: unknown;
}> {
  const response = await fetch(`${server.url}${path}`);
  return { response, body: await response.json() };
}

describe("real HTTP read API", () => {
  it("returns health and project information from the isolated fixture", async () => {
    const server = await start();

    const health = await getJson(server, "/api/health");
    expect(health.response.status).toBe(200);
    expect(health.body).toEqual({ ok: true, watchers: 0 });

    const project = await getJson(server, "/api/project");
    expect(project.response.status).toBe(200);
    expect(project.body).toEqual({
      projectDir: server.projectDir,
      openspecDir: `${server.projectDir}/openspec`,
      hasConfig: true,
      config: expect.stringContaining("schema: spec-driven"),
    });
  });

  it("returns changes, overview, graph, and next-up from the fixture", async () => {
    const server = await start();

    const changes = await getJson(server, "/api/changes");
    expect(changes.response.status).toBe(200);
    expect(changes.body).toMatchObject({
      overview: {
        active: 2,
        archived: 1,
        totalTasks: 6,
        completedTasks: 4,
      },
      nextUp: expect.arrayContaining([
        expect.objectContaining({
          change: expect.objectContaining({ name: "add-dark-mode" }),
          nextTask: {
            id: "1.2",
            text: "Add the theme selector",
            section: "1. Theme",
          },
        }),
      ]),
      graph: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "change:add-dark-mode", kind: "change" }),
          expect.objectContaining({ id: "spec:interface", kind: "spec", main: true }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            from: "change:add-dark-mode",
            to: "spec:interface",
          }),
        ]),
      },
    });
    expect(
      (changes.body as { changes: Array<{ name: string }> }).changes.map(
        (change) => change.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        "add-dark-mode",
        "completed-export",
        "archive/2026-07-01-legacy-search",
      ]),
    );

    const graph = await getJson(server, "/api/graph");
    expect(graph.response.status).toBe(200);
    expect(graph.body).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: "change:completed-export" }),
      ]),
    });

    const next = await getJson(server, "/api/next");
    expect(next.response.status).toBe(200);
    expect(next.body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          change: expect.objectContaining({ name: "add-dark-mode" }),
        }),
      ]),
    });
  });

  it("returns active and archived change details with local notes", async () => {
    const server = await start();

    const active = await getJson(server, "/api/changes/add-dark-mode");
    expect(active.response.status).toBe(200);
    expect(active.body).toMatchObject({
      name: "add-dark-mode",
      archived: false,
      proposal: expect.stringContaining("comfortable theme"),
      design: expect.stringContaining("fictional workspace"),
      notes: "",
      tasks: {
        completed: 1,
        total: 3,
      },
      specs: [
        {
          id: "interface",
          content: expect.stringContaining("dark theme"),
        },
      ],
    });

    const archived = await getJson(
      server,
      "/api/changes/archive%2F2026-07-01-legacy-search",
    );
    expect(archived.response.status).toBe(200);
    expect(archived.body).toMatchObject({
      name: "archive/2026-07-01-legacy-search",
      archived: true,
      notes: "",
    });
  });

  it("searches fixture artifacts and handles an empty query", async () => {
    const server = await start();

    const search = await getJson(server, "/api/search?q=browser%20state");
    expect(search.response.status).toBe(200);
    expect(search.body).toMatchObject({
      query: "browser state",
      hits: expect.arrayContaining([
        expect.objectContaining({
          changeName: "add-dark-mode",
          kind: "design",
        }),
      ]),
    });

    const empty = await getJson(server, "/api/search?q=");
    expect(empty.response.status).toBe(200);
    expect(empty.body).toEqual({ query: "", hits: [] });
  });
});
