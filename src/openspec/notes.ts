import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ProjectRoot } from "./discover.js";

const DIR_NAME = ".openspec-viewer";

function safeName(changeName: string): string {
  return changeName.replace(/[^\w.-]+/g, "__");
}

export function viewerDir(root: ProjectRoot): string {
  return join(root.projectDir, DIR_NAME);
}

export function notesDir(root: ProjectRoot): string {
  return join(viewerDir(root), "notes");
}

export function ensureViewerGitignore(root: ProjectRoot): void {
  const dir = viewerDir(root);
  mkdirSync(dir, { recursive: true });
  mkdirSync(notesDir(root), { recursive: true });

  const gi = join(dir, ".gitignore");
  if (!existsSync(gi)) {
    writeFileSync(gi, "# local openspec-viewer state (do not commit)\n*\n", "utf8");
  }

  const rootGi = join(root.projectDir, ".gitignore");
  const line = `${DIR_NAME}/`;
  if (existsSync(rootGi)) {
    const cur = readFileSync(rootGi, "utf8");
    if (!cur.split(/\r?\n/).some((l) => l.trim() === line || l.trim() === DIR_NAME)) {
      appendFileSync(rootGi, `${cur.endsWith("\n") ? "" : "\n"}\n# openspec-viewer local notes\n${line}\n`);
    }
  } else {
    writeFileSync(rootGi, `# openspec-viewer local notes\n${line}\n`, "utf8");
  }
}

export function notesPath(root: ProjectRoot, changeName: string): string {
  return join(notesDir(root), `${safeName(changeName)}.md`);
}

export function readNotes(root: ProjectRoot, changeName: string): string {
  ensureViewerGitignore(root);
  const path = notesPath(root, changeName);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function writeNotes(root: ProjectRoot, changeName: string, content: string): string {
  ensureViewerGitignore(root);
  const path = notesPath(root, changeName);
  writeFileSync(path, content, "utf8");
  return content;
}
