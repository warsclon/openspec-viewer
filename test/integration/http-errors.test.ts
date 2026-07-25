import { readFileSync } from "node:fs";
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
  init?: RequestInit,
): Promise<{ response: Response; body: { error?: string } }> {
  const response = await fetch(`${server.url}${path}`, init);
  return {
    response,
    body: (await response.json()) as { error?: string },
  };
}

function json(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("real HTTP error contract", () => {
  it("returns 404 for unknown routes and changes", async () => {
    const server = await start();

    const route = await requestJson(server, "/api/not-a-route");
    expect(route.response.status).toBe(404);
    expect(route.body).toEqual({ error: "Not found" });

    const change = await requestJson(server, "/api/changes/missing-change");
    expect(change.response.status).toBe(404);
    expect(change.body).toEqual({ error: "Change not found: missing-change" });

    const notes = await requestJson(
      server,
      "/api/changes/missing-change/notes",
    );
    expect(notes.response.status).toBe(404);
    expect(notes.body).toEqual({ error: "Change not found: missing-change" });
  });

  it("returns 400 for malformed URL encoding and JSON", async () => {
    const server = await start();

    const encoding = await requestJson(server, "/api/changes/%E0%A4%A");
    expect(encoding.response.status).toBe(400);
    expect(encoding.body).toEqual({ error: "Malformed URL encoding" });

    const invalidJson = await requestJson(server, "/api/changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(invalidJson.response.status).toBe(400);
    expect(invalidJson.body).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 for missing required mutation fields", async () => {
    const server = await start();

    const cases: Array<{
      path: string;
      init: RequestInit;
      error: string;
    }> = [
      {
        path: "/api/changes",
        init: json("POST", {}),
        error: "name is required",
      },
      {
        path: "/api/changes",
        init: json("POST", null),
        error: "name is required",
      },
      {
        path: "/api/changes/add-dark-mode/proposal",
        init: json("PUT", {}),
        error: "content (string) is required",
      },
      {
        path: "/api/changes/add-dark-mode/design",
        init: json("PUT", null),
        error: "content (string) is required",
      },
      {
        path: "/api/changes/add-dark-mode/notes",
        init: json("PUT", {}),
        error: "content (string) is required",
      },
      {
        path: "/api/changes/add-dark-mode/notes",
        init: json("PUT", null),
        error: "content (string) is required",
      },
      {
        path: "/api/changes/add-dark-mode/tasks/mutate",
        init: json("POST", {}),
        error: "task mutation type is required",
      },
      {
        path: "/api/changes/add-dark-mode/tasks/toggle",
        init: json("POST", {}),
        error: "taskId is required",
      },
      {
        path: "/api/changes/add-dark-mode/tasks/toggle",
        init: json("POST", null),
        error: "taskId is required",
      },
      {
        path: "/api/changes/add-dark-mode/archive",
        init: json("POST", {}),
        error: "confirm: true is required (no magic undo)",
      },
      {
        path: "/api/changes/add-dark-mode/archive",
        init: json("POST", null),
        error: "confirm: true is required (no magic undo)",
      },
    ];

    for (const item of cases) {
      const result = await requestJson(server, item.path, item.init);
      expect(result.response.status, item.path).toBe(400);
      expect(result.body, item.path).toEqual({ error: item.error });
    }
  });

  it("returns 400 for invalid create names without publishing a change", async () => {
    const server = await start();

    const result = await requestJson(
      server,
      "/api/changes",
      json("POST", { name: "Invalid Name" }),
    );

    expect(result.response.status).toBe(400);
    expect(result.body.error).toMatch(/^Invalid name\. Use kebab-case:/);
  });

  it("returns stable conflict and not-found statuses for domain errors", async () => {
    const server = await start();

    const duplicate = await requestJson(
      server,
      "/api/changes",
      json("POST", { name: "add-dark-mode" }),
    );
    expect(duplicate.response.status).toBe(409);
    expect(duplicate.body).toEqual({
      error: "Change already exists: add-dark-mode",
    });

    const invalidMutation = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/mutate",
      json("POST", { type: "launch-rockets" }),
    );
    expect(invalidMutation.response.status).toBe(400);
    expect(invalidMutation.body).toEqual({ error: "invalid task mutation" });

    const invalidSections = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks",
      json("PUT", { sections: [{ title: "Missing tasks" }] }),
    );
    expect(invalidSections.response.status).toBe(400);
    expect(invalidSections.body).toEqual({ error: "invalid task sections" });

    const invalidReplacement = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/mutate",
      json("POST", {
        type: "replace",
        sections: [{ title: "Missing tasks" }],
      }),
    );
    expect(invalidReplacement.response.status).toBe(400);
    expect(invalidReplacement.body).toEqual({ error: "invalid task mutation" });

    const missingTask = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/toggle",
      json("POST", { taskId: "99.99" }),
    );
    expect(missingTask.response.status).toBe(404);
    expect(missingTask.body).toEqual({ error: "Task not found: 99.99" });
  });

  it("rejects mistyped optional fields without changing tasks", async () => {
    const server = await start();
    const tasksPath = join(
      server.projectDir,
      "openspec",
      "changes",
      "add-dark-mode",
      "tasks.md",
    );
    const before = readFileSync(tasksPath, "utf8");

    const invalidUpdate = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/mutate",
      json("POST", {
        type: "update",
        taskId: "1.1",
        done: "yes",
      }),
    );
    expect(invalidUpdate.response.status).toBe(400);
    expect(invalidUpdate.body).toEqual({ error: "invalid task mutation" });

    const invalidToggle = await requestJson(
      server,
      "/api/changes/add-dark-mode/tasks/toggle",
      json("POST", { taskId: "1.1", done: "yes" }),
    );
    expect(invalidToggle.response.status).toBe(400);
    expect(invalidToggle.body).toEqual({ error: "done must be a boolean" });

    const invalidDescription = await requestJson(
      server,
      "/api/changes",
      json("POST", { name: "typed-change", description: 42 }),
    );
    expect(invalidDescription.response.status).toBe(400);
    expect(invalidDescription.body).toEqual({
      error: "description must be a string",
    });

    const invalidSkipSpecs = await requestJson(
      server,
      "/api/changes/add-dark-mode/archive",
      json("POST", { confirm: true, skipSpecs: "yes" }),
    );
    expect(invalidSkipSpecs.response.status).toBe(400);
    expect(invalidSkipSpecs.body).toEqual({
      error: "skipSpecs must be a boolean",
    });

    expect(readFileSync(tasksPath, "utf8")).toBe(before);
  });
});
