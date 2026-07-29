import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findOpenspecRoot } from "../../src/openspec/discover.js";
import {
  buildHostedDemoSnapshot,
  type HostedSearchDocument,
} from "../../src/openspec/hosted-demo.js";
import { searchProject } from "../../src/openspec/search.js";
import { hostedSearch } from "../../src/ui/hosted-search.js";
import {
  createTestProject,
  type TestProject,
} from "../helpers/fixture.js";

type HostedSearchHit = {
  id: string;
};

let project: TestProject;
let documents: HostedSearchDocument[];

beforeAll(() => {
  project = createTestProject();
  const root = findOpenspecRoot(project.projectDir);
  documents = buildHostedDemoSnapshot(root).searchDocuments;
});

afterAll(() => {
  project.cleanup();
});

describe("hosted search parity", () => {
  it.each([
    "add-dark-mode",
    "browser state",
    "theme selector",
    "interface",
  ])("matches local search result ordering for %s", (query) => {
    const root = findOpenspecRoot(project.projectDir);
    const localIds = searchProject(root, query).map((hit) => hit.id);
    const hostedIds = (
      hostedSearch(documents, query) as HostedSearchHit[]
    ).map((hit) => hit.id);

    expect(hostedIds).toEqual(localIds);
  });
});
