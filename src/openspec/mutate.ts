import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { changeDir, type ProjectRoot } from "./discover.js";
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
    throw new Error(`Nombre de change inválido: ${changeName}`);
  }
  if (changeName.startsWith("archive/")) {
    throw new Error("Change archivado es read-only");
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
  if (!ARTIFACTS.has(artifact)) throw new Error(`Artifact inválido: ${artifact}`);
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

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
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
}

const CHANGE_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export async function createChange(
  root: ProjectRoot,
  name: string,
  opts?: { description?: string },
): Promise<{ name: string; path: string; stdout: string }> {
  const changeName = name.trim();
  if (!CHANGE_NAME_RE.test(changeName)) {
    throw new Error(
      "Nombre inválido. Usa kebab-case: add-dark-mode (minúsculas, guiones, sin empezar por número).",
    );
  }
  const dest = join(root.changesDir, changeName);
  if (existsSync(dest)) {
    throw new Error(`Ya existe el change: ${changeName}`);
  }

  const args = ["new", "change", changeName, "--json"];
  if (opts?.description) args.push("--description", opts.description);

  const result = await runCommand("openspec", args, root.projectDir);
  if (result.code !== 0) {
    // fallback: scaffold manually if openspec CLI missing/fails
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
      mkdirSync(join(dest, "specs"), { recursive: true });
      writeFileSync(join(dest, ".openspec.yaml"), "schema: spec-driven\n", "utf8");
      writeFileSync(
        join(dest, "proposal.md"),
        `# Proposal: ${changeName}\n\n## Why\n\n## What Changes\n\n## Non-goals\n`,
        "utf8",
      );
      writeFileSync(join(dest, "design.md"), `# Design: ${changeName}\n\n## Approach\n`, "utf8");
      writeFileSync(join(dest, "tasks.md"), `## 1. Implementation\n\n- [ ] 1.1 First task\n`, "utf8");
      return {
        name: changeName,
        path: dest,
        stdout: result.stderr || result.stdout || "scaffolded without openspec CLI",
      };
    }
    throw new Error(result.stderr || result.stdout || `openspec new change falló (${result.code})`);
  }

  return { name: changeName, path: dest, stdout: result.stdout };
}

export async function archiveChange(
  root: ProjectRoot,
  changeName: string,
  opts?: { skipSpecs?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  assertActiveChange(changeName);
  const dir = changeDir(root, changeName);
  if (!existsSync(dir)) throw new Error(`Change no encontrado: ${changeName}`);

  const args = ["archive", changeName, "-y", "--json"];
  if (opts?.skipSpecs) args.push("--skip-specs");

  const result = await runCommand("openspec", args, root.projectDir);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || `openspec archive falló (${result.code})`);
  }
  return { stdout: result.stdout, stderr: result.stderr };
}
