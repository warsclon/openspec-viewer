import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  changeDir,
  findOpenspecRoot,
  listChangeNames,
  listSpecFiles,
  readTextIfExists,
  type ProjectRoot,
} from "./discover.js";
import { parseTasksMarkdown, readTasksFile, type ParsedTasks } from "./tasks.js";

export type ChangeSummary = {
  name: string;
  archived: boolean;
  completedTasks: number;
  totalTasks: number;
  status: "empty" | "in-progress" | "complete";
  lastModified: string | null;
  hasProposal: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  specCount: number;
};

export type ChangeDetail = ChangeSummary & {
  proposal: string | null;
  design: string | null;
  tasks: ParsedTasks | null;
  specs: { id: string; content: string }[];
};

function fileMtimeIso(path: string): string | null {
  if (!existsSync(path)) return null;
  return statSync(path).mtime.toISOString();
}

function latestMtime(paths: string[]): string | null {
  let best: number | null = null;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const t = statSync(p).mtimeMs;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

export function getProjectInfo(root: ProjectRoot) {
  return {
    projectDir: root.projectDir,
    openspecDir: root.openspecDir,
    hasConfig: Boolean(root.configPath),
    config: root.configPath ? readTextIfExists(root.configPath) : null,
  };
}

export function summarizeChange(root: ProjectRoot, name: string): ChangeSummary {
  const dir = changeDir(root, name);
  const tasksPath = join(dir, "tasks.md");
  const proposalPath = join(dir, "proposal.md");
  const designPath = join(dir, "design.md");
  const specs = listSpecFiles(dir);

  let completedTasks = 0;
  let totalTasks = 0;
  if (existsSync(tasksPath)) {
    const parsed = readTasksFile(tasksPath);
    completedTasks = parsed.completed;
    totalTasks = parsed.total;
  }

  let status: ChangeSummary["status"] = "empty";
  if (totalTasks > 0) {
    status = completedTasks >= totalTasks ? "complete" : "in-progress";
  }

  const lastModified = latestMtime([
    tasksPath,
    proposalPath,
    designPath,
    ...specs.map((s) => s.path),
  ]);

  return {
    name,
    archived: name.startsWith("archive/"),
    completedTasks,
    totalTasks,
    status,
    lastModified,
    hasProposal: existsSync(proposalPath),
    hasDesign: existsSync(designPath),
    hasTasks: existsSync(tasksPath),
    specCount: specs.length,
  };
}

export function listChanges(root: ProjectRoot, includeArchive = false): ChangeSummary[] {
  return listChangeNames(root, includeArchive).map((name) => summarizeChange(root, name));
}

export function getChangeDetail(root: ProjectRoot, name: string): ChangeDetail {
  const summary = summarizeChange(root, name);
  const dir = changeDir(root, name);
  const tasksPath = join(dir, "tasks.md");
  const specs = listSpecFiles(dir).map((s) => ({
    id: s.id,
    content: readTextIfExists(s.path) ?? "",
  }));

  return {
    ...summary,
    proposal: readTextIfExists(join(dir, "proposal.md")),
    design: readTextIfExists(join(dir, "design.md")),
    tasks: existsSync(tasksPath) ? readTasksFile(tasksPath) : null,
    specs,
  };
}

export function tasksPathFor(root: ProjectRoot, changeName: string): string {
  const path = join(changeDir(root, changeName), "tasks.md");
  if (!existsSync(path)) {
    throw new Error(`tasks.md no existe para ${changeName}`);
  }
  return path;
}

// re-export for convenience in tests
export { parseTasksMarkdown, findOpenspecRoot };
