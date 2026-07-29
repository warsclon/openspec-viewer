import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

type HostedSnapshot = {
  version: number;
  project: {
    mode: string;
    label: string;
    capabilities: {
      readOnly: boolean;
    };
  };
  changes: {
    changes: Array<{ name: string; archived: boolean; lastModified: string }>;
    overview: {
      active: number;
      archived: number;
      mainSpecs: Array<{ id: string; lastModified: string }>;
    };
    graph: {
      nodes: Array<{ id: string }>;
    };
  };
  details: Record<string, { name: string }>;
  searchDocuments: Array<{
    kind: string;
    id: string;
    title: string;
    text: string;
  }>;
};

const outputDir = join(process.cwd(), "dist", "hosted-demo");
let snapshot: HostedSnapshot;
let snapshotSource = "";

beforeAll(() => {
  execFileSync("npm", ["run", "build:hosted-demo"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  snapshotSource = readFileSync(join(outputDir, "snapshot.json"), "utf8");
  snapshot = JSON.parse(snapshotSource) as HostedSnapshot;
});

describe("hosted demo build", () => {
  it("creates a base-path-safe static UI and runtime configuration", () => {
    for (const file of [
      "index.html",
      "app.js",
      "styles.css",
      "runtime-config.js",
      "snapshot.json",
    ]) {
      expect(existsSync(join(outputDir, file)), file).toBe(true);
    }

    const html = readFileSync(join(outputDir, "index.html"), "utf8");
    expect(html).toContain('href="./styles.css"');
    expect(html).toContain('src="./runtime-config.js"');
    expect(html).toContain('src="./app.js"');
    expect(html).not.toMatch(/(?:href|src)="\/(?:app|styles|runtime)/);

    const runtime = readFileSync(
      join(outputDir, "runtime-config.js"),
      "utf8",
    );
    expect(runtime).toContain('"hosted-demo"');
    expect(runtime).toContain('"./snapshot.json"');
  });

  it("serializes the representative read contracts without machine paths", () => {
    expect(snapshot).toMatchObject({
      version: 1,
      project: {
        mode: "hosted-demo",
        label: "Fictional demo project",
        capabilities: {
          readOnly: true,
        },
      },
      changes: {
        overview: {
          active: 2,
          archived: 1,
        },
        changes: expect.arrayContaining([
          expect.objectContaining({ name: "add-dark-mode" }),
          expect.objectContaining({
            name: "archive/2026-07-01-legacy-search",
          }),
        ]),
        graph: {
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: "spec:interface" }),
          ]),
        },
      },
      details: {
        "add-dark-mode": expect.objectContaining({
          name: "add-dark-mode",
        }),
      },
      searchDocuments: expect.arrayContaining([
        expect.objectContaining({
          kind: "design",
          id: "design:add-dark-mode",
          title: "design · add-dark-mode",
        }),
      ]),
    });

    expect(snapshotSource).not.toContain(process.cwd());
    expect(snapshotSource).not.toMatch(
      /\/Users\/|\/home\/|[A-Za-z]:\\\\Users\\\\/,
    );

    expect(
      snapshot.changes.changes
        .filter((change) => !change.archived)
        .map((change) => change.lastModified),
    ).toEqual([
      "2026-07-15T12:00:00.000Z",
      "2026-07-15T12:00:00.000Z",
    ]);
    expect(
      snapshot.changes.overview.mainSpecs.map((spec) => spec.lastModified),
    ).toEqual(["2026-07-15T12:00:00.000Z"]);
  });
});
