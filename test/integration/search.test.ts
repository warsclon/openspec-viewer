import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import { searchProject } from "../../src/openspec/search.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

describe("project search", () => {
  it("searches tasks, documents, main specs, and delta specs", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    expect(searchProject(root, "keyboard access")).toContainEqual(
      expect.objectContaining({
        kind: "task",
        changeName: "add-dark-mode",
        taskId: "2.1",
      }),
    );
    expect(searchProject(root, "comfortable readers")).toContainEqual(
      expect.objectContaining({
        kind: "proposal",
        changeName: "add-dark-mode",
        snippet: expect.stringContaining("comfortable theme"),
      }),
    );
    expect(searchProject(root, "readers planning")).toContainEqual(
      expect.objectContaining({
        kind: "proposal",
        changeName: "add-dark-mode",
      }),
    );
    expect(searchProject(root, "browser state")).toContainEqual(
      expect.objectContaining({ kind: "design", changeName: "add-dark-mode" }),
    );
    expect(searchProject(root, "choose a visual theme")).toContainEqual(
      expect.objectContaining({ kind: "spec-main", specId: "interface" }),
    );
    expect(searchProject(root, "DARK COLOR TOKENS")).toContainEqual(
      expect.objectContaining({
        kind: "spec-delta",
        changeName: "add-dark-mode",
        specId: "interface",
      }),
    );
  });

  it("handles empty, case-insensitive, archive, and limit behavior", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    expect(searchProject(root, "   ")).toEqual([]);
    expect(searchProject(root, "DARK MODE")).toContainEqual(
      expect.objectContaining({ kind: "change", changeName: "add-dark-mode" }),
    );
    expect(searchProject(root, "legacy", { includeArchive: true })).toContainEqual(
      expect.objectContaining({
        kind: "change",
        changeName: "archive/2026-07-01-legacy-search",
      }),
    );
    expect(searchProject(root, "legacy", { includeArchive: false })).toEqual([]);

    const limited = searchProject(root, "theme", { limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0].score).toBeGreaterThanOrEqual(limited[1].score);
  });
});
