import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findOpenspecRoot,
  listSpecFiles,
  readTextIfExists,
} from "../dist/openspec/discover.js";
import {
  buildSpecChangeGraph,
  getChangeDetail,
  getOverview,
  listChanges,
  listMainSpecs,
  listNextUp,
} from "../dist/openspec/project.js";
import { createTemporaryDemoProject } from "../dist/demo.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(repositoryRoot, "dist", "hosted-demo");
const demoProject = createTemporaryDemoProject(
  "openspec-viewer-hosted-demo-",
);

try {
const root = findOpenspecRoot(demoProject.projectDir);
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

function publicOverview(value) {
  return {
    ...value,
    mainSpecs: value.mainSpecs.map(({ id, lastModified }) => ({
      id,
      path: `openspec/specs/${id}/spec.md`,
      lastModified,
    })),
  };
}

function searchDocuments() {
  const documents = [];

  for (const change of changes) {
    const detail = details[change.name];
    documents.push({
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

    for (const kind of ["proposal", "design"]) {
      const content = detail[kind];
      if (!content) continue;
      documents.push({
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
        documents.push({
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

    const changePath = change.name.startsWith("archive/")
      ? join(root.changesDir, change.name)
      : join(root.changesDir, change.name);
    for (const spec of listSpecFiles(changePath)) {
      documents.push({
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
    documents.push({
      kind: "spec-main",
      id: `spec-main:${spec.id}`,
      title: spec.id,
      subtitle: "spec main",
      specId: spec.id,
      text: `${spec.id} ${readFileSync(spec.path, "utf8")}`,
      weight: 1.2,
    });
  }

  return documents;
}

const snapshot = {
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
  searchDocuments: searchDocuments(),
};

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(join(repositoryRoot, "dist", "ui"), outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "runtime-config.js"),
  `globalThis.__OPENSPEC_VIEWER_RUNTIME__ = Object.freeze(${JSON.stringify({
    mode: "hosted-demo",
    snapshotUrl: "./snapshot.json",
  })});\n`,
  "utf8",
);
writeFileSync(
  join(outputDir, "snapshot.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
  "utf8",
);

console.log("Built hosted demo → dist/hosted-demo");
} finally {
  demoProject.cleanup();
}
