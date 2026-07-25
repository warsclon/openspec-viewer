import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import {
  applyTaskMutation,
  replaceTasks,
  writeArtifact,
} from "../../src/openspec/mutate.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

describe("artifact mutations", () => {
  it("rejects invalid content without changing the artifact", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const proposalPath = join(root.changesDir, "add-dark-mode", "proposal.md");
    const before = readFileSync(proposalPath, "utf8");

    expect(() =>
      writeArtifact(root, "add-dark-mode", "proposal", null as unknown as string),
    ).toThrow("Artifact content must be a string");
    expect(readFileSync(proposalPath, "utf8")).toBe(before);
  });

  it("writes active proposal, design, and raw tasks with normalized newlines", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    const proposal = writeArtifact(root, "add-dark-mode", "proposal", "New proposal");
    const design = writeArtifact(root, "add-dark-mode", "design", "New design\n");
    const tasks = writeArtifact(
      root,
      "add-dark-mode",
      "tasks",
      "## 1. Work\n\n- [ ] 1.1 Verify writes",
    );

    expect(proposal.content).toBe("New proposal\n");
    expect(design.content).toBe("New design\n");
    expect(tasks.content).toBe("## 1. Work\n\n- [ ] 1.1 Verify writes\n");
    expect(readFileSync(proposal.path, "utf8")).toBe(proposal.content);
    expect(readFileSync(design.path, "utf8")).toBe(design.content);
    expect(readFileSync(tasks.path, "utf8")).toBe(tasks.content);
  });

  it("persists structured task replacements and mutations", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    const replaced = replaceTasks(root, "add-dark-mode", [
      {
        title: "1. Verification",
        tasks: [{ id: "1.1", text: "Run the suite", done: false }],
      },
    ]);
    expect(replaced.parsed.tasks).toEqual([
      expect.objectContaining({ id: "1.1", text: "Run the suite", done: false }),
    ]);

    const updated = applyTaskMutation(root, "add-dark-mode", {
      type: "update",
      taskId: "1.1",
      text: "Run every suite",
      done: true,
    });
    expect(updated.parsed.tasks).toEqual([
      expect.objectContaining({ id: "1.1", text: "Run every suite", done: true }),
    ]);
    expect(readFileSync(updated.path, "utf8")).toBe(
      "## 1. Verification\n\n- [x] 1.1 Run every suite\n",
    );
  });

  it("rejects missing and archived targets without partial writes", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const archivedProposal = join(
      root.archiveDir,
      "2026-07-01-legacy-search",
      "proposal.md",
    );
    const archivedBefore = readFileSync(archivedProposal, "utf8");
    const archivedTasks = join(
      root.archiveDir,
      "2026-07-01-legacy-search",
      "tasks.md",
    );
    const archivedTasksBefore = readFileSync(archivedTasks, "utf8");

    expect(() =>
      writeArtifact(
        root,
        "archive/2026-07-01-legacy-search",
        "proposal",
        "Forbidden change",
      ),
    ).toThrow("Archived changes are read-only");
    expect(() =>
      applyTaskMutation(root, "archive/2026-07-01-legacy-search", {
        type: "add",
        sectionIndex: 0,
        text: "Forbidden task",
      }),
    ).toThrow("Archived changes are read-only");
    expect(readFileSync(archivedProposal, "utf8")).toBe(archivedBefore);
    expect(readFileSync(archivedTasks, "utf8")).toBe(archivedTasksBefore);

    const missingProposal = join(root.changesDir, "missing-change", "proposal.md");
    expect(() =>
      writeArtifact(root, "missing-change", "proposal", "No target"),
    ).toThrow();
    expect(existsSync(missingProposal)).toBe(false);
  });
});
