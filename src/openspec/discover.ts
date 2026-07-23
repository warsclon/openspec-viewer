import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export type ProjectRoot = {
  projectDir: string;
  openspecDir: string;
  changesDir: string;
  specsDir: string;
  archiveDir: string;
  configPath: string | null;
};

export function findOpenspecRoot(startDir: string): ProjectRoot {
  let dir = resolve(startDir);

  while (true) {
    const openspecDir = join(dir, "openspec");
    if (existsSync(openspecDir) && statSync(openspecDir).isDirectory()) {
      const changesDir = join(openspecDir, "changes");
      return {
        projectDir: dir,
        openspecDir,
        changesDir,
        specsDir: join(openspecDir, "specs"),
        archiveDir: join(changesDir, "archive"),
        configPath: existsSync(join(openspecDir, "config.yaml"))
          ? join(openspecDir, "config.yaml")
          : null,
      };
    }

    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `No openspec/ folder found from ${resolve(startDir)}. Initialize with: openspec init`,
  );
}

export function listChangeNames(root: ProjectRoot, includeArchive = false): string[] {
  if (!existsSync(root.changesDir)) return [];

  const names = readdirSync(root.changesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "archive")
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  if (!includeArchive || !existsSync(root.archiveDir)) return names;

  const archived = readdirSync(root.archiveDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `archive/${d.name}`)
    .sort((a, b) => a.localeCompare(b));

  return [...names, ...archived];
}

export function changeDir(root: ProjectRoot, changeName: string): string {
  if (changeName.includes("..") || changeName.startsWith("/")) {
    throw new Error(`Invalid change name: ${changeName}`);
  }

  const dir = changeName.startsWith("archive/")
    ? join(root.changesDir, changeName)
    : join(root.changesDir, changeName);

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`Change not found: ${changeName}`);
  }

  return dir;
}

export function readTextIfExists(path: string): string | null {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  return readFileSync(path, "utf8");
}

export function listSpecFiles(changePath: string): { id: string; path: string }[] {
  const specsRoot = join(changePath, "specs");
  if (!existsSync(specsRoot)) return [];

  const out: { id: string; path: string }[] = [];

  for (const entry of readdirSync(specsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const specPath = join(specsRoot, entry.name, "spec.md");
    if (existsSync(specPath)) {
      out.push({ id: entry.name, path: specPath });
    }
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}
