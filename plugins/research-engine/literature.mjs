import { createHash } from "node:crypto";

const UA_BASE = "OpenResearchIDE/0.2 (open-source local-first scientific research IDE)";
const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const abstractFromInvertedIndex = (index) => {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return clean(words.filter(Boolean).join(" "));
};

const normalizeDoi = (value) => clean(value)
  .replace(/^doi:\s*/i, "")
  .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUserAgent() {
  const mailto = clean(process.env.OPENALEX_MAILTO);
  return mailto ? `${UA_BASE} (mailto:${mailto})` : UA_BASE;
}

async function requestText(url, fetcher, { headers = {}, timeoutMs = 15000, retries = 1 } = {}) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": buildUserAgent(), ...headers },
        signal: controller.signal,
      });
      if ((response.status === 429 || response.status === 503) && attempt < retries) {
        attempt += 1;
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 4000)
          : 800 * attempt;
        await sleep(delayMs);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function requestJson(url, fetcher, options = {}) {
  const text = await requestText(url, fetcher, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  return JSON.parse(text);
}

function parseArxivAtom(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const tag = (name) => {
      const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
      return m ? clean(m[1]) : "";
    };
    const idUrl = tag("id");
    const arxivId = idUrl.split("/abs/").pop()?.replace(/v\d+$/, "") || "";
    const title = tag("title");
    const abstract = tag("summary");
    const published = tag("published");
    const year = published ? Number(published.slice(0, 4)) || null : null;
    const authors = [...block.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gi)].map((m) => clean(m[1])).filter(Boolean);
    const doiMatch = block.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i);
    const doi = doiMatch ? normalizeDoi(doiMatch[1]) : "";
    if (!title) continue;
    entries.push({
      id: `arxiv:${arxivId || createHash("sha256").update(title).digest("hex").slice(0, 12)}`,
      provider: "arXiv",
      title,
      year,
      publishedDate: published ? published.slice(0, 10) : undefined,
      authors,
      doi,
      venue: "arXiv",
      url: idUrl || (arxivId ? `https://arxiv.org/abs/${arxivId}` : ""),
      openAccessUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : undefined,
      abstract,
      citationCount: 0,
    });
  }
  return entries;
}

const openAlexWorkFields = "id,doi,title,display_name,publication_year,publication_date,authorships,primary_location,open_access,cited_by_count,is_retracted,referenced_works,cited_by_api_url,abstract_inverted_index";

function makeCiteKey(title, authors, year) {
  const firstAuthor = Array.isArray(authors) && authors[0] ? String(authors[0]) : "ref";
  const surname = firstAuthor.split(/[\s,]+/).filter(Boolean).pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "ref";
  const kw = String(title || "study").toLowerCase().split(/[^a-z0-9]+/).find((w) => w.length >= 4 && !["with", "from", "that", "this"].includes(w)) || "paper";
  return `${surname}${year || "nd"}${kw}`.slice(0, 32);
}

function normalizeOpenAlexWork(work, mailto = "") {
  const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
  const oaId = clean(work.id).split("/").pop();
  const title = clean(work.title || work.display_name);
  const authors = (work.authorships || []).map((item) => clean(item.author?.display_name)).filter(Boolean);
  const year = work.publication_year || null;
  const citedByRaw = clean(work.cited_by_api_url);
  const citedByApiUrl = citedByRaw && mailto && !citedByRaw.includes("mailto=")
    ? `${citedByRaw}${citedByRaw.includes("?") ? "&" : "?"}mailto=${encodeURIComponent(mailto)}`
    : citedByRaw || undefined;
  return {
    id: `openalex:${oaId}`,
    provider: "OpenAlex",
    providerIds: { OpenAlex: oaId },
    title,
    year,
    publishedDate: work.publication_date || undefined,
    authors,
    doi: normalizeDoi(work.doi),
    venue: clean(work.primary_location?.source?.display_name),
    url: clean(work.doi || work.id),
    openAccessUrl: clean(work.open_access?.oa_url) || undefined,
    abstract,
    citationCount: Number(work.cited_by_count) || 0,
    isRetracted: Boolean(work.is_retracted),
    referencedWorkIds: Array.isArray(work.referenced_works)
      ? work.referenced_works.slice(0, 25).map((idUrl) => clean(idUrl).split("/").pop()).filter(Boolean)
      : [],
    citedByApiUrl,
    citeKey: makeCiteKey(title, authors, year),
    readingStatus: "to-read",
  };
}

export async function searchLiterature(query, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const limit = Math.min(Math.max(Number(options.limit) || 8, 1), 20);
  const includeArxiv = options.includeArxiv !== false;
  const startedAt = new Date().toISOString();
  const mailto = clean(process.env.OPENALEX_MAILTO);
  const semanticKey = clean(process.env.SEMANTIC_SCHOLAR_API_KEY);

  const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=${openAlexWorkFields}${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
  const semanticUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=paperId,title,abstract,year,authors,venue,externalIds,url,citationCount,openAccessPdf`;
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${Math.min(limit, 8)}&sortBy=relevance&sortOrder=descending`;

  const requests = [
    requestJson(openAlexUrl, fetcher, { retries: options.retries ?? 1 }),
    requestJson(semanticUrl, fetcher, {
      retries: options.retries ?? 1,
      headers: semanticKey ? { "x-api-key": semanticKey } : {},
    }),
  ];
  if (includeArxiv && !options.fetch) {
    requests.push(requestText(arxivUrl, fetcher, { headers: { Accept: "application/atom+xml" }, retries: 0 }));
  }

  const [openAlex, semantic, arxiv] = await Promise.allSettled(requests);
  const papers = [];
  const sources = [];

  if (openAlex.status === "fulfilled") {
    for (const work of openAlex.value.results || []) {
      papers.push(normalizeOpenAlexWork(work, mailto));
    }
    sources.push({ id: "openalex", provider: "OpenAlex", url: openAlexUrl, status: "ok", queriedAt: startedAt });
  } else {
    sources.push({
      id: "openalex",
      provider: "OpenAlex",
      url: openAlexUrl,
      status: "error",
      queriedAt: startedAt,
      error: String(openAlex.reason?.message || openAlex.reason).slice(0, 300),
    });
  }

  if (semantic.status === "fulfilled") {
    for (const work of semantic.value.data || []) {
      const doi = normalizeDoi(work.externalIds?.DOI);
      const s2Id = clean(work.paperId);
      papers.push({
        id: `semantic:${s2Id}`,
        provider: "Semantic Scholar",
        providerIds: { "Semantic Scholar": s2Id },
        title: clean(work.title),
        year: work.year || null,
        authors: (work.authors || []).map((item) => clean(item.name)).filter(Boolean),
        doi,
        venue: clean(work.venue),
        url: clean(work.url),
        openAccessUrl: clean(work.openAccessPdf?.url) || undefined,
        abstract: clean(work.abstract),
        citationCount: Number(work.citationCount) || 0,
      });
    }
    sources.push({ id: "semantic-scholar", provider: "Semantic Scholar", url: semanticUrl, status: "ok", queriedAt: startedAt });
  } else {
    sources.push({
      id: "semantic-scholar",
      provider: "Semantic Scholar",
      url: semanticUrl,
      status: "error",
      queriedAt: startedAt,
      error: String(semantic.reason?.message || semantic.reason).slice(0, 300),
    });
  }

  if (arxiv) {
    if (arxiv.status === "fulfilled") {
      for (const item of parseArxivAtom(arxiv.value)) {
        papers.push({ ...item, providerIds: { arXiv: item.id.replace(/^arxiv:/, "") } });
      }
      sources.push({ id: "arxiv", provider: "arXiv", url: arxivUrl, status: "ok", queriedAt: startedAt });
    } else {
      sources.push({
        id: "arxiv",
        provider: "arXiv",
        url: arxivUrl,
        status: "error",
        queriedAt: startedAt,
        error: String(arxiv.reason?.message || arxiv.reason).slice(0, 300),
      });
    }
  }

  const merged = [];
  const keys = new Map();
  for (const paper of papers.filter((paper) => paper.title)) {
    const key = paper.doi
      ? `doi:${paper.doi.toLowerCase()}`
      : `title:${createHash("sha256").update(paper.title.toLowerCase()).digest("hex")}`;
    if (keys.has(key)) {
      const previous = merged[keys.get(key)];
      if (!previous.abstract && paper.abstract) previous.abstract = paper.abstract;
      if (!previous.openAccessUrl && paper.openAccessUrl) previous.openAccessUrl = paper.openAccessUrl;
      if (paper.isRetracted) previous.isRetracted = true;
      if (!previous.referencedWorkIds?.length && paper.referencedWorkIds?.length) previous.referencedWorkIds = paper.referencedWorkIds;
      if (!previous.citedByApiUrl && paper.citedByApiUrl) previous.citedByApiUrl = paper.citedByApiUrl;
      if (!previous.citeKey) previous.citeKey = paper.citeKey || makeCiteKey(previous.title, previous.authors, previous.year);
      previous.providers = [...new Set([previous.provider, ...(previous.providers || []), paper.provider])];
      previous.providerIds = { ...(previous.providerIds || {}), ...(paper.providerIds || {}) };
      if (!previous.url && paper.url) previous.url = paper.url;
      if ((paper.citationCount || 0) > (previous.citationCount || 0)) previous.citationCount = paper.citationCount;
    } else {
      keys.set(key, merged.length);
      merged.push({
        ...paper,
        providers: [paper.provider],
        citeKey: paper.citeKey || makeCiteKey(paper.title, paper.authors, paper.year),
      });
    }
  }
  return { query, papers: merged.slice(0, limit), sources, retrievedAt: startedAt };
}

export async function lookupPaperByDoi(doiInput, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const doi = normalizeDoi(doiInput);
  if (!doi) throw new Error("DOI must not be empty");
  const mailto = clean(process.env.OPENALEX_MAILTO);
  const url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=${openAlexWorkFields}${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
  const work = await requestJson(url, fetcher, { retries: 1 });
  const normalized = normalizeOpenAlexWork(work, mailto);
  const paper = {
    ...normalized,
    providers: ["OpenAlex"],
    doi: normalized.doi || doi,
  };
  return {
    paper,
    node: {
      id: paper.id,
      type: "paper",
      title: paper.title,
      sourceRefs: ["OpenAlex"],
      data: { ...paper },
    },
    source: { id: `openalex:doi:${doi.toLowerCase()}`, provider: "OpenAlex", url, status: "ok", queriedAt: new Date().toISOString() },
  };
}

export async function snowballCitations(paperNode, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const direction = ["references", "citations", "both"].includes(options.direction) ? options.direction : "both";
  const limit = Math.min(Math.max(Number(options.limit) || 6, 1), 12);
  const mailto = clean(process.env.OPENALEX_MAILTO);
  const startedAt = new Date().toISOString();
  const data = paperNode?.data || {};

  let oaId = data.providerIds?.OpenAlex || (String(paperNode?.id || "").startsWith("openalex:") ? String(paperNode.id).slice("openalex:".length) : "");
  let refIds = Array.isArray(data.referencedWorkIds) ? data.referencedWorkIds : [];
  let citedByUrl = data.citedByApiUrl || "";

  if ((!oaId || (!refIds.length && !citedByUrl)) && data.doi) {
    try {
      const resolved = await lookupPaperByDoi(data.doi, { fetch: fetcher });
      oaId = resolved.paper.providerIds?.OpenAlex || oaId;
      if (!refIds.length) refIds = resolved.paper.referencedWorkIds || [];
      if (!citedByUrl) citedByUrl = resolved.paper.citedByApiUrl || "";
    } catch { /* fall back gracefully if DOI resolution fails */ }
  }

  const jobs = [];
  if ((direction === "references" || direction === "both") && refIds.length) {
    const batch = refIds.slice(0, limit).join("|");
    const url = `https://api.openalex.org/works?filter=openalex:${encodeURIComponent(batch)}&per-page=${limit}&select=${openAlexWorkFields}${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
    jobs.push({ kind: "reference", url });
  }
  if ((direction === "citations" || direction === "both") && (citedByUrl || oaId)) {
    const url = citedByUrl
      ? `${citedByUrl}${citedByUrl.includes("per-page") ? "" : `&per-page=${limit}`}&select=${openAlexWorkFields}`
      : `https://api.openalex.org/works?filter=cites:${encodeURIComponent(oaId)}&sort=cited_by_count:desc&per-page=${limit}&select=${openAlexWorkFields}${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
    jobs.push({ kind: "citation", url });
  }

  if (!jobs.length) {
    throw new Error("No OpenAlex identifier, DOI, or citation links are attached to this paper yet.");
  }

  const settled = await Promise.allSettled(jobs.map((job) => requestJson(job.url, fetcher, { retries: 1 })));
  const nodes = [];
  const edges = [];
  const sources = [];
  const seen = new Set([paperNode.id]);

  settled.forEach((outcome, idx) => {
    const job = jobs[idx];
    if (outcome.status === "fulfilled") {
      sources.push({ id: `openalex:snowball:${job.kind}:${paperNode.id}`, provider: "OpenAlex", url: job.url, status: "ok", queriedAt: startedAt });
      for (const work of outcome.value?.results || []) {
        const p = normalizeOpenAlexWork(work, mailto);
        if (!p.title || seen.has(p.id)) continue;
        seen.add(p.id);
        nodes.push({
          id: p.id,
          type: "paper",
          title: p.title,
          sourceRefs: ["OpenAlex Snowball"],
          data: { ...p, providers: ["OpenAlex"] },
        });
        edges.push({
          id: `edge:snowball:${paperNode.id}:${p.id}`,
          source: job.kind === "reference" ? paperNode.id : p.id,
          target: job.kind === "reference" ? p.id : paperNode.id,
          type: "supports",
          label: job.kind === "reference" ? "Cites prior work" : "Cites this study",
        });
      }
    } else {
      sources.push({
        id: `openalex:snowball:${job.kind}:${paperNode.id}`,
        provider: "OpenAlex",
        url: job.url,
        status: "error",
        queriedAt: startedAt,
        error: String(outcome.reason?.message || outcome.reason).slice(0, 200),
      });
    }
  });

  return { nodes, edges, sources };
}

const RECENT_TOPICS = {
  all: { label: "All Fields", openAlex: "machine learning OR materials science OR biotechnology OR economics", arxiv: "cat:cs.AI+OR+cat:q-bio+OR+cat:cond-mat" },
  ai: { label: "AI & ML", openAlex: "large language models reasoning scientific discovery", arxiv: "cat:cs.AI+OR+cat:cs.LG" },
  chemistry: { label: "Chemistry & Materials", openAlex: "solid state battery catalyst polymer materials", arxiv: "cat:cond-mat.mtrl-sci+OR+cat:physics.chem-ph" },
  biology: { label: "Biology & Health", openAlex: "clinical trial microbiome neuroscience sleep", arxiv: "cat:q-bio.NC+OR+cat:q-bio.BM" },
  systems: { label: "Software & Systems", openAlex: "distributed systems compiler verification memory safety", arxiv: "cat:cs.SE+OR+cat:cs.DC" },
  psychology: { label: "Psychology & Economics", openAlex: "behavioral economics cognitive bias decision making", arxiv: "cat:econ.GN+OR+cat:cs.CY" },
};

export function recentTopicOptions() {
  return Object.entries(RECENT_TOPICS).map(([id, value]) => ({ id, label: value.label }));
}

export async function fetchRecentPapers(topic = "all", options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const limit = Math.min(Math.max(Number(options.limit) || 6, 1), 12);
  const spec = RECENT_TOPICS[topic] || RECENT_TOPICS.all;
  const mailto = clean(process.env.OPENALEX_MAILTO);
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(spec.openAlex)}&filter=from_publication_date:${cutoff},has_abstract:true&sort=publication_date:desc&per-page=${limit}&select=id,doi,title,display_name,publication_year,publication_date,authorships,primary_location,cited_by_count,abstract_inverted_index${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${spec.arxiv}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;

  const [oa, ax] = await Promise.allSettled([
    requestJson(openAlexUrl, fetcher, { timeoutMs: 10000, retries: 0 }),
    requestText(arxivUrl, fetcher, { headers: { Accept: "application/atom+xml" }, timeoutMs: 10000, retries: 0 }),
  ]);

  const cards = [];
  const sources = [];
  const nowIso = new Date().toISOString();

  if (oa.status === "fulfilled") {
    for (const work of oa.value.results || []) {
      const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
      const title = clean(work.title || work.display_name);
      if (!title || !abstract) continue;
      cards.push({
        id: `openalex:${clean(work.id).split("/").pop()}`,
        title,
        abstract,
        authors: (work.authorships || []).slice(0, 4).map((a) => clean(a.author?.display_name)).filter(Boolean),
        year: work.publication_year || null,
        publishedDate: work.publication_date || undefined,
        venue: clean(work.primary_location?.source?.display_name) || "OpenAlex Indexed Journal",
        doi: normalizeDoi(work.doi),
        url: clean(work.doi || work.id),
        provider: "OpenAlex",
        citationCount: Number(work.cited_by_count) || 0,
        topic: spec.label,
      });
    }
    sources.push({ provider: "OpenAlex", status: "ok", queriedAt: nowIso });
  } else {
    sources.push({ provider: "OpenAlex", status: "error", queriedAt: nowIso, error: String(oa.reason?.message || oa.reason).slice(0, 200) });
  }

  if (ax.status === "fulfilled") {
    for (const entry of parseArxivAtom(ax.value)) {
      if (!entry.abstract) continue;
      cards.push({
        id: entry.id,
        title: entry.title,
        abstract: entry.abstract,
        authors: entry.authors.slice(0, 4),
        year: entry.year,
        publishedDate: entry.publishedDate,
        venue: "arXiv Preprint",
        doi: entry.doi,
        url: entry.url,
        provider: "arXiv",
        citationCount: 0,
        topic: spec.label,
      });
    }
    sources.push({ provider: "arXiv", status: "ok", queriedAt: nowIso });
  } else {
    sources.push({ provider: "arXiv", status: "error", queriedAt: nowIso, error: String(ax.reason?.message || ax.reason).slice(0, 200) });
  }

  const seen = new Set();
  const deduped = [];
  for (const card of cards) {
    const key = card.doi ? card.doi.toLowerCase() : card.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(card);
  }
  return {
    topic: topic in RECENT_TOPICS ? topic : "all",
    topics: recentTopicOptions(),
    papers: deduped.slice(0, limit),
    sources,
    retrievedAt: nowIso,
  };
}

export function literatureNodes(result) {
  const nodes = [];
  for (const paper of result.papers) {
    nodes.push({
      id: paper.id,
      type: "paper",
      title: paper.title,
      sourceRefs: paper.providers || [paper.provider],
      data: {
        ...paper,
        providerIds: paper.providerIds || { [paper.provider]: paper.id.split(":").slice(1).join(":") || paper.id },
      },
    });
  }
  return { nodes, edges: [], sources: result.sources };
}
