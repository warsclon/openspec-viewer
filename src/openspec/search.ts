import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  changeDir,
  listSpecFiles,
  readTextIfExists,
  type ProjectRoot,
} from "./discover.js";
import { listChanges, listMainSpecs, type ChangeSummary } from "./project.js";
import { readTasksFile } from "./tasks.js";

export type SearchHitKind = "change" | "task" | "proposal" | "design" | "spec-main" | "spec-delta";

export type SearchHit = {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string;
  changeName?: string;
  specId?: string;
  taskId?: string;
  score: number;
  snippet?: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function scoreText(query: string, hay: string, weight = 1): number {
  const q = normalize(query);
  const h = normalize(hay);
  if (!q || !h) return 0;
  if (h === q) return 100 * weight;
  if (h.startsWith(q)) return 80 * weight;
  if (h.includes(q)) return 50 * weight;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => h.includes(p))) return 40 * weight;
  return 0;
}

function snippetAround(text: string, query: string, radius = 60): string | undefined {
  const h = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = h.indexOf(q);
  if (idx < 0) return text.slice(0, radius * 2).trim() || undefined;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ")}${end < text.length ? "…" : ""}`;
}

export function searchProject(
  root: ProjectRoot,
  query: string,
  opts?: { includeArchive?: boolean; limit?: number },
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const includeArchive = opts?.includeArchive ?? true;
  const limit = opts?.limit ?? 40;
  const changes = listChanges(root, includeArchive);
  const hits: SearchHit[] = [];

  for (const c of changes) {
    const nameScore =
      scoreText(q, c.displayName, 1.2) +
      scoreText(q, c.folderName, 1) +
      scoreText(q, c.name, 0.8);
    if (nameScore > 0) {
      hits.push({
        kind: "change",
        id: `change:${c.name}`,
        title: c.displayName,
        subtitle: c.archived ? `archived · ${c.completedTasks}/${c.totalTasks}` : `${c.status} · ${c.completedTasks}/${c.totalTasks}`,
        changeName: c.name,
        score: nameScore,
      });
    }

    const dir = changeDir(root, c.name);
    pushDocHits(hits, q, c, "proposal", join(dir, "proposal.md"));
    pushDocHits(hits, q, c, "design", join(dir, "design.md"));

    const tasksPath = join(dir, "tasks.md");
    if (existsSync(tasksPath)) {
      const parsed = readTasksFile(tasksPath);
      for (const t of parsed.tasks) {
        const s = scoreText(q, `${t.id} ${t.text}`, 1);
        if (s > 0) {
          hits.push({
            kind: "task",
            id: `task:${c.name}:${t.id}`,
            title: `${t.id} ${t.text}`,
            subtitle: `${c.displayName}${t.done ? " · done" : ""}`,
            changeName: c.name,
            taskId: t.id,
            score: s,
            snippet: t.text,
          });
        }
      }
    }

    for (const spec of listSpecFiles(dir)) {
      const content = readTextIfExists(spec.path) ?? "";
      const s = Math.max(scoreText(q, spec.id, 1.1), scoreText(q, content, 0.5));
      if (s > 0) {
        hits.push({
          kind: "spec-delta",
          id: `spec-delta:${c.name}:${spec.id}`,
          title: spec.id,
          subtitle: `delta · ${c.displayName}`,
          changeName: c.name,
          specId: spec.id,
          score: s,
          snippet: snippetAround(content, q),
        });
      }
    }
  }

  for (const spec of listMainSpecs(root)) {
    const content = readTextIfExists(spec.path) ?? "";
    const s = Math.max(scoreText(q, spec.id, 1.2), scoreText(q, content, 0.55));
    if (s > 0) {
      hits.push({
        kind: "spec-main",
        id: `spec-main:${spec.id}`,
        title: spec.id,
        subtitle: "spec main",
        specId: spec.id,
        score: s,
        snippet: snippetAround(content, q),
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  // de-dupe by id
  const seen = new Set<string>();
  const unique: SearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    unique.push(h);
    if (unique.length >= limit) break;
  }
  return unique;
}

function pushDocHits(
  hits: SearchHit[],
  q: string,
  c: ChangeSummary,
  kind: "proposal" | "design",
  path: string,
) {
  if (!existsSync(path)) return;
  const content = readTextIfExists(path) ?? "";
  const s = scoreText(q, content, 0.7);
  if (s <= 0) return;
  hits.push({
    kind,
    id: `${kind}:${c.name}`,
    title: `${kind} · ${c.displayName}`,
    subtitle: c.archived ? "archived" : c.status,
    changeName: c.name,
    score: s,
    snippet: snippetAround(content, q),
  });
}
