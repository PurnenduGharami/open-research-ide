import { createHash } from "node:crypto";

const UA_BASE = "OpenResearchIDE/0.2 (open-source local-first scientific research IDE)";
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalizeDoi = (value) => clean(value)
  .replace(/^doi:\s*/i, "")
  .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

export async function discoverLabsFromDois(doisInput, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 30);
  const baseUrl = (options.openAlexBaseUrl || "https://api.openalex.org").replace(/\/$/, "");
  const mailto = clean(process.env.OPENALEX_MAILTO);
  const ua = mailto ? `${UA_BASE} (mailto:${mailto})` : UA_BASE;

  const dois = [...new Set((doisInput || []).map(normalizeDoi).filter(Boolean).map((d) => d.toLowerCase()))];
  if (!dois.length) {
    return { retrievedAt: new Date().toISOString(), works: [], labs: [], sources: [] };
  }

  const candidates = new Map();
  const sources = [];
  const works = [];

  await Promise.all(dois.slice(0, 10).map(async (doi) => {
    const url = `${baseUrl}/works/doi:${encodeURIComponent(doi)}?select=id,doi,title,display_name,authorships${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
    const queriedAt = new Date().toISOString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
    try {
      const response = await fetcher(url, { headers: { "User-Agent": ua, Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const work = await response.json();
      sources.push({ id: `openalex:labs:${doi}`, provider: "OpenAlex", url, status: "ok", queriedAt });
      const workId = clean(work.id);
      const workDoi = normalizeDoi(work.doi) || doi;
      const workTitle = clean(work.title || work.display_name);
      works.push({ id: workId, doi: workDoi, title: workTitle });
      for (const authorship of work.authorships || []) {
        const authorName = clean(authorship?.author?.display_name);
        for (const inst of authorship?.institutions || []) {
          const name = clean(inst?.display_name);
          if (!name) continue;
          const identity = clean(inst.id || inst.ror) || `name:${name.toLowerCase()}`;
          const key = identity.toLowerCase();
          if (!candidates.has(key)) {
            const digest = createHash("sha256").update(identity).digest("hex").slice(0, 16);
            candidates.set(key, {
              id: `lab:openalex:${digest}`,
              name,
              institution: name,
              url: inst.ror || inst.id || undefined,
              rorUrl: inst.ror || undefined,
              pathway: "academic-collaborator",
              fit: "Published authors on retrieved literature (OpenAlex authorship affiliation); confirm experimental capability before outreach.",
              contacted: false,
              price: { kind: "unavailable", note: "OpenAlex authorship metadata does not supply service pricing." },
              authors: [],
              paperDois: [],
              sourceRefs: [],
            });
          }
          const entry = candidates.get(key);
          if (authorName && !entry.authors.includes(authorName)) entry.authors.push(authorName);
          if (workDoi && !entry.paperDois.includes(workDoi)) entry.paperDois.push(workDoi);
          if (workId && !entry.sourceRefs.includes(workId)) entry.sourceRefs.push(workId);
        }
      }
    } catch (error) {
      sources.push({
        id: `openalex:labs:${doi}`,
        provider: "OpenAlex",
        url,
        status: "error",
        queriedAt,
        error: String(error?.message || error).slice(0, 300),
      });
    } finally {
      clearTimeout(timer);
    }
  }));

  const labs = [...candidates.values()]
    .sort((a, b) => b.paperDois.length - a.paperDois.length || a.name.localeCompare(b.name))
    .slice(0, limit);

  return { retrievedAt: new Date().toISOString(), works, labs, sources };
}

export function labNodesFromDiscovery(discovery) {
  return discovery.labs.map((lab) => ({
    id: lab.id,
    type: "lab",
    title: lab.name,
    sourceRefs: lab.sourceRefs.length ? lab.sourceRefs : ["OpenAlex"],
    data: {
      name: lab.name,
      institution: lab.institution,
      ...(lab.url ? { url: lab.url } : {}),
      ...(lab.rorUrl ? { rorUrl: lab.rorUrl } : {}),
      pathway: lab.pathway,
      fit: lab.fit,
      contacted: false,
      authors: lab.authors.slice(0, 6),
      paperDois: lab.paperDois,
      price: lab.price,
    },
  }));
}
