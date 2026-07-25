import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { changeDir, type ProjectRoot } from "./discover.js";
import {
  createLifecycleWorkspace,
  captureChangesDirectoryGuard,
  defaultCopyWorkspace,
  defaultScaffoldWriter,
  publishChangeDirectory,
  publishOpenSpecTree,
  publishScaffold,
  treeFingerprint,
  type ArchivePublishOperations,
  type ChangePublishOptions,
  type CopyWorkspace,
  type ScaffoldWriter,
  type WorkspaceRemover,
} from "./lifecycle-workspace.js";
import {
  mutateTasks,
  readTasksFile,
  sectionsFromParsed,
  writeTasksSections,
  type ParsedTasks,
  type SectionDraft,
} from "./tasks.js";

const ARTIFACTS = new Set(["proposal", "design", "tasks"] as const);
export type ArtifactName = "proposal" | "design" | "tasks";

export function assertActiveChange(changeName: string): void {
  if (changeName.includes("..") || changeName.startsWith("/")) {
    throw new Error(`Invalid change name: ${changeName}`);
  }
  if (changeName.startsWith("archive/")) {
    throw new Error("Archived changes are read-only");
  }
}

export function artifactPath(root: ProjectRoot, changeName: string, artifact: ArtifactName): string {
  assertActiveChange(changeName);
  const dir = changeDir(root, changeName);
  if (artifact === "tasks") return join(dir, "tasks.md");
  if (artifact === "proposal") return join(dir, "proposal.md");
  return join(dir, "design.md");
}

export function writeArtifact(
  root: ProjectRoot,
  changeName: string,
  artifact: ArtifactName,
  content: string,
): { path: string; content: string } {
  if (!ARTIFACTS.has(artifact)) throw new Error(`Invalid artifact: ${artifact}`);
  if (typeof content !== "string") {
    throw new Error("Artifact content must be a string");
  }
  const path = artifactPath(root, changeName, artifact);
  const body = content.endsWith("\n") ? content : `${content}\n`;
  writeFileSync(path, body, "utf8");
  return { path, content: body };
}

export function applyTaskMutation(
  root: ProjectRoot,
  changeName: string,
  action: Parameters<typeof mutateTasks>[1],
): { parsed: ParsedTasks; path: string } {
  assertActiveChange(changeName);
  const path = artifactPath(root, changeName, "tasks");
  const current = existsSync(path)
    ? sectionsFromParsed(readTasksFile(path))
    : ([{ title: "Tasks", tasks: [] }] as SectionDraft[]);
  const next = mutateTasks(current, action);
  const parsed = writeTasksSections(path, next);
  return { parsed, path };
}

export function replaceTasks(
  root: ProjectRoot,
  changeName: string,
  sections: SectionDraft[],
): { parsed: ParsedTasks; path: string } {
  return applyTaskMutation(root, changeName, { type: "replace", sections });
}

export type CommandResult = { code: number; stdout: string; stderr: string };
export type CommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<CommandResult>;

const defaultCommandRunner: CommandRunner = (
  cmd: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

const CHANGE_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export async function createChange(
  root: ProjectRoot,
  name: string,
  opts?: {
    description?: string;
    runCommand?: CommandRunner;
    copyWorkspace?: CopyWorkspace;
    removeWorkspace?: WorkspaceRemover;
    changePublish?: ChangePublishOptions;
    writeScaffold?: ScaffoldWriter;
  },
): Promise<{
  name: string;
  path: string;
  stdout: string;
  cleanupWarning?: string;
}> {
  const changeName = name.trim();
  if (!CHANGE_NAME_RE.test(changeName)) {
    throw new Error(
      "Invalid name. Use kebab-case: add-dark-mode (lowercase, hyphens, must not start with a number).",
    );
  }
  const changesGuard = captureChangesDirectoryGuard(root);
  const dest = join(root.changesDir, changeName);
  if (existsSync(dest)) {
    throw new Error(`Change already exists: ${changeName}`);
  }

  const args = ["new", "change", changeName, "--json"];
  if (opts?.description) args.push("--description", opts.description);
  const workspace = createLifecycleWorkspace(
    root,
    "openspec-viewer-create-command-",
    opts?.copyWorkspace ?? defaultCopyWorkspace,
    opts?.removeWorkspace,
  );
  const workspaceDest = join(
    workspace.openspecDir,
    "changes",
    changeName,
  );

  let outcome:
    | { name: string; path: string; stdout: string }
    | undefined;
  let committed = false;
  const cleanupWarnings: string[] = [];

  try {
    let result: CommandResult;
    try {
      result = await (opts?.runCommand ?? defaultCommandRunner)(
        "openspec",
        args,
        workspace.projectDir,
      );
    } catch (error) {
      const commandError = error as NodeJS.ErrnoException;
      if (commandError.code !== "ENOENT") throw error;
      result = {
        code: 127,
        stdout: "",
        stderr: commandError.message,
      };
    }

    if (result.code === 0) {
      if (!existsSync(workspaceDest)) {
        throw new Error(
          "openspec new change succeeded without creating the requested change",
        );
      }
      const publication = publishChangeDirectory(
        workspaceDest,
        dest,
        changeName,
        root,
        changesGuard,
        opts?.changePublish,
      );
      if (publication.cleanupWarning) {
        cleanupWarnings.push(publication.cleanupWarning);
      }
      outcome = { name: changeName, path: dest, stdout: result.stdout };
      committed = true;
    } else if (existsSync(workspaceDest)) {
      throw new Error(
        result.stderr ||
          result.stdout ||
          `openspec new change failed (${result.code})`,
      );
    } else {
      const publication = publishScaffold(
        dest,
        changeName,
        opts?.writeScaffold ?? defaultScaffoldWriter,
        root,
        changesGuard,
        opts?.changePublish,
      );
      if (publication.cleanupWarning) {
        cleanupWarnings.push(publication.cleanupWarning);
      }
      outcome = {
        name: changeName,
        path: dest,
        stdout:
          result.stderr ||
          result.stdout ||
          "scaffolded without openspec CLI",
      };
      committed = true;
    }
  } finally {
    const warning = workspace.cleanup();
    if (committed && warning) cleanupWarnings.push(warning);
  }
  if (!outcome) throw new Error("Change creation completed without a result");
  return cleanupWarnings.length > 0
    ? { ...outcome, cleanupWarning: cleanupWarnings.join("; ") }
    : outcome;
}

export async function archiveChange(
  root: ProjectRoot,
  changeName: string,
  opts?: {
    skipSpecs?: boolean;
    runCommand?: CommandRunner;
    copyWorkspace?: CopyWorkspace;
    removeWorkspace?: WorkspaceRemover;
    publishOperations?: Partial<ArchivePublishOperations>;
  },
): Promise<{ stdout: string; stderr: string; cleanupWarning?: string }> {
  assertActiveChange(changeName);
  changeDir(root, changeName);

  const args = ["archive", changeName, "-y", "--json"];
  if (opts?.skipSpecs) args.push("--skip-specs");
  const workspace = createLifecycleWorkspace(
    root,
    "openspec-viewer-archive-",
    opts?.copyWorkspace ?? defaultCopyWorkspace,
    opts?.removeWorkspace,
  );

  let outcome: { stdout: string; stderr: string } | undefined;
  let committed = false;
  const cleanupWarnings: string[] = [];
  try {
    if (
      treeFingerprint(root.openspecDir) !==
      workspace.sourceSnapshot.fingerprint
    ) {
      throw new Error("OpenSpec project changed while archive was running");
    }
    const result = await (opts?.runCommand ?? defaultCommandRunner)(
      "openspec",
      args,
      workspace.projectDir,
    );
    if (result.code !== 0) {
      throw new Error(
        result.stderr || result.stdout || `openspec archive failed (${result.code})`,
      );
    }
    const publication = publishOpenSpecTree(
      root,
      workspace.openspecDir,
      workspace.sourceSnapshot,
      opts?.publishOperations,
    );
    if (publication.cleanupWarning) {
      cleanupWarnings.push(publication.cleanupWarning);
    }
    outcome = { stdout: result.stdout, stderr: result.stderr };
    committed = true;
  } finally {
    const warning = workspace.cleanup();
    if (committed && warning) cleanupWarnings.push(warning);
  }
  if (!outcome) throw new Error("Archive completed without a result");
  return cleanupWarnings.length > 0
    ? { ...outcome, cleanupWarning: cleanupWarnings.join("; ") }
    : outcome;
}
