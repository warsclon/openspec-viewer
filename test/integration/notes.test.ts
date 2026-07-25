import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import { notesPath, readNotes, viewerDir, writeNotes } from "../../src/openspec/notes.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

describe("local change notes", () => {
  it("rejects traversal-shaped change names without creating local state", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    expect(() => notesPath(root, "../outside")).toThrow(
      "Invalid note change name: ../outside",
    );
    expect(() => writeNotes(root, "..\\outside", "contained\n")).toThrow(
      "Invalid note change name: ..\\outside",
    );
    expect(() => readNotes(root, "/absolute-change")).toThrow(
      "Invalid note change name: /absolute-change",
    );
    expect(() => writeNotes(root, "nested/change", "contained\n")).toThrow(
      "Invalid note change name: nested/change",
    );
    expect(existsSync(join(project.projectDir, "outside.md"))).toBe(false);
    expect(existsSync(viewerDir(root))).toBe(false);
    expect(existsSync(join(project.projectDir, ".gitignore"))).toBe(false);
  });

  it("stores notes outside OpenSpec artifacts without creating a root gitignore", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    const proposalBefore = readFileSync(proposalPath, "utf8");

    expect(writeNotes(root, "add-dark-mode", "Remember the contrast check.\n")).toBe(
      "Remember the contrast check.\n",
    );
    expect(readNotes(root, "add-dark-mode")).toBe("Remember the contrast check.\n");
    expect(readFileSync(notesPath(root, "add-dark-mode"), "utf8")).toBe(
      "Remember the contrast check.\n",
    );
    expect(readFileSync(join(viewerDir(root), ".gitignore"), "utf8")).toBe(
      "# local openspec-viewer state (do not commit)\n*\n",
    );
    expect(existsSync(join(project.projectDir, ".gitignore"))).toBe(false);
    expect(readFileSync(proposalPath, "utf8")).toBe(proposalBefore);
  });

  it("preserves an existing root gitignore and supports archived notes", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const rootGitignore = join(project.projectDir, ".gitignore");
    writeFileSync(rootGitignore, "node_modules/\n", "utf8");

    writeNotes(root, "archive/2026-07-01-legacy-search", "Historical context.\n");
    expect(readNotes(root, "archive/2026-07-01-legacy-search")).toBe(
      "Historical context.\n",
    );
    expect(readFileSync(rootGitignore, "utf8")).toBe(
      "node_modules/\n\n# openspec-viewer local notes\n.openspec-viewer/\n",
    );
  });
});
