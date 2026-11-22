import { createHash } from "node:crypto";

const UA = "OpenResearchIDE/0.1 (local-first academic research)";
const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const abstractFromInvertedIndex = (index) => {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words[position] = word;
  return clean(words.filter(Boolean).join(" "));
};
const normalizeDoi = (value) => clean(value).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

async function requestJson(url, fetcher, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function searchLiterature(query, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const limit = Math.min(Math.max(Number(options.limit) || 8, 1), 20);
  const startedAt = new Date().toISOString();
  const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=id,doi,title,display_name,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index`;
  const semanticUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=paperId,title,abstract,year,authors,venue,externalIds,url,citationCount`;
  const [openAlex, semantic] = await Promise.allSettled([
    requestJson(openAlexUrl, fetcher),
    requestJson(semanticUrl, fetcher),
  ]);
  const papers = [];
  const sources = [];
  if (openAlex.status === "fulfilled") {
    for (const work of openAlex.value.results || []) {
      const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
      papers.push({
        id: `openalex:${clean(work.id).split("/").pop()}`, provider: "OpenAlex",
        title: clean(work.title || work.display_name), year: work.publication_year || null,
        authors: (work.authorships || []).map((item) => clean(item.author?.display_name)).filter(Boolean),
        doi: normalizeDoi(work.doi), venue: clean(work.primary_location?.source?.display_name),
        url: clean(work.doi || work.id), abstract,
        citationCount: Number(work.cited_by_count) || 0,
      });
    }
    sources.push({ id: "openalex", provider: "OpenAlex", url: openAlexUrl, status: "ok", queriedAt: startedAt });
  } else {
    sources.push({ id: "openalex", provider: "OpenAlex", url: openAlexUrl, status: "error", queriedAt: startedAt, error: String(openAlex.reason?.message || openAlex.reason).slice(0, 300) });
  }
  if (semantic.status === "fulfilled") {
    for (const work of semantic.value.data || []) {
      const doi = normalizeDoi(work.externalIds?.DOI);
      papers.push({
        id: `semantic:${clean(work.paperId)}`, provider: "Semantic Scholar",
        title: clean(work.title), year: work.year || null,
        authors: (work.authors || []).map((item) => clean(item.name)).filter(Boolean),
        doi, venue: clean(work.venue), url: clean(work.url), abstract: clean(work.abstract),
        citationCount: Number(work.citationCount) || 0,
      });
    }
    sources.push({ id: "semantic-scholar", provider: "Semantic Scholar", url: semanticUrl, status: "ok", queriedAt: startedAt });
  } else {
    sources.push({ id: "semantic-scholar", provider: "Semantic Scholar", url: semanticUrl, status: "error", queriedAt: startedAt, error: String(semantic.reason?.message || semantic.reason).slice(0, 300) });
  }
  const merged = [];
  const keys = new Map();
  for (const paper of papers.filter((paper) => paper.title)) {
    const key = paper.doi ? `doi:${paper.doi.toLowerCase()}` : `title:${createHash("sha256").update(paper.title.toLowerCase()).digest("hex")}`;
    if (keys.has(key)) {
      const previous = merged[keys.get(key)];
      if (!previous.abstract && paper.abstract) previous.abstract = paper.abstract;
      previous.providers = [...new Set([previous.provider, ...(previous.providers || []), paper.provider])];
      if (!previous.url && paper.url) previous.url = paper.url;
    } else { keys.set(key, merged.length); merged.push({ ...paper, providers: [paper.provider] }); }
  }
  return { query, papers: merged.slice(0, limit), sources, retrievedAt: startedAt };
}

export function literatureNodes(result) {
  const nodes = [];
  const sources = [];
  for (const paper of result.papers) {
    const paperId = paper.id;
    nodes.push({ id: paperId, type: "paper", title: paper.title, sourceRefs: paper.providers || [paper.provider], data: { ...paper, verified: false } });
    if (paper.abstract) {
      const quote = paper.abstract.split(/(?<=[.!?])\s+/)[0].slice(0, 700);
      if (quote && paper.abstract.includes(quote)) nodes.push({ id: `evidence:${paperId}`, type: "evidence", title: "Opening abstract claim", sourceRefs: [paperId], data: { paperId, quote, verified: false } });
    }
  }
  return { nodes, edges: [], sources: result.sources };
}
