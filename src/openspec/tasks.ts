import { readFileSync, writeFileSync } from "node:fs";

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

const TASK_RE = /^(\s*-\s+)\[([ xX])\](\s+)(.*)$/;
const ID_PREFIX_RE = /^(\d+(?:\.\d+)*)\s+(.*)$/;

export function parseTasksMarkdown(raw: string): ParsedTasks {
  const lines = raw.split(/\r?\n/);
  const sections: TaskSection[] = [];
  let current: TaskSection = { title: "Tasks", tasks: [] };
  const tasks: TaskItem[] = [];
  let autoId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current.tasks.length > 0 || current.title !== "Tasks") {
        sections.push(current);
      }
      current = { title: heading[1].trim(), tasks: [] };
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

  if (current.tasks.length > 0 || sections.length === 0) {
    sections.push(current);
  }

  const completed = tasks.filter((t) => t.done).length;
  return {
    sections: sections.filter((s) => s.tasks.length > 0 || sections.length === 1),
    tasks,
    completed,
    total: tasks.length,
    raw,
  };
}

export function readTasksFile(path: string): ParsedTasks {
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
    throw new Error(`Task no encontrada: ${taskRef}`);
  }

  const nextDone = done ?? !target.done;
  const lines = raw.split(/\r?\n/);
  const line = lines[target.line];
  const m = line.match(TASK_RE);
  if (!m) {
    throw new Error(`La línea ${target.line + 1} ya no parece un checkbox. ¿Editaste a mano a la vez?`);
  }

  const mark = nextDone ? "x" : " ";
  lines[target.line] = `${m[1]}[${mark}]${m[3]}${m[4]}`;
  const nextRaw = lines.join("\n");
  const nextParsed = parseTasksMarkdown(nextRaw);
  const task =
    nextParsed.tasks.find((t) => t.id === target!.id) ??
    nextParsed.tasks[parsed.tasks.indexOf(target)];

  return { raw: nextRaw, task: task! };
}

export function writeTasksFile(path: string, raw: string): void {
  writeFileSync(path, raw, "utf8");
}

export function toggleTaskFile(
  path: string,
  taskRef: string,
  done?: boolean,
): { parsed: ParsedTasks; task: TaskItem } {
  const current = readFileSync(path, "utf8");
  const { raw, task } = toggleTaskInMarkdown(current, taskRef, done);
  writeTasksFile(path, raw);
  return { parsed: parseTasksMarkdown(raw), task };
}
