export type SearchHitKind =
  | "change"
  | "task"
  | "proposal"
  | "design"
  | "spec-main"
  | "spec-delta";

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

export type SearchDocument = Omit<SearchHit, "score" | "snippet"> & {
  fields: Array<{
    text: string;
    weight: number;
  }>;
  scoreMode?: "max" | "sum";
  snippetText?: string;
};

export function searchDocuments(
  documents: SearchDocument[],
  query: string,
  limit?: number,
): SearchHit[];
