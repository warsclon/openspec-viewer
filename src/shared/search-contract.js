function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function scoreText(query, haystack, weight) {
  const normalizedQuery = normalize(query);
  const normalizedHaystack = normalize(haystack);
  if (!normalizedQuery || !normalizedHaystack) return 0;
  if (normalizedHaystack === normalizedQuery) return 100 * weight;
  if (normalizedHaystack.startsWith(normalizedQuery)) return 80 * weight;
  if (normalizedHaystack.includes(normalizedQuery)) return 50 * weight;
  const parts = normalizedQuery.split(/\s+/).filter(Boolean);
  if (
    parts.length > 1 &&
    parts.every((part) => normalizedHaystack.includes(part))
  ) {
    return 40 * weight;
  }
  return 0;
}

function snippetAround(text, query, radius = 60) {
  const haystack = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = haystack.indexOf(normalizedQuery);
  if (index < 0) return text.slice(0, radius * 2).trim() || undefined;
  const start = Math.max(0, index - radius);
  const end = Math.min(
    text.length,
    index + normalizedQuery.length + radius,
  );
  return `${start > 0 ? "…" : ""}${text
    .slice(start, end)
    .replace(/\s+/g, " ")}${end < text.length ? "…" : ""}`;
}

export function searchDocuments(documents, query, limit = 40) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const hits = documents
    .map((document) => {
      const fieldScores = document.fields.map((field) =>
        scoreText(normalizedQuery, field.text, field.weight),
      );
      const score =
        document.scoreMode === "max"
          ? Math.max(0, ...fieldScores)
          : fieldScores.reduce((total, value) => total + value, 0);
      if (score <= 0) return null;

      const {
        fields: _fields,
        scoreMode: _scoreMode,
        snippetText,
        ...hit
      } = document;
      return {
        ...hit,
        score,
        snippet: snippetText
          ? snippetAround(snippetText, normalizedQuery)
          : undefined,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const seen = new Set();
  const unique = [];
  for (const hit of hits) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    unique.push(hit);
    if (unique.length >= limit) break;
  }
  return unique;
}
