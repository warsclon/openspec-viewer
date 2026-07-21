import { existsSync } from "node:fs";
import { join } from "node:path";
import { listSpecFiles, readTextIfExists, type ProjectRoot } from "./discover.js";
import { changeDir } from "./discover.js";

export type SpecOp = "ADDED" | "MODIFIED" | "REMOVED" | "RENAMED" | "UNKNOWN";

export type SpecDiffRequirement = {
  op: SpecOp;
  title: string;
  preview: string;
};

export type SpecDiff = {
  id: string;
  mainExists: boolean;
  operations: SpecDiffRequirement[];
  summary: { added: number; modified: number; removed: number; other: number };
  deltaContent: string;
  mainContent: string | null;
};

const OP_HEADER_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements?\s*$/i;
const REQ_RE = /^###\s+Requirement:\s*(.+)\s*$/i;

export function parseDeltaOperations(deltaMarkdown: string): SpecDiffRequirement[] {
  const lines = deltaMarkdown.replace(/\r\n/g, "\n").split("\n");
  let currentOp: SpecOp = "UNKNOWN";
  const out: SpecDiffRequirement[] = [];
  let current: SpecDiffRequirement | null = null;

  const flush = () => {
    if (!current) return;
    current.preview = current.preview.trim().slice(0, 280);
    out.push(current);
    current = null;
  };

  for (const line of lines) {
    const op = line.match(OP_HEADER_RE);
    if (op) {
      flush();
      currentOp = op[1].toUpperCase() as SpecOp;
      continue;
    }
    const req = line.match(REQ_RE);
    if (req) {
      flush();
      current = { op: currentOp, title: req[1].trim(), preview: "" };
      continue;
    }
    if (current && line.trim() && !line.startsWith("#")) {
      if (current.preview.length < 280) {
        current.preview += (current.preview ? " " : "") + line.trim();
      }
    }
  }
  flush();
  return out;
}

function summarize(ops: SpecDiffRequirement[]) {
  const summary = { added: 0, modified: 0, removed: 0, other: 0 };
  for (const op of ops) {
    if (op.op === "ADDED") summary.added += 1;
    else if (op.op === "MODIFIED") summary.modified += 1;
    else if (op.op === "REMOVED") summary.removed += 1;
    else summary.other += 1;
  }
  return summary;
}

export function getChangeSpecDiffs(root: ProjectRoot, changeName: string): SpecDiff[] {
  const dir = changeDir(root, changeName);
  const deltas = listSpecFiles(dir);
  return deltas.map((d) => {
    const deltaContent = readTextIfExists(d.path) ?? "";
    const mainPath = join(root.specsDir, d.id, "spec.md");
    const mainExists = existsSync(mainPath);
    const mainContent = mainExists ? readTextIfExists(mainPath) : null;
    const operations = parseDeltaOperations(deltaContent);
    return {
      id: d.id,
      mainExists,
      operations,
      summary: summarize(operations),
      deltaContent,
      mainContent,
    };
  });
}
