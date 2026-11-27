export function extractPdfTextFromBuffer(buffer: Buffer | Uint8Array): Promise<{
  pageCount: number;
  pages: Array<{ page: number; text: string }>;
  fullText: string;
  fullTextSha256: string;
  inferredTitle: string;
  inferredDoi: string;
}>;
export function fetchOpenAccessPdf(url: string, fetcher?: typeof fetch): Promise<Buffer>;
