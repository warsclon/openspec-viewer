import type { SearchDocument } from "../shared/search-contract.js";
import { readTextIfExists, type ProjectRoot } from "./discover.js";
import {
  buildSpecChangeGraph,
  getChangeDetail,
  getOverview,
  listChanges,
  listNextUp,
  type Overview,
} from "./project.js";
import { buildSearchDocuments } from "./search.js";

export type HostedSearchDocument = SearchDocument;

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
  const searchDocuments = buildSearchDocuments(root, true);

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
