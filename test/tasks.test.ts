import { describe, expect, it } from "vitest";
import {
  mutateTasks,
  parseTasksMarkdown,
  serializeTasksMarkdown,
  toggleTaskInMarkdown,
} from "../src/openspec/tasks.js";

const SAMPLE = `## 1. Setup

- [ ] 1.1 Init project
- [x] 1.2 Add config

## 2. Build

- [ ] 2.1 Implement feature
`;

describe("parseTasksMarkdown", () => {
  it("parses sections, ids, and checkbox state", () => {
    const parsed = parseTasksMarkdown(SAMPLE);
    expect(parsed.total).toBe(3);
    expect(parsed.completed).toBe(1);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.tasks[0]).toMatchObject({ id: "1.1", done: false, text: "Init project" });
    expect(parsed.tasks[1]).toMatchObject({ id: "1.2", done: true });
    expect(parsed.sections[1].title).toBe("2. Build");
  });
});

describe("serializeTasksMarkdown", () => {
  it("round-trips a clean tasks file", () => {
    const parsed = parseTasksMarkdown(SAMPLE);
    const sections = parsed.sections.map((s) => ({
      title: s.title,
      tasks: s.tasks.map((t) => ({ id: t.id, text: t.text, done: t.done })),
    }));
    const raw = serializeTasksMarkdown(sections);
    const again = parseTasksMarkdown(raw);
    expect(again.total).toBe(3);
    expect(again.completed).toBe(1);
    expect(again.tasks.map((t) => t.id)).toEqual(["1.1", "1.2", "2.1"]);
    expect(raw).toContain("- [x] 1.2 Add config");
  });
});

describe("toggleTaskInMarkdown", () => {
  it("toggles by id", () => {
    const { raw, task } = toggleTaskInMarkdown(SAMPLE, "1.1", true);
    expect(task.done).toBe(true);
    expect(raw).toContain("- [x] 1.1 Init project");
  });
});

describe("mutateTasks", () => {
  it("adds, moves, and deletes tasks", () => {
    let sections = [
      {
        title: "1. A",
        tasks: [{ id: "1.1", text: "one", done: false }],
      },
    ];
    sections = mutateTasks(sections, { type: "add", sectionIndex: 0, text: "two" });
    expect(sections[0].tasks).toHaveLength(2);
    expect(sections[0].tasks[1].id).toBe("1.2");

    sections = mutateTasks(sections, { type: "move", taskId: "1.2", direction: "up" });
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["1.2", "1.1"]);

    sections = mutateTasks(sections, { type: "delete", taskId: "1.1" });
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["1.2"]);
  });

  it("manages sections", () => {
    let sections = mutateTasks([], { type: "add-section", title: "Phase 1" });
    sections = mutateTasks(sections, { type: "add", sectionIndex: 0, text: "do thing" });
    sections = mutateTasks(sections, {
      type: "rename-section",
      sectionIndex: 0,
      title: "1. Phase",
    });
    expect(sections[0].title).toBe("1. Phase");
    expect(sections[0].tasks[0].text).toBe("do thing");
  });
});
