import { createHash } from "node:crypto";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-csl";
import "@citation-js/plugin-ris";

export function generateCiteKey(paper) {
  const firstAuthor = Array.isArray(paper.authors) && paper.authors[0] ? String(paper.authors[0]) : "unknown";
  const surname = firstAuthor
    .split(/[\s,]+/)
    .filter(Boolean)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "ref";
  const year = paper.year || "nd";
  const keyword = String(paper.title || "study")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find((w) => w.length >= 4 && !["with", "from", "that", "this", "under", "into", "over", "using"].includes(w)) || "paper";
  return `${surname}${year}${keyword}`.slice(0, 36);
}

function parseAuthorName(raw) {
  if (!raw) return { literal: "Unknown" };
  if (typeof raw === "object") return raw;
  const text = String(raw).trim();
  if (text.includes(",")) {
    const [family, ...rest] = text.split(",");
    return { family: family.trim(), given: rest.join(",").trim() };
  }
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { family: parts[0] };
  return { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] };
}

function cslEntryToPaperNode(entry, sourceLabel) {
  const title = String(entry.title || "Untitled reference").replace(/\s+/g, " ").trim();
  const doi = entry.DOI ? String(entry.DOI).trim().replace(/^https?:\/\/doi\.org\//i, "") : "";
  const authors = Array.isArray(entry.author)
    ? entry.author
        .map((a) => [a.given, a.family].filter(Boolean).join(" ") || a.literal || "")
        .filter(Boolean)
    : [];
  const dateParts = entry.issued?.["date-parts"]?.[0];
  const year = Array.isArray(dateParts) && typeof dateParts[0] === "number" ? dateParts[0] : null;
  const venue = String(entry["container-title"] || entry.publisher || "").trim();
  const url = entry.URL || (doi ? `https://doi.org/${doi}` : "");
  const abstract = String(entry.abstract || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const stableKey = doi
    ? `doi:${doi.toLowerCase()}`
    : createHash("sha256").update(`${title.toLowerCase()}:${year || ""}`).digest("hex").slice(0, 14);
  const nodeId = doi ? `paper:doi:${stableKey.replace(/^doi:/, "").replace(/[^a-zA-Z0-9._-]/g, "_")}` : `paper:ref:${stableKey}`;
  const citeKey = entry.id && !String(entry.id).startsWith("temp_id_")
    ? String(entry.id).replace(/[^a-zA-Z0-9_-]/g, "")
    : generateCiteKey({ title, authors, year });

  return {
    id: nodeId,
    type: "paper",
    title,
    sourceRefs: [sourceLabel],
    data: {
      title,
      authors,
      year,
      venue,
      doi,
      url,
      abstract,
      provider: sourceLabel,
      providers: [sourceLabel],
      citeKey,
      readingStatus: "to-read",
    },
  };
}

export function parseReferencesText(inputText, sourceLabel = "Imported Reference") {
  const trimmed = String(inputText || "").trim();
  if (!trimmed) throw new Error("Reference input is empty");
  const cite = new Cite(trimmed);
  const data = Array.isArray(cite.data) ? cite.data : [];
  if (!data.length) throw new Error("No valid BibTeX, RIS, or CSL-JSON records were detected");
  return data.map((entry) => cslEntryToPaperNode(entry, sourceLabel));
}

export function papersToCslJson(papers) {
  return (papers || []).map((paper, index) => {
    const d = paper.data || {};
    const authors = Array.isArray(d.authors) ? d.authors.map(parseAuthorName) : [];
    const citeKey = d.citeKey || generateCiteKey({ title: paper.title, authors: d.authors, year: d.year }) || `paper_${index + 1}`;
    const isConf = /conference|proceedings|symposium|workshop|neurips|icml|iclr|acl|cvpr|sigcomm/i.test(String(d.venue || ""));
    return {
      id: citeKey,
      type: isConf ? "paper-conference" : "article-journal",
      title: paper.title,
      author: authors,
      ...(d.year ? { issued: { "date-parts": [[Number(d.year)]] } } : {}),
      ...(d.venue ? { "container-title": String(d.venue) } : {}),
      ...(d.doi ? { DOI: String(d.doi) } : {}),
      ...(d.url ? { URL: String(d.url) } : {}),
      ...(d.abstract ? { abstract: String(d.abstract) } : {}),
    };
  });
}

function formatIeeeLine(paper, index) {
  const d = paper.data || {};
  const authors = Array.isArray(d.authors) && d.authors.length
    ? d.authors.slice(0, 6).join(", ") + (d.authors.length > 6 ? " et al." : "")
    : "Unknown Author";
  const venue = d.venue ? `, ${d.venue}` : "";
  const year = d.year ? `, ${d.year}` : "";
  const doi = d.doi ? `. doi: ${d.doi}` : d.url ? `. ${d.url}` : "";
  return `[${index + 1}] ${authors}, "${paper.title},"${venue}${year}${doi}`.replace(/,"\s*,/g, ",\"");
}

export function formatCitations(papers, style = "apa") {
  if (!papers?.length) return "";
  if (style === "ieee") {
    return papers.map((p, i) => formatIeeeLine(p, i)).join("\n\n");
  }
  const csl = papersToCslJson(papers);
  const cite = new Cite(csl);
  if (style === "bibtex") {
    return cite.format("bibtex");
  }
  if (style === "ris") {
    return cite.format("ris");
  }
  const template = ["apa", "vancouver", "harvard1"].includes(style) ? style : "apa";
  return cite.format("bibliography", {
    format: "text",
    template,
    lang: "en-US",
  });
}
