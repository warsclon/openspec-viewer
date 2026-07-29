import {
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTemporaryDemoProject } from "../dist/demo.js";
import { findOpenspecRoot } from "../dist/openspec/discover.js";
import { buildHostedDemoSnapshot } from "../dist/openspec/hosted-demo.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(repositoryRoot, "dist", "hosted-demo");
const demoProject = createTemporaryDemoProject(
  "openspec-viewer-hosted-demo-",
);

try {
  const root = findOpenspecRoot(demoProject.projectDir);
  const snapshot = buildHostedDemoSnapshot(root);

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
