function normalizeSearchText(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function hostedSearch(documents, query) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [];
  const parts = normalizedQuery.split(/\s+/).filter(Boolean);

  return documents
    .map((document) => {
      const text = normalizeSearchText(document.text);
      let score = 0;
      if (text === normalizedQuery) score = 100;
      else if (text.startsWith(normalizedQuery)) score = 80;
      else if (text.includes(normalizedQuery)) score = 50;
      else if (parts.length > 1 && parts.every((part) => text.includes(part))) {
        score = 40;
      }
      score *= document.weight || 1;
      if (!score) return null;

      const compact = String(document.text).replace(/\s+/g, " ").trim();
      const index = normalizeSearchText(compact).indexOf(normalizedQuery);
      const start = Math.max(0, index < 0 ? 0 : index - 60);
      const end = Math.min(
        compact.length,
        index < 0 ? 120 : index + query.length + 60,
      );
      return {
        ...document,
        score,
        snippet: `${start > 0 ? "…" : ""}${compact.slice(start, end)}${
          end < compact.length ? "…" : ""
        }`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 40)
    .map(({ text: _text, weight: _weight, ...hit }) => hit);
}
