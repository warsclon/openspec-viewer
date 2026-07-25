import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import {
  buildSpecChangeGraph,
  getChangeDetail,
  getOverview,
  listChanges,
  listNextUp,
  summarizeChange,
} from "../../src/openspec/project.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

describe("project summaries", () => {
  it("summarizes partial, complete, and archived fixture changes", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const changes = listChanges(root, true);

    expect(changes).toHaveLength(3);
    expect(changes.find((change) => change.name === "add-dark-mode")).toMatchObject({
      archived: false,
      completedTasks: 1,
      totalTasks: 3,
      progress: 33,
      status: "in-progress",
      hasProposal: true,
      hasDesign: true,
      hasTasks: true,
      specIds: ["interface"],
      nextTask: {
        id: "1.2",
        text: "Add the theme selector",
        section: "1. Theme",
      },
    });
    expect(changes.find((change) => change.name === "completed-export")).toMatchObject({
      archived: false,
      completedTasks: 2,
      totalTasks: 2,
      progress: 100,
      status: "complete",
      hasDesign: false,
      specIds: ["export"],
      nextTask: null,
    });
    expect(
      changes.find(
        (change) => change.name === "archive/2026-07-01-legacy-search",
      ),
    ).toMatchObject({
      archived: true,
      archiveDate: "2026-07-01",
      displayName: "legacy-search",
      status: "complete",
      progress: 100,
    });
  });

  it("handles empty and partial changes with missing optional artifacts", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const emptyPath = join(root.changesDir, "empty-change");
    const partialPath = join(root.changesDir, "partial-change");
    mkdirSync(emptyPath);
    mkdirSync(partialPath);
    writeFileSync(join(partialPath, "proposal.md"), "## Why\n\nPartial only.\n", "utf8");

    expect(summarizeChange(root, "empty-change")).toMatchObject({
      status: "empty",
      progress: 0,
      hasProposal: false,
      hasDesign: false,
      hasTasks: false,
      totalTasks: 0,
      nextTask: null,
    });
    const detail = getChangeDetail(root, "partial-change");
    expect(detail).toMatchObject({
      status: "empty",
      proposal: "## Why\n\nPartial only.\n",
      design: null,
      tasks: null,
      specs: [],
      specDiffs: [],
    });
  });

  it("builds overview counts, graph edges, and next-up ordering", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);
    const secondPath = join(root.changesDir, "add-shortcuts");
    mkdirSync(join(secondPath, "specs", "interface"), { recursive: true });
    writeFileSync(
      join(secondPath, "tasks.md"),
      "## 1. Shortcuts\n\n- [x] 1.1 Define keys\n- [ ] 1.2 Implement keys\n",
      "utf8",
    );
    writeFileSync(
      join(secondPath, "specs", "interface", "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Shortcuts\n\n#### Scenario: Open search\n\n- **WHEN** a user presses the shortcut\n- **THEN** search opens\n",
      "utf8",
    );

    const changes = listChanges(root, true);
    const overview = getOverview(root, changes);
    expect(overview).toMatchObject({
      active: 3,
      archived: 1,
      totalTasks: 8,
      completedTasks: 5,
    });
    expect(overview.mainSpecs.map((spec) => spec.id)).toEqual(["interface"]);
    expect(overview.byDay.some((day) => day.date === "2026-07-01")).toBe(true);

    const graph = buildSpecChangeGraph(root, changes);
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: "spec:interface", main: true, degree: 3 }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        from: "change:add-shortcuts",
        to: "spec:interface",
      }),
    );

    expect(listNextUp(changes).map((item) => item.change.name)).toEqual([
      "add-shortcuts",
      "add-dark-mode",
    ]);
  });
});
