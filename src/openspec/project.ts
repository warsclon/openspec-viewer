import { existsSync, readdirSync, statSync } from "node:fs";
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

const ARCHIVE_FOLDER_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

export type ChangeSummary = {
  name: string;
  displayName: string;
  folderName: string;
  archived: boolean;
  archiveDate: string | null;
  completedTasks: number;
  totalTasks: number;
  progress: number;
  status: "empty" | "in-progress" | "complete";
  lastModified: string | null;
  sortDate: string | null;
  hasProposal: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  specCount: number;
  specIds: string[];
};

export type ChangeDetail = ChangeSummary & {
  proposal: string | null;
  design: string | null;
  tasks: ParsedTasks | null;
  specs: { id: string; content: string }[];
};

export type MainSpecSummary = {
  id: string;
  path: string;
  lastModified: string | null;
};

export type Overview = {
  active: number;
  archived: number;
  totalTasks: number;
  completedTasks: number;
  mainSpecs: MainSpecSummary[];
  byDay: { date: string; count: number; completedTasks: number; totalTasks: number }[];
};

function latestMtime(paths: string[]): string | null {
  let best: number | null = null;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const t = statSync(p).mtimeMs;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

export function parseChangeIdentity(name: string): {
  archived: boolean;
  folderName: string;
  archiveDate: string | null;
  displayName: string;
} {
  const archived = name.startsWith("archive/");
  const folderName = archived ? name.slice("archive/".length) : name;
  const m = folderName.match(ARCHIVE_FOLDER_RE);
  if (m) {
    return {
      archived,
      folderName,
      archiveDate: m[1],
      displayName: m[2],
    };
  }
  return {
    archived,
    folderName,
    archiveDate: null,
    displayName: folderName,
  };
}

export function getProjectInfo(root: ProjectRoot) {
  return {
    projectDir: root.projectDir,
    openspecDir: root.openspecDir,
    hasConfig: Boolean(root.configPath),
    config: root.configPath ? readTextIfExists(root.configPath) : null,
  };
}

export function listMainSpecs(root: ProjectRoot): MainSpecSummary[] {
  if (!existsSync(root.specsDir)) return [];
  const out: MainSpecSummary[] = [];
  for (const entry of readdirSync(root.specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root.specsDir, entry.name, "spec.md");
    if (!existsSync(path)) continue;
    out.push({
      id: entry.name,
      path,
      lastModified: latestMtime([path]),
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function summarizeChange(root: ProjectRoot, name: string): ChangeSummary {
  const identity = parseChangeIdentity(name);
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
  if (identity.archived && status === "empty") {
    status = "complete";
  }

  const lastModified = latestMtime([
    tasksPath,
    proposalPath,
    designPath,
    ...specs.map((s) => s.path),
  ]);

  const sortDate =
    identity.archiveDate != null
      ? `${identity.archiveDate}T12:00:00.000Z`
      : lastModified;

  const progress = totalTasks === 0 ? (identity.archived ? 100 : 0) : Math.round((completedTasks / totalTasks) * 100);

  return {
    name,
    displayName: identity.displayName,
    folderName: identity.folderName,
    archived: identity.archived,
    archiveDate: identity.archiveDate,
    completedTasks,
    totalTasks,
    progress,
    status,
    lastModified,
    sortDate,
    hasProposal: existsSync(proposalPath),
    hasDesign: existsSync(designPath),
    hasTasks: existsSync(tasksPath),
    specCount: specs.length,
    specIds: specs.map((s) => s.id),
  };
}

export function listChanges(root: ProjectRoot, includeArchive = true): ChangeSummary[] {
  const items = listChangeNames(root, includeArchive).map((name) => summarizeChange(root, name));
  return items.sort((a, b) => {
    const da = a.sortDate ?? "";
    const db = b.sortDate ?? "";
    if (da !== db) return db.localeCompare(da);
    return a.displayName.localeCompare(b.displayName);
  });
}

export function getOverview(root: ProjectRoot, changes: ChangeSummary[]): Overview {
  const active = changes.filter((c) => !c.archived).length;
  const archived = changes.filter((c) => c.archived).length;
  const totalTasks = changes.reduce((n, c) => n + c.totalTasks, 0);
  const completedTasks = changes.reduce((n, c) => n + c.completedTasks, 0);

  const dayMap = new Map<string, { count: number; completedTasks: number; totalTasks: number }>();
  for (const c of changes) {
    const date = (c.archiveDate ?? c.sortDate?.slice(0, 10) ?? "unknown").slice(0, 10);
    const row = dayMap.get(date) ?? { count: 0, completedTasks: 0, totalTasks: 0 };
    row.count += 1;
    row.completedTasks += c.completedTasks;
    row.totalTasks += c.totalTasks;
    dayMap.set(date, row);
  }

  const byDay = [...dayMap.entries()]
    .filter(([d]) => d !== "unknown")
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    active,
    archived,
    totalTasks,
    completedTasks,
    mainSpecs: listMainSpecs(root),
    byDay,
  };
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

export { parseTasksMarkdown, findOpenspecRoot };
