import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ProjectRoot } from "./discover.js";
import { ensurePrivateLocalStateIgnore } from "./lifecycle-workspace.js";

const DIR_NAME = ".openspec-viewer";

function safeName(changeName: string): string {
  return changeName.replace(/[^\w.-]+/g, "__");
}

function assertNoteChangeName(changeName: string): void {
  if (
    !/^(?:archive\/)?[a-z0-9][a-z0-9._-]*$/i.test(changeName) ||
    changeName.includes("..")
  ) {
    throw new Error(`Invalid note change name: ${changeName}`);
  }
}

export function viewerDir(root: ProjectRoot): string {
  return join(root.projectDir, DIR_NAME);
}

export function notesDir(root: ProjectRoot): string {
  return join(viewerDir(root), "notes");
}

export function ensureViewerGitignore(root: ProjectRoot): void {
  const dir = viewerDir(root);
  if (!existsSync(dir)) mkdirSync(dir);
  ensurePrivateLocalStateIgnore(dir);

  const localNotesDir = notesDir(root);
  if (!existsSync(localNotesDir)) mkdirSync(localNotesDir);
  const notesStat = lstatSync(localNotesDir);
  if (notesStat.isSymbolicLink() || !notesStat.isDirectory()) {
    throw new Error("Unsafe local notes directory");
  }

  // Only append to an existing root .gitignore (never create one unsolicited).
  const rootGi = join(root.projectDir, ".gitignore");
  const line = `${DIR_NAME}/`;
  if (existsSync(rootGi)) {
    const cur = readFileSync(rootGi, "utf8");
    if (!cur.split(/\r?\n/).some((l) => l.trim() === line || l.trim() === DIR_NAME)) {
      appendFileSync(rootGi, `${cur.endsWith("\n") ? "" : "\n"}\n# openspec-viewer local notes\n${line}\n`);
    }
  }
}

export function notesPath(root: ProjectRoot, changeName: string): string {
  assertNoteChangeName(changeName);
  return join(notesDir(root), `${safeName(changeName)}.md`);
}

export function readNotes(root: ProjectRoot, changeName: string): string {
  const path = notesPath(root, changeName);
  ensureViewerGitignore(root);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function writeNotes(root: ProjectRoot, changeName: string, content: string): string {
  const path = notesPath(root, changeName);
  ensureViewerGitignore(root);
  writeFileSync(path, content, "utf8");
  return content;
}
