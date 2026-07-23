import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../src/openspec/discover.js";
import {
  buildSpecChangeGraph,
  listChanges,
  listNextUp,
  summarizeChange,
} from "../src/openspec/project.js";
import { searchProject } from "../src/openspec/search.js";

const dirs: string[] = [];

function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "osv-"));
  dirs.push(root);
  const openspec = join(root, "openspec");
  const change = join(openspec, "changes", "add-theme");
  const archive = join(openspec, "changes", "archive", "2026-07-01-old-feature");
  mkdirSync(join(change, "specs", "ui"), { recursive: true });
  mkdirSync(join(archive, "specs", "ui"), { recursive: true });
  mkdirSync(join(openspec, "specs", "ui"), { recursive: true });
  writeFileSync(join(openspec, "config.yaml"), "schema: spec-driven\n");
  writeFileSync(
    join(change, "tasks.md"),
    `## 1. Work\n\n- [x] 1.1 Done\n- [ ] 1.2 Next up\n`,
  );
  writeFileSync(join(change, "proposal.md"), "# Proposal\n\nAdd theme support\n");
  writeFileSync(
    join(change, "specs", "ui", "spec.md"),
    `## ADDED Requirements\n\n### Requirement: Dark mode\nUsers can toggle theme.\n`,
  );
  writeFileSync(
    join(archive, "tasks.md"),
    `## 1. Work\n\n- [x] 1.1 All done\n`,
  );
  writeFileSync(
    join(archive, "specs", "ui", "spec.md"),
    `## ADDED Requirements\n\n### Requirement: Buttons\nButtons exist.\n`,
  );
  writeFileSync(join(openspec, "specs", "ui", "spec.md"), "## Purpose\n\nUI module\n");
  return root;
}

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe("project discovery and summaries", () => {
  it("finds openspec root and summarizes changes", () => {
    const projectDir = fixtureProject();
    const root = findOpenspecRoot(join(projectDir, "openspec", "changes"));
    expect(root.projectDir).toBe(projectDir);

    const changes = listChanges(root, true);
    expect(changes).toHaveLength(2);

    const active = changes.find((c) => c.name === "add-theme")!;
    expect(active.nextTask).toMatchObject({ id: "1.2", text: "Next up" });
    expect(active.specIds).toContain("ui");
    expect(active.completedTasks).toBe(1);
    expect(active.totalTasks).toBe(2);

    const archived = summarizeChange(root, "archive/2026-07-01-old-feature");
    expect(archived.archived).toBe(true);
    expect(archived.archiveDate).toBe("2026-07-01");
    expect(archived.displayName).toBe("old-feature");
  });

  it("builds graph and next-up list", () => {
    const projectDir = fixtureProject();
    const root = findOpenspecRoot(projectDir);
    const changes = listChanges(root, true);
    const graph = buildSpecChangeGraph(root, changes);
    expect(graph.nodes.some((n) => n.id === "spec:ui")).toBe(true);
    expect(graph.edges.some((e) => e.specId === "ui" && e.changeName === "add-theme")).toBe(true);

    const next = listNextUp(changes);
    expect(next).toHaveLength(1);
    expect(next[0].nextTask.id).toBe("1.2");
  });

  it("searches changes and tasks", () => {
    const projectDir = fixtureProject();
    const root = findOpenspecRoot(projectDir);
    const hits = searchProject(root, "theme");
    expect(hits.some((h) => h.kind === "change" && h.changeName === "add-theme")).toBe(true);
    expect(hits.some((h) => h.kind === "proposal")).toBe(true);
  });
});
