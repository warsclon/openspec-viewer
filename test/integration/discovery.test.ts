import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  changeDir,
  findOpenspecRoot,
  listChangeNames,
  listSpecFiles,
  readTextIfExists,
} from "../../src/openspec/discover.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("OpenSpec discovery", () => {
  it("rejects a traversal change path", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    expect(() => changeDir(root, "../outside")).toThrow(
      "Invalid change name: ../outside",
    );
  });

  it("finds the project from ancestors and a direct OpenSpec path", () => {
    const project = createTestProject();
    projects.push(project);
    const nestedPath = join(
      project.projectDir,
      "openspec",
      "changes",
      "add-dark-mode",
      "specs",
      "interface",
    );

    const fromNested = findOpenspecRoot(nestedPath);
    const fromOpenspec = findOpenspecRoot(join(project.projectDir, "openspec"));
    expect(fromNested.projectDir).toBe(project.projectDir);
    expect(fromOpenspec).toEqual(fromNested);
    expect(fromNested.configPath).toBe(join(project.projectDir, "openspec", "config.yaml"));
  });

  it("lists active and archived changes in deterministic groups", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    expect(listChangeNames(root)).toEqual(["add-dark-mode", "completed-export"]);
    expect(listChangeNames(root, true)).toEqual([
      "add-dark-mode",
      "completed-export",
      "archive/2026-07-01-legacy-search",
    ]);
    expect(listSpecFiles(changeDir(root, "add-dark-mode"))).toEqual([
      {
        id: "interface",
        path: join(
          root.changesDir,
          "add-dark-mode",
          "specs",
          "interface",
          "spec.md",
        ),
      },
    ]);
    expect(readTextIfExists(join(root.changesDir, "add-dark-mode", "missing.md"))).toBeNull();
  });

  it("reports a missing OpenSpec project from the requested path", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "openspec-viewer-empty-"));
    temporaryDirectories.push(emptyRoot);
    const nestedPath = join(emptyRoot, "one", "two");
    mkdirSync(nestedPath, { recursive: true });

    expect(() => findOpenspecRoot(nestedPath)).toThrow(
      `No openspec/ folder found from ${nestedPath}. Initialize with: openspec init`,
    );
  });
});
