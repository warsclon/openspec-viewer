import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CommandRunner } from "../../src/openspec/mutate.js";
import {
  closeTestServers,
  startTestServer,
  type TestServer,
} from "../helpers/server.js";

const servers: TestServer[] = [];

afterEach(async () => {
  await closeTestServers(servers);
});

async function start(runCommand: CommandRunner): Promise<TestServer> {
  const server = await startTestServer({ runCommand });
  servers.push(server);
  return server;
}

async function post(
  server: TestServer,
  path: string,
  body: unknown,
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await fetch(`${server.url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
  };
}

describe("real HTTP change lifecycle", () => {
  it("creates a change through the injected OpenSpec command boundary", async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const server = await start(async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      const generated = join(
        cwd,
        "openspec",
        "changes",
        "http-created-change",
      );
      mkdirSync(generated, { recursive: true });
      writeFileSync(join(generated, "proposal.md"), "generated over HTTP\n", "utf8");
      return { code: 0, stdout: "created\n", stderr: "" };
    });

    const result = await post(server, "/api/changes", {
      name: "http-created-change",
      description: "Created by the fictional HTTP test.",
    });

    expect(result.response.status).toBe(201);
    expect(result.body).toMatchObject({
      name: "http-created-change",
      stdout: "created\n",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "openspec",
      args: [
        "new",
        "change",
        "http-created-change",
        "--json",
        "--description",
        "Created by the fictional HTTP test.",
      ],
    });
    expect(calls[0].cwd).not.toBe(server.projectDir);
    expect(
      readFileSync(
        join(
          server.projectDir,
          "openspec",
          "changes",
          "http-created-change",
          "proposal.md",
        ),
        "utf8",
      ),
    ).toBe("generated over HTTP\n");
  });

  it("archives with confirmation and skip-specs through the injected boundary", async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const server = await start(async (command, args, cwd) => {
      calls.push({ command, args, cwd });
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
    });

    const result = await post(
      server,
      "/api/changes/add-dark-mode/archive",
      { confirm: true, skipSpecs: true },
    );

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      name: "add-dark-mode",
      stdout: "archived\n",
      stderr: "",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "openspec",
      args: [
        "archive",
        "add-dark-mode",
        "-y",
        "--json",
        "--skip-specs",
      ],
    });
    expect(
      existsSync(
        join(server.projectDir, "openspec", "changes", "add-dark-mode"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          server.projectDir,
          "openspec",
          "changes",
          "archive",
          "2026-07-25-add-dark-mode",
        ),
      ),
    ).toBe(true);
  });

  it("reports subprocess failure and leaves no partial change", async () => {
    const server = await start(async (_command, _args, cwd) => {
      const partial = join(
        cwd,
        "openspec",
        "changes",
        "partial-http-change",
      );
      mkdirSync(partial, { recursive: true });
      writeFileSync(join(partial, "proposal.md"), "partial\n", "utf8");
      return { code: 2, stdout: "", stderr: "fictional generation failed" };
    });

    const result = await post(server, "/api/changes", {
      name: "partial-http-change",
    });

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ error: "fictional generation failed" });
    expect(
      existsSync(
        join(
          server.projectDir,
          "openspec",
          "changes",
          "partial-http-change",
        ),
      ),
    ).toBe(false);
  });

  it("reports archive subprocess failure without moving the active change", async () => {
    const server = await start(async () => ({
      code: 3,
      stdout: "",
      stderr: "fictional archive failed",
    }));

    const result = await post(
      server,
      "/api/changes/add-dark-mode/archive",
      { confirm: true },
    );

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ error: "fictional archive failed" });
    expect(
      existsSync(
        join(server.projectDir, "openspec", "changes", "add-dark-mode"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          server.projectDir,
          "openspec",
          "changes",
          "archive",
          "2026-07-25-add-dark-mode",
        ),
      ),
    ).toBe(false);
  });
});
