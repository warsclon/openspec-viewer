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

  it("ignores malformed headings and assigns ids to unnumbered tasks", () => {
    const parsed = parseTasksMarkdown(`##\n
### 2. Valid section

- [ ] Task without an id
- [?] Not a supported checkbox
`);

    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].title).toBe("2. Valid section");
    expect(parsed.tasks).toEqual([
      expect.objectContaining({
        id: "task-1",
        text: "Task without an id",
        done: false,
      }),
    ]);
  });

  it("preserves duplicate explicit ids for callers to diagnose", () => {
    const parsed = parseTasksMarkdown(`## 1. Work

- [ ] 1.1 First task
- [x] 1.1 Duplicate task
`);

    expect(parsed.tasks.map((task) => task.id)).toEqual(["1.1", "1.1"]);
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

  it("round-trips an explicitly empty section", () => {
    const raw = serializeTasksMarkdown([
      {
        title: "1. Work",
        tasks: [{ id: "1.1", text: "Implement", done: false }],
      },
      {
        title: "2. Follow-up",
        tasks: [],
      },
    ]);

    expect(parseTasksMarkdown(raw).sections).toEqual([
      expect.objectContaining({ title: "1. Work" }),
      { title: "2. Follow-up", tasks: [] },
    ]);
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

  it("honors explicit completion and leaves boundary moves unchanged", () => {
    const sections = [
      {
        title: "1. Work",
        tasks: [
          { id: "1.1", text: "first", done: false },
          { id: "1.2", text: "second", done: true },
        ],
      },
    ];

    const completed = mutateTasks(sections, {
      type: "update",
      taskId: "1.1",
      done: true,
    });
    expect(completed[0].tasks[0].done).toBe(true);
    const unchangedTop = mutateTasks(completed, {
      type: "move",
      taskId: "1.1",
      direction: "up",
    });
    const unchangedBottom = mutateTasks(unchangedTop, {
      type: "move",
      taskId: "1.2",
      direction: "down",
    });
    expect(unchangedBottom[0].tasks.map((task) => task.id)).toEqual(["1.1", "1.2"]);
  });

  it("validates section and task operations", () => {
    const sections = [
      {
        title: "1. Work",
        tasks: [{ id: "1.1", text: "first", done: false }],
      },
    ];

    expect(() =>
      mutateTasks(sections, { type: "add", sectionIndex: 2, text: "missing" }),
    ).toThrow("Section not found");
    expect(() =>
      mutateTasks(sections, { type: "delete", taskId: "9.9" }),
    ).toThrow("Task not found: 9.9");

    const renamed = mutateTasks(sections, {
      type: "rename-section",
      sectionIndex: 0,
      title: "1. Renamed",
    });
    expect(renamed[0].title).toBe("1. Renamed");
    expect(
      mutateTasks(renamed, { type: "delete-section", sectionIndex: 0 }),
    ).toEqual([{ title: "Tasks", tasks: [] }]);
  });
});
