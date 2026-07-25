import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import type { ProjectRoot } from "./discover.js";

export type CopyWorkspace = (source: string, destination: string) => void;
export type ScaffoldWriter = (stagingPath: string, changeName: string) => void;
export type WorkspaceRemover = (workspaceRoot: string) => void;

export type ChangePublishOptions = {
  platform?: NodeJS.Platform;
  renameDirectory?: (source: string, destination: string) => void;
};

export type PublicationResult = {
  cleanupWarning?: string;
};

type TreeEntry =
  | { kind: "directory"; mode: number }
  | { kind: "file"; digest: string; mode: number };

export type TreeSnapshot = {
  entries: ReadonlyMap<string, TreeEntry>;
  fingerprint: string;
};

type EntryIdentity = { dev: number; ino: number };

export type ChangesDirectoryGuard = {
  changesIdentity?: EntryIdentity;
  openspecIdentity: EntryIdentity;
};

function symbolicLinkError(relativePath: string): Error {
  return new Error(
    `Symbolic links are not supported in OpenSpec lifecycle operations${
      relativePath ? `: ${relativePath}` : ""
    }`,
  );
}

function copyTreeWithoutSymlinks(
  source: string,
  destination: string,
  relativePath = "",
): void {
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) throw symbolicLinkError(relativePath);

  if (stat.isDirectory()) {
    mkdirSync(destination, { mode: 0o700 });
    for (const entry of readdirSync(source).sort((a, b) =>
      a.localeCompare(b),
    )) {
      copyTreeWithoutSymlinks(
        join(source, entry),
        join(destination, entry),
        relativePath ? `${relativePath}/${entry}` : entry,
      );
    }
    chmodSync(destination, stat.mode & 0o777);
    return;
  }

  if (stat.isFile()) {
    copyFileSync(source, destination);
    chmodSync(destination, stat.mode & 0o777);
    return;
  }

  throw new Error(
    `Unsupported filesystem entry in OpenSpec lifecycle operation${
      relativePath ? `: ${relativePath}` : ""
    }`,
  );
}

export const defaultCopyWorkspace: CopyWorkspace = (source, destination) => {
  copyTreeWithoutSymlinks(source, destination);
};

export const defaultScaffoldWriter: ScaffoldWriter = (
  stagingPath,
  changeName,
) => {
  mkdirSync(join(stagingPath, "specs"), { recursive: true });
  writeFileSync(
    join(stagingPath, ".openspec.yaml"),
    "schema: spec-driven\n",
    "utf8",
  );
  writeFileSync(
    join(stagingPath, "proposal.md"),
    `# Proposal: ${changeName}\n\n## Why\n\n## What Changes\n\n## Non-goals\n`,
    "utf8",
  );
  writeFileSync(
    join(stagingPath, "design.md"),
    `# Design: ${changeName}\n\n## Approach\n`,
    "utf8",
  );
  writeFileSync(
    join(stagingPath, "tasks.md"),
    "## 1. Implementation\n\n- [ ] 1.1 First task\n",
    "utf8",
  );
};

export type LifecycleWorkspace = {
  projectDir: string;
  openspecDir: string;
  sourceSnapshot: TreeSnapshot;
  cleanup: () => string | undefined;
};

export function createLifecycleWorkspace(
  root: ProjectRoot,
  prefix: string,
  copyWorkspace: CopyWorkspace,
  removeWorkspace: WorkspaceRemover = (workspaceRoot) => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  },
): LifecycleWorkspace {
  const sourceSnapshot = captureTreeSnapshot(root.openspecDir);
  const workspaceRoot = mkdtempSync(join(tmpdir(), prefix));
  const projectDir = join(workspaceRoot, "project");
  const openspecDir = join(projectDir, "openspec");

  try {
    mkdirSync(projectDir, { recursive: true });
    copyWorkspace(root.openspecDir, openspecDir);
    const sourceAfterCopy = captureTreeSnapshot(root.openspecDir);
    const workspaceSnapshot = captureTreeSnapshot(openspecDir);
    if (
      sourceAfterCopy.fingerprint !== sourceSnapshot.fingerprint ||
      workspaceSnapshot.fingerprint !== sourceSnapshot.fingerprint
    ) {
      throw new Error("OpenSpec project changed while its workspace was copied");
    }
  } catch (error) {
    rmSync(workspaceRoot, { recursive: true, force: true });
    throw error;
  }

  let cleaned = false;
  return {
    projectDir,
    openspecDir,
    sourceSnapshot,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      try {
        removeWorkspace(workspaceRoot);
        return undefined;
      } catch {
        return "Temporary command workspace cleanup could not be completed";
      }
    },
  };
}

function reserveAndPublishChange(
  stagingPath: string,
  destination: string,
  changeName: string,
  root: ProjectRoot,
  changesIdentity: EntryIdentity,
  options: ChangePublishOptions,
): void {
  assertIdentity(
    root.changesDir,
    changesIdentity,
    "openspec/changes",
  );
  assertRealpathContained(root.openspecDir, root.changesDir);
  const platform = options.platform ?? process.platform;
  const renameDirectory = options.renameDirectory ?? renameSync;
  let reservedDestination = false;

  if (platform === "win32") {
    if (lstatIfExists(destination)) {
      throw new Error(`Change already exists: ${changeName}`);
    }
  } else {
    try {
      mkdirSync(destination);
      reservedDestination = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`Change already exists: ${changeName}`);
      }
      throw error;
    }
  }

  try {
    assertIdentity(
      root.changesDir,
      changesIdentity,
      "openspec/changes",
    );
    if (reservedDestination) {
      assertRealpathContained(root.changesDir, destination);
    }
    renameDirectory(stagingPath, destination);
    assertIdentity(
      root.changesDir,
      changesIdentity,
      "openspec/changes",
    );
    assertRealpathContained(root.changesDir, destination);
  } catch (error) {
    if (
      reservedDestination &&
      matchesDirectoryIdentity(root.changesDir, changesIdentity)
    ) {
      try {
        rmdirSync(destination);
      } catch {
        // A concurrent writer populated the reserved directory. Preserve it.
      }
    }
    if (
      platform === "win32" &&
      ["EEXIST", "ENOTEMPTY", "EPERM"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    ) {
      throw new Error(`Change already exists: ${changeName}`);
    }
    throw error;
  }
}

export function captureChangesDirectoryGuard(
  root: ProjectRoot,
): ChangesDirectoryGuard {
  const openspecIdentity = assertSafeDirectory(
    root.openspecDir,
    "openspec",
  );
  const changesStat = lstatIfExists(root.changesDir);
  if (!changesStat) return { openspecIdentity };
  if (changesStat.isSymbolicLink() || !changesStat.isDirectory()) {
    throw new Error("Unsafe OpenSpec changes directory");
  }
  assertRealpathContained(root.openspecDir, root.changesDir);
  return {
    openspecIdentity,
    changesIdentity: {
      dev: changesStat.dev,
      ino: changesStat.ino,
    },
  };
}

function createChangeStagingRoot(
  root: ProjectRoot,
  guard: ChangesDirectoryGuard,
): {
  stagingRoot: string;
  changesIdentity: EntryIdentity;
  cleanup: () => string | undefined;
} {
  const changesDir = root.changesDir;
  assertIdentity(root.openspecDir, guard.openspecIdentity, "openspec");
  const changesDirExisted = existsSync(changesDir);
  let changesIdentity: EntryIdentity;
  if (guard.changesIdentity) {
    if (!changesDirExisted) {
      throw new Error(
        "OpenSpec changes directory changed while create was running",
      );
    }
    try {
      assertIdentity(changesDir, guard.changesIdentity, "openspec/changes");
      changesIdentity = guard.changesIdentity;
    } catch {
      throw new Error(
        "OpenSpec changes directory changed while create was running",
      );
    }
  } else {
    if (lstatIfExists(changesDir)) {
      throw new Error(
        "OpenSpec changes directory changed while create was running",
      );
    }
    mkdirSync(changesDir);
    changesIdentity = assertSafeDirectory(changesDir, "openspec/changes");
  }
  assertRealpathContained(root.openspecDir, changesDir);

  let stagingRoot: string;
  let stagingIdentity: EntryIdentity;
  try {
    stagingRoot = mkdtempSync(
      join(changesDir, ".openspec-viewer-create-"),
    );
    stagingIdentity = assertSafeDirectory(
      stagingRoot,
      "openspec/changes/create-staging",
    );
    assertIdentity(changesDir, changesIdentity, "openspec/changes");
    assertRealpathContained(changesDir, stagingRoot);
  } catch (error) {
    if (
      !changesDirExisted &&
      matchesDirectoryIdentity(changesDir, changesIdentity) &&
      readdirSync(changesDir).length === 0
    ) {
      rmdirSync(changesDir);
    }
    throw error;
  }

  return {
    stagingRoot,
    changesIdentity,
    cleanup: () => {
      try {
        if (lstatIfExists(stagingRoot)) {
          assertIdentity(changesDir, changesIdentity, "openspec/changes");
          assertIdentity(
            stagingRoot,
            stagingIdentity,
            "openspec/changes/create-staging",
          );
          quarantineAndRemoveDirectory(
            changesDir,
            stagingRoot,
            stagingIdentity,
            "openspec/changes/create-staging",
          );
        }
        if (
          !changesDirExisted &&
          matchesDirectoryIdentity(changesDir, changesIdentity) &&
          readdirSync(changesDir).length === 0
        ) {
          rmdirSync(changesDir);
        }
        return undefined;
      } catch {
        return "Temporary change staging cleanup could not be completed";
      }
    },
  };
}

export function publishChangeDirectory(
  source: string,
  destination: string,
  changeName: string,
  root: ProjectRoot,
  guard: ChangesDirectoryGuard,
  options: ChangePublishOptions = {},
): PublicationResult {
  const staging = createChangeStagingRoot(root, guard);
  const { stagingRoot, changesIdentity } = staging;
  const stagingPath = join(stagingRoot, "change");

  let committed = false;
  let cleanupWarning: string | undefined;
  try {
    copyTreeWithoutSymlinks(source, stagingPath);
    reserveAndPublishChange(
      stagingPath,
      destination,
      changeName,
      root,
      changesIdentity,
      options,
    );
    committed = true;
  } finally {
    const warning = staging.cleanup();
    if (committed) cleanupWarning = warning;
  }
  return cleanupWarning ? { cleanupWarning } : {};
}

export function publishScaffold(
  destination: string,
  changeName: string,
  writeScaffold: ScaffoldWriter,
  root: ProjectRoot,
  guard: ChangesDirectoryGuard,
  options: ChangePublishOptions = {},
): PublicationResult {
  const staging = createChangeStagingRoot(root, guard);
  const { stagingRoot, changesIdentity } = staging;
  const stagingPath = join(stagingRoot, "change");

  let committed = false;
  let cleanupWarning: string | undefined;
  try {
    mkdirSync(stagingPath);
    writeScaffold(stagingPath, changeName);
    captureTreeSnapshot(stagingPath);
    reserveAndPublishChange(
      stagingPath,
      destination,
      changeName,
      root,
      changesIdentity,
      options,
    );
    committed = true;
  } finally {
    const warning = staging.cleanup();
    if (committed) cleanupWarning = warning;
  }
  return cleanupWarning ? { cleanupWarning } : {};
}

export function captureTreeSnapshot(rootPath: string): TreeSnapshot {
  const hash = createHash("sha256");
  const entries = new Map<string, TreeEntry>();

  const visit = (path: string, relativePath: string) => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw symbolicLinkError(relativePath);
    }
    if (stat.isFile()) {
      const content = readFileSync(path);
      const digest = createHash("sha256").update(content).digest("hex");
      entries.set(relativePath, {
        kind: "file",
        digest,
        mode: stat.mode & 0o777,
      });
      hash.update(`file\0${relativePath}\0${stat.mode & 0o777}\0`);
      hash.update(content);
      hash.update("\0");
      return;
    }
    if (!stat.isDirectory()) {
      throw new Error(
        `Unsupported filesystem entry in OpenSpec lifecycle operation${
          relativePath ? `: ${relativePath}` : ""
        }`,
      );
    }

    entries.set(relativePath, {
      kind: "directory",
      mode: stat.mode & 0o777,
    });
    hash.update(`directory\0${relativePath}\0${stat.mode & 0o777}\0`);
    const childNames = readdirSync(path).sort((a, b) => a.localeCompare(b));
    for (const entry of childNames) {
      visit(join(path, entry), relativePath ? `${relativePath}/${entry}` : entry);
    }
  };

  visit(rootPath, "");
  return { entries, fingerprint: hash.digest("hex") };
}

export function treeFingerprint(rootPath: string): string {
  return captureTreeSnapshot(rootPath).fingerprint;
}

function sameEntry(left: TreeEntry | undefined, right: TreeEntry | undefined) {
  if (!left || !right || left.kind !== right.kind) return left === right;
  if (left.kind === "directory") {
    return right.kind === "directory" && left.mode === right.mode;
  }
  return (
    right.kind === "file" &&
    left.digest === right.digest &&
    left.mode === right.mode
  );
}

export type ArchivePublishOperations = {
  cleanupPublishRoot: (cleanup: () => void) => void;
  createDirectory: (path: string, mode: number) => void;
  linkFile: (source: string, destination: string) => void;
  removeDirectory: (path: string) => void;
  removeFile: (path: string) => void;
  renamePath: (source: string, destination: string) => void;
};

const defaultArchivePublishOperations: ArchivePublishOperations = {
  cleanupPublishRoot: (cleanup) => cleanup(),
  createDirectory: (path, mode) => mkdirSync(path, { mode }),
  linkFile: (source, destination) => linkSync(source, destination),
  removeDirectory: (path) => rmdirSync(path),
  removeFile: (path) => unlinkSync(path),
  renamePath: (source, destination) => renameSync(source, destination),
};

function currentEntry(path: string, relativePath: string): TreeEntry | undefined {
  if (!existsSync(path)) return undefined;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw symbolicLinkError(relativePath);
  if (stat.isDirectory()) {
    return { kind: "directory", mode: stat.mode & 0o777 };
  }
  if (stat.isFile()) {
    return {
      kind: "file",
      digest: createHash("sha256").update(readFileSync(path)).digest("hex"),
      mode: stat.mode & 0o777,
    };
  }
  throw new Error(
    `Unsupported filesystem entry in OpenSpec lifecycle operation: ${relativePath}`,
  );
}

function assertEntry(
  path: string,
  relativePath: string,
  expected: TreeEntry | undefined,
): void {
  if (!sameEntry(currentEntry(path, relativePath), expected)) {
    throw new Error("OpenSpec project changed while archive was running");
  }
}

function pathDepth(path: string): number {
  return path.split("/").length;
}

function lstatIfExists(path: string) {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function assertSafeDirectory(path: string, label: string): EntryIdentity {
  const stat = lstatIfExists(path);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Unsafe local lifecycle directory: ${label}`);
  }
  return { dev: stat.dev, ino: stat.ino };
}

function assertIdentity(
  path: string,
  expected: EntryIdentity,
  label: string,
): void {
  const actual = assertSafeDirectory(path, label);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino) {
    throw new Error(`Local lifecycle directory changed during archive: ${label}`);
  }
}

function matchesDirectoryIdentity(
  path: string,
  expected: EntryIdentity | undefined,
): boolean {
  if (!expected) return false;
  const stat = lstatIfExists(path);
  return Boolean(
    stat?.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.dev === expected.dev &&
      stat.ino === expected.ino,
  );
}

function quarantineAndRemoveDirectory(
  parent: string,
  path: string,
  expected: EntryIdentity,
  label: string,
): void {
  const quarantine = join(parent, `.cleanup-${randomUUID()}`);
  renameSync(path, quarantine);
  try {
    assertIdentity(quarantine, expected, label);
  } catch (error) {
    if (!lstatIfExists(path)) {
      renameSync(quarantine, path);
    }
    throw error;
  }
  rmSync(quarantine, { recursive: true, force: true });
}

const PRIVATE_IGNORE_MARKER =
  "# local openspec-viewer state (do not commit)\n*\n";

export function ensurePrivateLocalStateIgnore(viewerPath: string): void {
  assertSafeDirectory(viewerPath, ".openspec-viewer");
  const ignorePath = join(viewerPath, ".gitignore");
  let initial = lstatIfExists(ignorePath);

  if (!initial) {
    try {
      writeFileSync(ignorePath, PRIVATE_IGNORE_MARKER, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      initial = lstatSync(ignorePath);
    }
  }

  if (initial.isSymbolicLink() || !initial.isFile()) {
    throw new Error("Unsafe local lifecycle ignore file");
  }

  const descriptor = openSync(ignorePath, "r+");
  try {
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino
    ) {
      throw new Error("Local lifecycle ignore file changed during archive");
    }
    const content = readFileSync(descriptor, "utf8");
    if (!content.endsWith(PRIVATE_IGNORE_MARKER)) {
      const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
      writeSync(descriptor, `${separator}${PRIVATE_IGNORE_MARKER}`, null, "utf8");
    }
  } finally {
    closeSync(descriptor);
  }

  const current = lstatSync(ignorePath);
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.dev !== initial.dev ||
    current.ino !== initial.ino
  ) {
    throw new Error("Local lifecycle ignore file changed during archive");
  }
}

function assertRealpathContained(parent: string, child: string): void {
  const relation = relative(realpathSync(parent), realpathSync(child));
  if (
    relation === ".." ||
    relation.startsWith(`..${sep}`) ||
    isAbsolute(relation)
  ) {
    throw new Error("Local lifecycle directory escapes the selected project");
  }
}

function createArchivePublishRoot(root: ProjectRoot): {
  path: string;
  cleanup: () => void;
} {
  const viewerPath = join(root.projectDir, ".openspec-viewer");
  const lifecyclePath = join(viewerPath, "lifecycle");
  const viewerExists = lstatIfExists(viewerPath) !== undefined;
  let lifecycleExisted = false;
  let viewerIdentity: EntryIdentity | undefined;
  let lifecycleIdentity: EntryIdentity | undefined;
  let publishIdentity: EntryIdentity | undefined;

  let path = "";
  try {
    if (!viewerExists) {
      try {
        mkdirSync(viewerPath, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    viewerIdentity = assertSafeDirectory(viewerPath, ".openspec-viewer");
    assertRealpathContained(root.projectDir, viewerPath);

    lifecycleExisted = lstatIfExists(lifecyclePath) !== undefined;
    if (!lifecycleExisted) {
      try {
        mkdirSync(lifecyclePath, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    lifecycleIdentity = assertSafeDirectory(
      lifecyclePath,
      ".openspec-viewer/lifecycle",
    );
    assertRealpathContained(viewerPath, lifecyclePath);

    ensurePrivateLocalStateIgnore(viewerPath);

    path = mkdtempSync(join(lifecyclePath, "archive-publish-"));
    publishIdentity = assertSafeDirectory(
      path,
      ".openspec-viewer/lifecycle/archive-publish",
    );
    assertRealpathContained(lifecyclePath, path);
  } catch (error) {
    if (
      path &&
      matchesDirectoryIdentity(viewerPath, viewerIdentity) &&
      matchesDirectoryIdentity(lifecyclePath, lifecycleIdentity) &&
      matchesDirectoryIdentity(path, publishIdentity)
    ) {
      quarantineAndRemoveDirectory(
        lifecyclePath,
        path,
        publishIdentity!,
        ".openspec-viewer/lifecycle/archive-publish",
      );
    }
    if (
      !lifecycleExisted &&
      matchesDirectoryIdentity(lifecyclePath, lifecycleIdentity) &&
      readdirSync(lifecyclePath).length === 0
    ) {
      rmdirSync(lifecyclePath);
    }
    throw error;
  }

  return {
    path,
    cleanup: () => {
      assertIdentity(viewerPath, viewerIdentity!, ".openspec-viewer");
      assertIdentity(
        lifecyclePath,
        lifecycleIdentity!,
        ".openspec-viewer/lifecycle",
      );
      assertIdentity(
        path,
        publishIdentity!,
        ".openspec-viewer/lifecycle/archive-publish",
      );
      assertRealpathContained(lifecyclePath, path);
      ensurePrivateLocalStateIgnore(viewerPath);
      quarantineAndRemoveDirectory(
        lifecyclePath,
        path,
        publishIdentity!,
        ".openspec-viewer/lifecycle/archive-publish",
      );
      if (
        !lifecycleExisted &&
        existsSync(lifecyclePath) &&
        readdirSync(lifecyclePath).length === 0
      ) {
        rmdirSync(lifecyclePath);
      }
    },
  };
}

export function publishOpenSpecTree(
  root: ProjectRoot,
  source: string,
  expectedSnapshot: TreeSnapshot,
  operationOverrides?: Partial<ArchivePublishOperations>,
): PublicationResult {
  const operations = {
    ...defaultArchivePublishOperations,
    ...operationOverrides,
  };
  const resultSnapshot = captureTreeSnapshot(source);
  const currentSnapshot = captureTreeSnapshot(root.openspecDir);
  if (currentSnapshot.fingerprint !== expectedSnapshot.fingerprint) {
    throw new Error("OpenSpec project changed while archive was running");
  }

  const allPaths = new Set([
    ...expectedSnapshot.entries.keys(),
    ...resultSnapshot.entries.keys(),
  ]);
  allPaths.delete("");

  const addedDirectories: string[] = [];
  const removedDirectories: string[] = [];
  const addedFiles: string[] = [];
  const removedFiles: string[] = [];
  const modifiedFiles: string[] = [];

  for (const relativePath of allPaths) {
    const before = expectedSnapshot.entries.get(relativePath);
    const after = resultSnapshot.entries.get(relativePath);
    if (sameEntry(before, after)) continue;
    if (before && after && before.kind !== after.kind) {
      throw new Error(
        `Archive result changes an unsupported filesystem entry type: ${relativePath}`,
      );
    }
    if (
      before?.kind === "directory" &&
      after?.kind === "directory" &&
      before.mode !== after.mode
    ) {
      throw new Error(
        `Archive result changes unsupported directory permissions: ${relativePath}`,
      );
    }
    if (!before && after?.kind === "directory") addedDirectories.push(relativePath);
    else if (before?.kind === "directory" && !after) removedDirectories.push(relativePath);
    else if (!before && after?.kind === "file") addedFiles.push(relativePath);
    else if (before?.kind === "file" && !after) removedFiles.push(relativePath);
    else if (before?.kind === "file" && after?.kind === "file") {
      modifiedFiles.push(relativePath);
    }
  }

  addedDirectories.sort((a, b) => pathDepth(a) - pathDepth(b));
  removedDirectories.sort((a, b) => pathDepth(b) - pathDepth(a));

  const publishRoot = createArchivePublishRoot(root);
  const nextDir = join(publishRoot.path, "next");
  const backupDir = join(publishRoot.path, "backup");
  const stagedFiles = new Map<string, string>();
  const stageFile = (relativePath: string) => {
    const stagedPath = join(nextDir, String(stagedFiles.size));
    const sourcePath = join(source, relativePath);
    const entry = resultSnapshot.entries.get(relativePath);
    if (!entry || entry.kind !== "file") {
      throw new Error(`Archive result is missing a staged file: ${relativePath}`);
    }
    copyTreeWithoutSymlinks(sourcePath, stagedPath, relativePath);
    stagedFiles.set(relativePath, stagedPath);
  };

  const createdDirectories: string[] = [];
  const appliedAddedFiles: string[] = [];
  const appliedModifiedFiles: Array<{
    relativePath: string;
    backup: string;
    published: boolean;
  }> = [];
  const appliedRemovedFiles: Array<{ relativePath: string; backup: string }> = [];
  const appliedRemovedDirectories: string[] = [];
  let rollbackSafe = true;
  let committed = false;
  let cleanupWarning: string | undefined;
  let primaryError: unknown;

  try {
    mkdirSync(nextDir);
    mkdirSync(backupDir);
    for (const relativePath of [...addedFiles, ...modifiedFiles]) {
      stageFile(relativePath);
    }

    if (
      captureTreeSnapshot(root.openspecDir).fingerprint !==
      expectedSnapshot.fingerprint
    ) {
      throw new Error("OpenSpec project changed while archive was running");
    }

    for (const relativePath of addedDirectories) {
      const path = join(root.openspecDir, relativePath);
      assertEntry(path, relativePath, undefined);
      const entry = resultSnapshot.entries.get(relativePath);
      operations.createDirectory(path, entry?.mode ?? 0o755);
      createdDirectories.push(relativePath);
    }

    for (const relativePath of addedFiles) {
      const path = join(root.openspecDir, relativePath);
      assertEntry(path, relativePath, undefined);
      operations.linkFile(stagedFiles.get(relativePath)!, path);
      appliedAddedFiles.push(relativePath);
    }

    for (const relativePath of modifiedFiles) {
      const path = join(root.openspecDir, relativePath);
      const before = expectedSnapshot.entries.get(relativePath);
      assertEntry(path, relativePath, before);
      const backup = join(backupDir, String(appliedModifiedFiles.length));
      operations.renamePath(path, backup);
      const applied = { relativePath, backup, published: false };
      appliedModifiedFiles.push(applied);
      assertEntry(backup, relativePath, before);
      operations.linkFile(stagedFiles.get(relativePath)!, path);
      applied.published = true;
    }

    for (const relativePath of removedFiles) {
      const path = join(root.openspecDir, relativePath);
      const before = expectedSnapshot.entries.get(relativePath);
      assertEntry(path, relativePath, before);
      const backup = join(
        backupDir,
        `removed-${appliedRemovedFiles.length}`,
      );
      operations.renamePath(path, backup);
      appliedRemovedFiles.push({ relativePath, backup });
      assertEntry(backup, relativePath, before);
    }

    for (const relativePath of removedDirectories) {
      const path = join(root.openspecDir, relativePath);
      assertEntry(
        path,
        relativePath,
        expectedSnapshot.entries.get(relativePath),
      );
      operations.removeDirectory(path);
      appliedRemovedDirectories.push(relativePath);
    }

    const publishedSnapshot = captureTreeSnapshot(root.openspecDir);
    if (publishedSnapshot.fingerprint !== resultSnapshot.fingerprint) {
      throw new Error("OpenSpec project changed while archive was published");
    }
    for (const { relativePath, backup } of [
      ...appliedModifiedFiles,
      ...appliedRemovedFiles,
    ]) {
      assertEntry(
        backup,
        relativePath,
        expectedSnapshot.entries.get(relativePath),
      );
    }
    committed = true;
  } catch (error) {
    for (const relativePath of [...appliedRemovedDirectories].reverse()) {
      const path = join(root.openspecDir, relativePath);
      try {
        if (!existsSync(path)) {
          const entry = expectedSnapshot.entries.get(relativePath);
          operations.createDirectory(path, entry?.mode ?? 0o755);
        }
      } catch {
        rollbackSafe = false;
      }
    }

    for (const { relativePath, backup } of [
      ...appliedRemovedFiles,
    ].reverse()) {
      try {
        const path = join(root.openspecDir, relativePath);
        if (existsSync(path)) {
          rollbackSafe = false;
          continue;
        }
        operations.renamePath(backup, path);
      } catch {
        rollbackSafe = false;
      }
    }

    for (const { relativePath, backup, published } of [
      ...appliedModifiedFiles,
    ].reverse()) {
      try {
        const path = join(root.openspecDir, relativePath);
        if (published) {
          const expectedResult = resultSnapshot.entries.get(relativePath);
          if (!sameEntry(currentEntry(path, relativePath), expectedResult)) {
            rollbackSafe = false;
            continue;
          }
          operations.removeFile(path);
        } else if (currentEntry(path, relativePath)) {
          rollbackSafe = false;
          continue;
        }
        operations.renamePath(backup, path);
      } catch {
        rollbackSafe = false;
      }
    }

    for (const relativePath of [...appliedAddedFiles].reverse()) {
      try {
        const path = join(root.openspecDir, relativePath);
        const expectedResult = resultSnapshot.entries.get(relativePath);
        if (!sameEntry(currentEntry(path, relativePath), expectedResult)) {
          rollbackSafe = false;
          continue;
        }
        operations.removeFile(path);
      } catch {
        rollbackSafe = false;
      }
    }

    for (const relativePath of [...createdDirectories].reverse()) {
      try {
        operations.removeDirectory(join(root.openspecDir, relativePath));
      } catch {
        rollbackSafe = false;
      }
    }

    if (!rollbackSafe) {
      const recoveryError = new Error(
        "Archive publish failed; recovery files were preserved in local viewer state",
        { cause: error },
      );
      primaryError = recoveryError;
      throw recoveryError;
    }
    primaryError = error;
    throw error;
  } finally {
    if (rollbackSafe) {
      try {
        operations.cleanupPublishRoot(publishRoot.cleanup);
      } catch (error) {
        if (!committed) {
          if (primaryError instanceof Error) {
            Object.defineProperty(primaryError, "cleanupError", {
              configurable: true,
              enumerable: false,
              value: error,
            });
          } else {
            throw error;
          }
        } else {
          cleanupWarning =
            "Archive committed, but local staging cleanup could not be completed under .openspec-viewer/lifecycle";
        }
      }
    }
  }
  return cleanupWarning ? { cleanupWarning } : {};
}
