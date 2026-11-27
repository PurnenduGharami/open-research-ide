import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function cleanPageText(text) {
  return String(text || "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractPdfTextFromBuffer(buffer) {
  if (!buffer || buffer.byteLength < 8) {
    throw new Error("Uploaded PDF file is empty or invalid");
  }
  const header = Buffer.from(buffer).subarray(0, 5).toString("latin1");
  if (header !== "%PDF-") {
    throw new Error("File is not a valid PDF document (missing %PDF- signature)");
  }

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text: perPageRaw } = await extractText(pdf, { mergePages: false });
  const rawPages = Array.isArray(perPageRaw) ? perPageRaw : [String(perPageRaw || "")];

  const pages = rawPages.map((pageText, idx) => ({
    page: idx + 1,
    text: cleanPageText(pageText),
  }));

  const fullText = pages
    .map((p) => `[Page ${p.page}]\n${p.text}`)
    .join("\n\n")
    .trim();

  if (!fullText) {
    throw new Error("Could not extract readable text from this PDF (it may be scanned without OCR)");
  }

  const fullTextSha256 = createHash("sha256").update(fullText, "utf8").digest("hex");
  const firstPageLines = (pages[0]?.text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const inferredTitle = firstPageLines.find((line) => line.length >= 12 && line.length <= 220 && !/^arXiv:/i.test(line)) || "";
  const doiMatch = fullText.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);

  return {
    pageCount: totalPages || pages.length,
    pages,
    fullText,
    fullTextSha256,
    inferredTitle,
    inferredDoi: doiMatch ? doiMatch[1].replace(/[.,;)]+$/, "") : "",
  };
}

export async function fetchOpenAccessPdf(url, fetcher = globalThis.fetch) {
  let parsed;
  try {
    parsed = new URL(String(url || "").trim());
  } catch {
    throw new Error("Paper does not have a valid Open Access URL");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Unsupported URL protocol for Open Access PDF");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetcher(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/pdf,*/*;q=0.8", "User-Agent": "OpenResearchIDE/1.0" },
    });
    if (!res.ok) throw new Error(`Failed to fetch PDF (HTTP ${res.status})`);
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_PDF_BYTES) {
      throw new Error("Open Access PDF exceeds 20 MB limit");
    }
    const buffer = Buffer.from(arrayBuf);
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error("Remote Open Access URL returned HTML/landing page rather than a direct PDF binary");
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}
