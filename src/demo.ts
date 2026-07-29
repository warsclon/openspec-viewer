import {
  cpSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEMO_CONTENT_TIMESTAMP = new Date("2026-07-15T12:00:00.000Z");

export type TemporaryDemoProject = {
  projectDir: string;
  cleanup: () => void;
};

function normalizeTimestamps(path: string): void {
  if (lstatSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      normalizeTimestamps(join(path, entry));
    }
  }
  utimesSync(path, DEMO_CONTENT_TIMESTAMP, DEMO_CONTENT_TIMESTAMP);
}

export function createTemporaryDemoProject(
  prefix = "openspec-viewer-demo-",
): TemporaryDemoProject {
  const fixtureDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "demo",
    "representative-openspec",
  );
  const tempRoot = mkdtempSync(join(tmpdir(), prefix));
  const projectDir = join(tempRoot, "project");
  try {
    cpSync(fixtureDir, projectDir, { recursive: true });
    normalizeTimestamps(projectDir);
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }

  let cleaned = false;
  return {
    projectDir,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}
