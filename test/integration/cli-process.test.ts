import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCliProcess, type CliProcess } from "../helpers/cli-process.js";
import {
  createTestProject,
  type TestProject,
} from "../helpers/fixture.js";

const processes: CliProcess[] = [];
const projects: TestProject[] = [];

beforeAll(() => {
  execFileSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
});

afterAll(async () => {
  const results = await Promise.allSettled(
    processes.splice(0).map((process) => process.stop()),
  );
  for (const project of projects.splice(0)) project.cleanup();
  const failure = results.find(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected",
  );
  if (failure) throw failure.reason;
});

describe("compiled CLI process", () => {
  it("starts against an isolated fixture and terminates cleanly", async () => {
    const project = createTestProject();
    projects.push(project);
    const cli = await startCliProcess({
      executable: process.execPath,
      prefixArgs: [join(process.cwd(), "dist", "cli.js")],
      projectDir: project.projectDir,
      args: ["--no-archive"],
      cwd: process.cwd(),
    });
    processes.push(cli);

    const health = await fetch(`${cli.url}/api/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ ok: true, watchers: 0 });

    const changes = await fetch(`${cli.url}/api/changes`).then((response) =>
      response.json(),
    );
    expect(changes.overview).toMatchObject({ active: 2, archived: 0 });
    expect(
      changes.changes.every(
        (change: { archived: boolean }) => change.archived === false,
      ),
    ).toBe(true);

    expect(cli.stdout()).toContain(`project:  ${project.projectDir}`);
    expect(cli.stdout()).toContain(`openspec: ${project.projectDir}/openspec`);
    expect(cli.stdout()).toContain(`UI:       ${cli.url}`);
    expect(cli.stderr()).toBe("");

    const exit = await cli.stop();
    expect(exit.forced).toBe(false);
    expect(exit.code).toBeNull();
    expect(exit.signal).toBe("SIGTERM");
    await expect(fetch(`${cli.url}/api/health`)).rejects.toThrow();
  });

  it("runs the bundled demo in an isolated temporary copy and removes it on exit", async () => {
    const callerDir = mkdtempSync(join(tmpdir(), "openspec-viewer-demo-caller-"));
    const fixtureTasks = join(
      process.cwd(),
      "demo",
      "representative-openspec",
      "openspec",
      "changes",
      "add-dark-mode",
      "tasks.md",
    );
    const fixtureBefore = readFileSync(fixtureTasks, "utf8");

    try {
      const cli = await startCliProcess({
        executable: process.execPath,
        prefixArgs: [join(process.cwd(), "dist", "cli.js")],
        args: ["--demo"],
        cwd: callerDir,
      });
      processes.push(cli);

      const project = await fetch(`${cli.url}/api/project`).then((response) =>
        response.json(),
      );
      expect(project).toMatchObject({
        mode: "demo",
        label: "Fictional demo project",
      });
      expect(existsSync(project.projectDir)).toBe(true);
      expect(existsSync(join(callerDir, "openspec"))).toBe(false);

      const changes = await fetch(`${cli.url}/api/changes`).then((response) =>
        response.json(),
      );
      expect(
        changes.changes
          .filter((change: { archived: boolean }) => !change.archived)
          .map((change: { lastModified: string }) => change.lastModified),
      ).toEqual([
        "2026-07-15T12:00:00.000Z",
        "2026-07-15T12:00:00.000Z",
      ]);

      const toggle = await fetch(
        `${cli.url}/api/changes/add-dark-mode/tasks/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: "1.2", done: true }),
        },
      );
      expect(toggle.status).toBe(200);

      const exit = await cli.stop();
      expect(exit.forced).toBe(false);
      expect(existsSync(project.projectDir)).toBe(false);
      expect(readFileSync(fixtureTasks, "utf8")).toBe(fixtureBefore);
    } finally {
      rmSync(callerDir, { recursive: true, force: true });
    }
  });
});
