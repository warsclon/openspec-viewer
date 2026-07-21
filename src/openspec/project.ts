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
import { getChangeSpecDiffs, type SpecDiff } from "./spec-diff.js";

const ARCHIVE_FOLDER_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

export type NextTask = {
  id: string;
  text: string;
  section: string | null;
};

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
  nextTask: NextTask | null;
};

export type ChangeDetail = ChangeSummary & {
  proposal: string | null;
  design: string | null;
  tasks: ParsedTasks | null;
  specs: { id: string; content: string }[];
  specDiffs: SpecDiff[];
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

export type GraphNode = {
  id: string;
  kind: "spec" | "change";
  label: string;
  archived?: boolean;
  status?: ChangeSummary["status"];
  main?: boolean;
  degree: number;
  progress?: number;
  completedTasks?: number;
  totalTasks?: number;
};

export type GraphEdge = {
  id: string;
  from: string; // change node id
  to: string; // spec node id
  changeName: string;
  specId: string;
};

export type SpecChangeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type NextUpItem = {
  change: ChangeSummary;
  nextTask: NextTask;
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
  let nextTask: NextTask | null = null;
  if (existsSync(tasksPath)) {
    const parsed = readTasksFile(tasksPath);
    completedTasks = parsed.completed;
    totalTasks = parsed.total;
    for (const section of parsed.sections) {
      const hit = section.tasks.find((t) => !t.done);
      if (hit) {
        nextTask = {
          id: hit.id,
          text: hit.text,
          section: section.title === "Tasks" ? null : section.title,
        };
        break;
      }
    }
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
    nextTask,
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
    specDiffs: getChangeSpecDiffs(root, name),
  };
}

export function tasksPathFor(root: ProjectRoot, changeName: string): string {
  const path = join(changeDir(root, changeName), "tasks.md");
  if (!existsSync(path)) {
    throw new Error(`tasks.md no existe para ${changeName}`);
  }
  return path;
}

export function buildSpecChangeGraph(
  root: ProjectRoot,
  changes: ChangeSummary[],
): SpecChangeGraph {
  const mainSpecs = listMainSpecs(root);
  const mainIds = new Set(mainSpecs.map((s) => s.id));
  const deltaSpecIds = new Set<string>();
  for (const c of changes) {
    for (const id of c.specIds) deltaSpecIds.add(id);
  }

  const allSpecIds = [...new Set([...mainIds, ...deltaSpecIds])].sort((a, b) =>
    a.localeCompare(b),
  );

  const edges: GraphEdge[] = [];
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

  for (const c of changes) {
    const changeNodeId = `change:${c.name}`;
    for (const specId of c.specIds) {
      const specNodeId = `spec:${specId}`;
      edges.push({
        id: `${c.name}→${specId}`,
        from: changeNodeId,
        to: specNodeId,
        changeName: c.name,
        specId,
      });
      bump(changeNodeId);
      bump(specNodeId);
    }
  }

  const nodes: GraphNode[] = [
    ...allSpecIds.map((id) => ({
      id: `spec:${id}`,
      kind: "spec" as const,
      label: id,
      main: mainIds.has(id),
      degree: degree.get(`spec:${id}`) ?? 0,
    })),
    ...changes.map((c) => ({
      id: `change:${c.name}`,
      kind: "change" as const,
      label: c.displayName,
      archived: c.archived,
      status: c.status,
      degree: degree.get(`change:${c.name}`) ?? 0,
      progress: c.progress,
      completedTasks: c.completedTasks,
      totalTasks: c.totalTasks,
    })),
  ];

  return { nodes, edges };
}

export function listNextUp(changes: ChangeSummary[]): NextUpItem[] {
  return changes
    .filter((c) => !c.archived && c.nextTask)
    .map((c) => ({ change: c, nextTask: c.nextTask! }))
    .sort((a, b) => {
      const pa = a.change.progress;
      const pb = b.change.progress;
      if (pa !== pb) return pb - pa; // más avanzados primero (momentum)
      return a.change.displayName.localeCompare(b.change.displayName);
    });
}

export { parseTasksMarkdown, findOpenspecRoot };
