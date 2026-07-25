import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

async function requestJson(
  server: TestServer,
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await fetch(`${server.url}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function changeFile(server: TestServer, change: string, artifact: string): string {
  return join(server.projectDir, "openspec", "changes", change, artifact);
}

describe("real HTTP mutation API", () => {
  it("writes proposal, design, and local notes with exact persisted content", async () => {
    const server = await start();
    const proposal = "## Why\n\nProve proposal persistence.";
    const design = "## Decision\n\nUse the public HTTP boundary.";
    const notes = "A fictional private reminder.\n";

    const proposalResult = await requestJson(
      server,
      "/api/changes/add-dark-mode/proposal",
      "PUT",
      { content: proposal },
    );
    expect(proposalResult.response.status).toBe(200);
    expect(proposalResult.body).toEqual({ content: `${proposal}\n` });
    expect(
      readFileSync(changeFile(server, "add-dark-mode", "proposal.md"), "utf8"),
    ).toBe(`${proposal}\n`);

    const designResult = await requestJson(
      server,
      "/api/changes/add-dark-mode/design",
      "PUT",
      { content: design },
    );
    expect(designResult.response.status).toBe(200);
    expect(designResult.body).toEqual({ content: `${design}\n` });
    expect(
      readFileSync(changeFile(server, "add-dark-mode", "design.md"), "utf8"),
    ).toBe(`${design}\n`);

    const notesResult = await requestJson(
      server,
      "/api/changes/add-dark-mode/notes",
      "PUT",
      { content: notes },
    );
    expect(notesResult.response.status).toBe(200);
    expect(notesResult.body).toEqual({ content: notes });

    const notesRead = await requestJson(
      server,
      "/api/changes/add-dark-mode/notes",
      "GET",
    );
    expect(notesRead.response.status).toBe(200);
    expect(notesRead.body).toEqual({ content: notes });
    expect(
      readFileSync(
        join(
          server.projectDir,
          ".openspec-viewer",
          "notes",
          "add-dark-mode.md",
        ),
        "utf8",
      ),
    ).toBe(notes);
  });

  it("replaces raw and structured tasks with exact persisted content", async () => {
    const server = await start();
    const raw = "## Raw tasks\n\n- [ ] 9.1 Exercise the raw endpoint";

    const rawResult = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks",
      "PUT",
      { content: raw },
    );
    expect(rawResult.response.status).toBe(200);
    expect(rawResult.body).toMatchObject({
      completed: 0,
      total: 1,
      raw: `${raw}\n`,
    });
    expect(
      readFileSync(changeFile(server, "add-dark-mode", "tasks.md"), "utf8"),
    ).toBe(`${raw}\n`);

    const sections = [
      {
        title: "1. Delivery",
        tasks: [
          { id: "1.1", text: "Keep the first task", done: true },
          { id: "1.2", text: "Finish the HTTP layer", done: false },
        ],
      },
    ];
    const expected = [
      "## 1. Delivery",
      "",
      "- [x] 1.1 Keep the first task",
      "- [ ] 1.2 Finish the HTTP layer",
      "",
    ].join("\n");

    const structuredResult = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks",
      "PUT",
      { sections },
    );
    expect(structuredResult.response.status).toBe(200);
    expect(structuredResult.body).toMatchObject({
      completed: 1,
      total: 2,
      raw: expected,
    });
    expect(
      readFileSync(changeFile(server, "add-dark-mode", "tasks.md"), "utf8"),
    ).toBe(expected);
  });

  it("mutates and toggles tasks and returns the persisted representation", async () => {
    const server = await start();

    const add = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/mutate",
      "POST",
      {
        type: "add",
        sectionIndex: 0,
        id: "1.3",
        text: "Verify persistence",
      },
    );
    expect(add.response.status).toBe(200);
    expect(add.body).toMatchObject({
      completed: 1,
      total: 4,
      raw: expect.stringContaining("- [ ] 1.3 Verify persistence"),
    });

    const toggle = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/toggle",
      "POST",
      { taskId: "1.2", done: true },
    );
    expect(toggle.response.status).toBe(200);
    expect(toggle.body).toMatchObject({
      completed: 2,
      total: 4,
      task: {
        id: "1.2",
        text: "Add the theme selector",
        done: true,
      },
    });

    const persisted = readFileSync(
      changeFile(server, "add-dark-mode", "tasks.md"),
      "utf8",
    );
    expect(persisted).toContain("- [x] 1.2 Add the theme selector");
    expect(persisted).toContain("- [ ] 1.3 Verify persistence");
  });

  it("rejects every archived OpenSpec mutation without changing artifact bytes", async () => {
    const server = await start();
    const change = "archive/2026-07-01-legacy-search";
    const encoded = encodeURIComponent(change);
    const proposalPath = changeFile(
      server,
      change,
      "proposal.md",
    );
    const tasksPath = changeFile(server, change, "tasks.md");
    const designPath = changeFile(server, change, "design.md");
    const before = {
      proposal: readFileSync(proposalPath, "utf8"),
      tasks: readFileSync(tasksPath, "utf8"),
      hasDesign: existsSync(designPath),
    };

    const attempts: Array<{
      path: string;
      method: "POST" | "PUT";
      body: unknown;
    }> = [
      {
        path: `/api/changes/${encoded}/proposal`,
        method: "PUT",
        body: { content: "forbidden" },
      },
      {
        path: `/api/changes/${encoded}/design`,
        method: "PUT",
        body: { content: "forbidden" },
      },
      {
        path: `/api/changes/${encoded}/tasks`,
        method: "PUT",
        body: { content: "## Forbidden\n" },
      },
      {
        path: `/api/changes/${encoded}/tasks`,
        method: "PUT",
        body: { sections: [] },
      },
      {
        path: `/api/changes/${encoded}/tasks/mutate`,
        method: "POST",
        body: { type: "delete", taskId: "1.1" },
      },
      {
        path: `/api/changes/${encoded}/tasks/toggle`,
        method: "POST",
        body: { taskId: "1.1", done: false },
      },
      {
        path: `/api/changes/${encoded}/archive`,
        method: "POST",
        body: { confirm: true },
      },
    ];

    for (const attempt of attempts) {
      const result = await requestJson(
        server,
        attempt.path,
        attempt.method,
        attempt.body,
      );
      expect(result.response.status, attempt.path).toBe(409);
      expect(result.body, attempt.path).toEqual({
        error: "Archived changes are read-only",
      });
    }

    expect(readFileSync(proposalPath, "utf8")).toBe(before.proposal);
    expect(readFileSync(tasksPath, "utf8")).toBe(before.tasks);
    expect(existsSync(designPath)).toBe(before.hasDesign);

    const note = await requestJson(
      server,
      `/api/changes/${encoded}/notes`,
      "PUT",
      { content: "Notes remain editable.\n" },
    );
    expect(note.response.status).toBe(200);
    expect(note.body).toEqual({ content: "Notes remain editable.\n" });
  });
});
