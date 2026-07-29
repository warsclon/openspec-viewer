import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  searchDocuments,
  type SearchDocument,
  type SearchHit,
  type SearchHitKind,
} from "../shared/search-contract.js";
import {
  changeDir,
  listSpecFiles,
  readTextIfExists,
  type ProjectRoot,
} from "./discover.js";
import { listChanges, listMainSpecs, type ChangeSummary } from "./project.js";
import { readTasksFile } from "./tasks.js";

export type { SearchHit, SearchHitKind } from "../shared/search-contract.js";

export function buildSearchDocuments(
  root: ProjectRoot,
  includeArchive = true,
): SearchDocument[] {
  const changes = listChanges(root, includeArchive);
  const documents: SearchDocument[] = [];

  for (const change of changes) {
    documents.push({
      kind: "change",
      id: `change:${change.name}`,
      title: change.displayName,
      subtitle: change.archived
        ? `archived · ${change.completedTasks}/${change.totalTasks}`
        : `${change.status} · ${change.completedTasks}/${change.totalTasks}`,
      changeName: change.name,
      fields: [
        { text: change.displayName, weight: 1.2 },
        { text: change.folderName, weight: 1 },
        { text: change.name, weight: 0.8 },
      ],
    });

    const dir = changeDir(root, change.name);
    pushDocument(
      documents,
      change,
      "proposal",
      join(dir, "proposal.md"),
    );
    pushDocument(documents, change, "design", join(dir, "design.md"));

    const tasksPath = join(dir, "tasks.md");
    if (existsSync(tasksPath)) {
      const parsed = readTasksFile(tasksPath);
      for (const task of parsed.tasks) {
        documents.push({
          kind: "task",
          id: `task:${change.name}:${task.id}`,
          title: `${task.id} ${task.text}`,
          subtitle: `${change.displayName}${task.done ? " · done" : ""}`,
          changeName: change.name,
          taskId: task.id,
          fields: [{ text: `${task.id} ${task.text}`, weight: 1 }],
          snippetText: task.text,
        });
      }
    }

    for (const spec of listSpecFiles(dir)) {
      const content = readTextIfExists(spec.path) ?? "";
      documents.push({
        kind: "spec-delta",
        id: `spec-delta:${change.name}:${spec.id}`,
        title: spec.id,
        subtitle: `delta · ${change.displayName}`,
        changeName: change.name,
        specId: spec.id,
        fields: [
          { text: spec.id, weight: 1.1 },
          { text: content, weight: 0.5 },
        ],
        scoreMode: "max",
        snippetText: content,
      });
    }
  }

  for (const spec of listMainSpecs(root)) {
    const content = readTextIfExists(spec.path) ?? "";
    documents.push({
      kind: "spec-main",
      id: `spec-main:${spec.id}`,
      title: spec.id,
      subtitle: "spec main",
      specId: spec.id,
      fields: [
        { text: spec.id, weight: 1.2 },
        { text: content, weight: 0.55 },
      ],
      scoreMode: "max",
      snippetText: content,
    });
  }

  return documents;
}

export function searchProject(
  root: ProjectRoot,
  query: string,
  opts?: { includeArchive?: boolean; limit?: number },
): SearchHit[] {
  return searchDocuments(
    buildSearchDocuments(root, opts?.includeArchive ?? true),
    query,
    opts?.limit,
  );
}

function pushDocument(
  documents: SearchDocument[],
  change: ChangeSummary,
  kind: Extract<SearchHitKind, "proposal" | "design">,
  path: string,
): void {
  if (!existsSync(path)) return;
  const content = readTextIfExists(path) ?? "";
  documents.push({
    kind,
    id: `${kind}:${change.name}`,
    title: `${kind} · ${change.displayName}`,
    subtitle: change.archived ? "archived" : change.status,
    changeName: change.name,
    fields: [{ text: content, weight: 0.7 }],
    snippetText: content,
  });
}
