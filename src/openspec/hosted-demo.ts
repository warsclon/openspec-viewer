import {
  changeDir,
  listSpecFiles,
  readTextIfExists,
  type ProjectRoot,
} from "./discover.js";
import {
  buildSpecChangeGraph,
  getChangeDetail,
  getOverview,
  listChanges,
  listMainSpecs,
  listNextUp,
  type Overview,
} from "./project.js";
import type { SearchHitKind } from "./search.js";

export type HostedSearchDocument = {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string;
  changeName?: string;
  specId?: string;
  taskId?: string;
  text: string;
  weight: number;
};

function publicOverview(value: Overview): Overview {
  return {
    ...value,
    mainSpecs: value.mainSpecs.map(({ id, lastModified }) => ({
      id,
      path: `openspec/specs/${id}/spec.md`,
      lastModified,
    })),
  };
}

export function buildHostedDemoSnapshot(root: ProjectRoot) {
  const changes = listChanges(root, true);
  const overview = getOverview(root, changes);
  const details = Object.fromEntries(
    changes.map((change) => [
      change.name,
      {
        ...getChangeDetail(root, change.name),
        notes: "",
      },
    ]),
  );
  const searchDocuments: HostedSearchDocument[] = [];

  for (const change of changes) {
    const detail = details[change.name];
    searchDocuments.push({
      kind: "change",
      id: `change:${change.name}`,
      title: change.displayName,
      subtitle: change.archived
        ? `archived · ${change.completedTasks}/${change.totalTasks}`
        : `${change.status} · ${change.completedTasks}/${change.totalTasks}`,
      changeName: change.name,
      text: `${change.name} ${change.folderName} ${change.displayName}`,
      weight: 1.2,
    });

    for (const kind of ["proposal", "design"] as const) {
      const content = detail[kind];
      if (!content) continue;
      searchDocuments.push({
        kind,
        id: `${kind}:${change.name}`,
        title: `${kind} · ${change.displayName}`,
        subtitle: change.archived ? "archived" : change.status,
        changeName: change.name,
        text: content,
        weight: 0.7,
      });
    }

    for (const section of detail.tasks?.sections ?? []) {
      for (const task of section.tasks) {
        searchDocuments.push({
          kind: "task",
          id: `task:${change.name}:${task.id}`,
          title: `${task.id} ${task.text}`,
          subtitle: `${change.displayName}${task.done ? " · done" : ""}`,
          changeName: change.name,
          taskId: task.id,
          text: `${task.id} ${task.text}`,
          weight: 1,
        });
      }
    }

    for (const spec of listSpecFiles(changeDir(root, change.name))) {
      searchDocuments.push({
        kind: "spec-delta",
        id: `spec-delta:${change.name}:${spec.id}`,
        title: spec.id,
        subtitle: `delta · ${change.displayName}`,
        changeName: change.name,
        specId: spec.id,
        text: `${spec.id} ${readTextIfExists(spec.path) ?? ""}`,
        weight: 1.1,
      });
    }
  }

  for (const spec of listMainSpecs(root)) {
    searchDocuments.push({
      kind: "spec-main",
      id: `spec-main:${spec.id}`,
      title: spec.id,
      subtitle: "spec main",
      specId: spec.id,
      text: `${spec.id} ${readTextIfExists(spec.path) ?? ""}`,
      weight: 1.2,
    });
  }

  return {
    version: 1,
    project: {
      mode: "hosted-demo",
      label: "Fictional demo project",
      hasConfig: Boolean(root.configPath),
      config: root.configPath ? readTextIfExists(root.configPath) : null,
      capabilities: {
        readOnly: true,
      },
    },
    changes: {
      changes,
      overview: publicOverview(overview),
      nextUp: listNextUp(changes),
      graph: buildSpecChangeGraph(root, changes),
    },
    details,
    searchDocuments,
  };
}
