import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import { getChangeSpecDiffs } from "../../src/openspec/spec-diff.js";
import { createTestProject, type TestProject } from "../helpers/fixture.js";

const projects: TestProject[] = [];

afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});

describe("change spec discovery", () => {
  it("connects deltas to present and absent main specifications", () => {
    const project = createTestProject();
    projects.push(project);
    const root = findOpenspecRoot(project.projectDir);

    expect(getChangeSpecDiffs(root, "add-dark-mode")).toEqual([
      expect.objectContaining({
        id: "interface",
        mainExists: true,
        summary: { added: 1, modified: 0, removed: 0, other: 0 },
        mainContent: expect.stringContaining("Theme selection"),
      }),
    ]);
    expect(getChangeSpecDiffs(root, "completed-export")).toEqual([
      expect.objectContaining({
        id: "export",
        mainExists: false,
        summary: { added: 1, modified: 0, removed: 0, other: 0 },
        mainContent: null,
      }),
    ]);
  });
});
