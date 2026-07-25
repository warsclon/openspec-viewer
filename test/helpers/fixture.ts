import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "representative-openspec",
);

export type TestProject = {
  projectDir: string;
  cleanup: () => void;
};

export function createTestProject(): TestProject {
  const tempRoot = mkdtempSync(join(tmpdir(), "openspec-viewer-test-"));
  const projectDir = join(tempRoot, "project");
  cpSync(FIXTURE_ROOT, projectDir, { recursive: true });

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
