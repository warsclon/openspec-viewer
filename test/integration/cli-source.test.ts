import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";
import type { ServerOptions } from "../../src/server.js";
import {
  createTestProject,
  type TestProject,
} from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

function project(): TestProject {
  const created = createTestProject();
  projects.push(created);
  return created;
}

describe("source CLI composition", () => {
  it("passes named server options and --no-open to the public seams", async () => {
    const fixture = project();
    const starts: ServerOptions[] = [];
    const opened: string[] = [];
    const logs: string[] = [];
    let closeCalls = 0;

    const server = await runCli(
      [
        "--path",
        fixture.projectDir,
        "--port",
        "5173",
        "--host",
        "127.0.0.2",
        "--no-archive",
        "--no-open",
      ],
      {
        start: async (options) => {
          starts.push(options);
          return {
            url: "http://127.0.0.2:5173",
            close: async () => {
              closeCalls += 1;
            },
          };
        },
        open: (url) => opened.push(url),
        log: (message = "") => logs.push(message),
      },
    );

    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({
      host: "127.0.0.2",
      port: 5173,
      includeArchive: false,
      root: {
        projectDir: fixture.projectDir,
      },
    });
    expect(opened).toEqual([]);
    expect(logs).toContain("  UI:       http://127.0.0.2:5173");
    await server?.close();
    expect(closeCalls).toBe(1);
  });

  it("accepts a positional project and opens the returned URL by default", async () => {
    const fixture = project();
    const opened: string[] = [];

    const server = await runCli([fixture.projectDir, "--archive"], {
      start: async (options) => {
        expect(options.includeArchive).toBe(true);
        return {
          url: "http://127.0.0.1:4321",
          close: async () => undefined,
        };
      },
      open: (url) => opened.push(url),
      log: () => undefined,
    });

    expect(opened).toEqual(["http://127.0.0.1:4321"]);
    await server?.close();
  });

  it("prints help and version without starting a server or browser", async () => {
    let starts = 0;
    let opens = 0;
    const help: string[] = [];
    const version: string[] = [];
    const dependencies = {
      start: async () => {
        starts += 1;
        return {
          url: "http://127.0.0.1:4321",
          close: async () => undefined,
        };
      },
      open: () => {
        opens += 1;
      },
    };

    await runCli(["--help"], {
      ...dependencies,
      log: (message = "") => help.push(message),
    });
    await runCli(["--version"], {
      ...dependencies,
      log: (message = "") => version.push(message),
    });

    expect(help.join("\n")).toContain("Usage:");
    expect(version).toEqual(["0.5.0"]);
    expect(starts).toBe(0);
    expect(opens).toBe(0);
  });

  it("fails before server or browser startup when OpenSpec is missing", async () => {
    const fixture = project();
    rmSync(join(fixture.projectDir, "openspec"), {
      recursive: true,
      force: true,
    });
    let starts = 0;
    let opens = 0;

    await expect(
      runCli(["--path", fixture.projectDir], {
        start: async () => {
          starts += 1;
          return {
            url: "http://127.0.0.1:4321",
            close: async () => undefined,
          };
        },
        open: () => {
          opens += 1;
        },
        log: () => undefined,
      }),
    ).rejects.toThrow(
      `No openspec/ folder found from ${fixture.projectDir}`,
    );
    expect(starts).toBe(0);
    expect(opens).toBe(0);
  });
});
