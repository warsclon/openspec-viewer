import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
  line: number;
  raw: string;
};

export type TaskSection = {
  title: string;
  tasks: TaskItem[];
};

export type ParsedTasks = {
  sections: TaskSection[];
  tasks: TaskItem[];
  completed: number;
  total: number;
  raw: string;
};

export type TaskDraft = {
  id: string;
  text: string;
  done: boolean;
};

export type SectionDraft = {
  title: string;
  tasks: TaskDraft[];
};

const TASK_RE = /^(\s*-\s+)\[([ xX])\](\s+)(.*)$/;
const ID_PREFIX_RE = /^(\d+(?:\.\d+)*)\s+(.*)$/;

export function parseTasksMarkdown(raw: string): ParsedTasks {
  const lines = raw.split(/\r?\n/);
  const sections: TaskSection[] = [];
  let current: TaskSection = { title: "Tasks", tasks: [] };
  const tasks: TaskItem[] = [];
  let autoId = 0;
  let sawHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current.tasks.length > 0 || sawHeading || current.title !== "Tasks") {
        sections.push(current);
      }
      current = { title: heading[1].trim(), tasks: [] };
      sawHeading = true;
      continue;
    }

    const m = line.match(TASK_RE);
    if (!m) continue;

    const body = m[4].trim();
    const idMatch = body.match(ID_PREFIX_RE);
    const id = idMatch ? idMatch[1] : `task-${++autoId}`;
    const text = idMatch ? idMatch[2] : body;
    const item: TaskItem = {
      id,
      text,
      done: m[2].toLowerCase() === "x",
      line: i,
      raw: line,
    };
    current.tasks.push(item);
    tasks.push(item);
  }

  if (current.tasks.length > 0 || sawHeading || sections.length === 0) {
    sections.push(current);
  }

  const completed = tasks.filter((t) => t.done).length;
  return {
    sections,
    tasks,
    completed,
    total: tasks.length,
    raw,
  };
}

export function serializeTasksMarkdown(sections: SectionDraft[]): string {
  const blocks: string[] = [];
  for (const section of sections) {
    const title = section.title?.trim() || "Tasks";
    blocks.push(`## ${title}`, "");
    for (const task of section.tasks) {
      const mark = task.done ? "x" : " ";
      const id = task.id?.trim();
      const text = (task.text ?? "").trim();
      const body = id ? `${id} ${text}`.trim() : text;
      blocks.push(`- [${mark}] ${body}`);
    }
    blocks.push("");
  }
  return `${blocks.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function sectionsFromParsed(parsed: ParsedTasks): SectionDraft[] {
  return parsed.sections.map((s) => ({
    title: s.title,
    tasks: s.tasks.map((t) => ({ id: t.id, text: t.text, done: t.done })),
  }));
}

export function readTasksFile(path: string): ParsedTasks {
  if (!existsSync(path)) {
    return parseTasksMarkdown("");
  }
  const raw = readFileSync(path, "utf8");
  return parseTasksMarkdown(raw);
}

/** Toggle a task by id (e.g. "1.2") or 0-based index string ("#3"). */
export function toggleTaskInMarkdown(
  raw: string,
  taskRef: string,
  done?: boolean,
): { raw: string; task: TaskItem } {
  const parsed = parseTasksMarkdown(raw);
  let target: TaskItem | undefined;

  if (taskRef.startsWith("#")) {
    const idx = Number(taskRef.slice(1));
    target = parsed.tasks[idx];
  } else {
    target = parsed.tasks.find((t) => t.id === taskRef);
  }

  if (!target) {
    throw new Error(`Task not found: ${taskRef}`);
  }

  const drafts = sectionsFromParsed(parsed);
  outer: for (const section of drafts) {
    for (const task of section.tasks) {
      if (task.id === target.id) {
        task.done = done ?? !task.done;
        break outer;
      }
    }
  }
  const nextRaw = serializeTasksMarkdown(drafts);
  const nextParsed = parseTasksMarkdown(nextRaw);
  const task = nextParsed.tasks.find((t) => t.id === target!.id)!;
  return { raw: nextRaw, task };
}

export function writeTasksFile(path: string, raw: string): void {
  writeFileSync(path, raw, "utf8");
}

export function toggleTaskFile(
  path: string,
  taskRef: string,
  done?: boolean,
): { parsed: ParsedTasks; task: TaskItem } {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const { raw, task } = toggleTaskInMarkdown(current, taskRef, done);
  writeTasksFile(path, raw);
  return { parsed: parseTasksMarkdown(raw), task };
}

export function writeTasksSections(path: string, sections: SectionDraft[]): ParsedTasks {
  const raw = serializeTasksMarkdown(sections);
  writeTasksFile(path, raw);
  return parseTasksMarkdown(raw);
}

export function nextTaskId(sections: SectionDraft[], sectionIndex: number): string {
  const section = sections[sectionIndex];
  if (!section) return "1.1";
  const nums = section.tasks
    .map((t) => t.id.match(/^(\d+)(?:\.(\d+))?$/))
    .filter(Boolean) as RegExpMatchArray[];
  if (nums.length) {
    const major = Number(nums[0][1]);
    const minors = nums.map((m) => Number(m[2] || "0"));
    const nextMinor = Math.max(...minors, 0) + 1;
    return `${major}.${nextMinor}`;
  }
  // derive major from section title "1. Foo" or index
  const fromTitle = section.title.match(/^(\d+)/);
  const major = fromTitle ? Number(fromTitle[1]) : sectionIndex + 1;
  return `${major}.1`;
}

export function mutateTasks(
  sections: SectionDraft[],
  action:
    | { type: "add"; sectionIndex: number; text: string; id?: string }
    | { type: "update"; taskId: string; text?: string; done?: boolean }
    | { type: "delete"; taskId: string }
    | { type: "move"; taskId: string; direction: "up" | "down" }
    | { type: "add-section"; title: string }
    | { type: "rename-section"; sectionIndex: number; title: string }
    | { type: "delete-section"; sectionIndex: number }
    | { type: "replace"; sections: SectionDraft[] },
): SectionDraft[] {
  const next: SectionDraft[] = sections.map((s) => ({
    title: s.title,
    tasks: s.tasks.map((t) => ({ ...t })),
  }));

  if (action.type === "replace") {
    return action.sections.map((s) => ({
      title: s.title,
      tasks: s.tasks.map((t) => ({ id: t.id, text: t.text, done: Boolean(t.done) })),
    }));
  }

  if (action.type === "add-section") {
    next.push({ title: action.title.trim() || `Section ${next.length + 1}`, tasks: [] });
    return next;
  }

  if (action.type === "rename-section") {
    if (!next[action.sectionIndex]) throw new Error("Section not found");
    next[action.sectionIndex].title = action.title.trim() || next[action.sectionIndex].title;
    return next;
  }

  if (action.type === "delete-section") {
    if (!next[action.sectionIndex]) throw new Error("Section not found");
    next.splice(action.sectionIndex, 1);
    return next.length ? next : [{ title: "Tasks", tasks: [] }];
  }

  if (action.type === "add") {
    if (!next[action.sectionIndex]) throw new Error("Section not found");
    const id = action.id?.trim() || nextTaskId(next, action.sectionIndex);
    next[action.sectionIndex].tasks.push({
      id,
      text: action.text.trim(),
      done: false,
    });
    return next;
  }

  const locate = (taskId: string) => {
    for (let si = 0; si < next.length; si++) {
      const ti = next[si].tasks.findIndex((t) => t.id === taskId);
      if (ti >= 0) return { si, ti };
    }
    throw new Error(`Task not found: ${taskId}`);
  };

  if (action.type === "update") {
    const { si, ti } = locate(action.taskId);
    if (action.text !== undefined) next[si].tasks[ti].text = action.text;
    if (action.done !== undefined) next[si].tasks[ti].done = action.done;
    return next;
  }

  if (action.type === "delete") {
    const { si, ti } = locate(action.taskId);
    next[si].tasks.splice(ti, 1);
    return next;
  }

  if (action.type === "move") {
    const { si, ti } = locate(action.taskId);
    const target = action.direction === "up" ? ti - 1 : ti + 1;
    if (target < 0 || target >= next[si].tasks.length) return next;
    const [item] = next[si].tasks.splice(ti, 1);
    next[si].tasks.splice(target, 0, item);
    return next;
  }

  return next;
}
