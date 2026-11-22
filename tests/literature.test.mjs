import assert from "node:assert/strict";
import test from "node:test";
import { fetchRecentPapers, literatureNodes, searchLiterature } from "../plugins/research-engine/literature.mjs";
import { discoverLabsFromDois, labNodesFromDiscovery } from "../plugins/research-engine/labs.mjs";

const response = (body, ok = true, status = 200) => ({
  ok,
  status,
  headers: { get: () => null },
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  json: async () => body,
});

test("literature normalizes, merges DOI records, preserves provenance, and does not auto-create noisy opening evidence", async () => {
  const fetch = async (url) => url.includes("openalex")
    ? response({ results: [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.1000/XYZ", title: "Mycelium materials", publication_year: 2025, authorships: [{ author: { display_name: "A. Researcher" } }], primary_location: { source: { display_name: "Materials Journal" } }, cited_by_count: 4, abstract_inverted_index: { Humidity: [0], matters: [1], greatly: [2] } }] })
    : response({ data: [{ paperId: "S1", title: "Mycelium materials", abstract: "Humidity matters greatly.", year: 2025, authors: [{ name: "A. Researcher" }], venue: "Materials Journal", externalIds: { DOI: "10.1000/xyz" }, url: "https://example.org/paper", citationCount: 5 }] });
  const result = await searchLiterature("mycelium humidity", { fetch, retries: 0 });
  assert.equal(result.papers.length, 1);
  assert.equal(result.papers[0].doi, "10.1000/XYZ");
  assert.deepEqual(result.papers[0].providers, ["OpenAlex", "Semantic Scholar"]);
  const converted = literatureNodes(result);
  assert.equal(converted.nodes.length, 1);
  assert.equal(converted.nodes[0].type, "paper");
  assert.equal(converted.nodes.some((node) => node.type === "evidence"), false);
});

test("one unavailable source remains visible while the other returns real records", async () => {
  const fetch = async (url) => url.includes("openalex")
    ? response({}, false, 429)
    : response({ data: [{ paperId: "S2", title: "Retained record", abstract: "Real abstract.", authors: [], externalIds: {} }] });
  const result = await searchLiterature("test", { fetch, retries: 0 });
  assert.equal(result.papers.length, 1);
  assert.equal(result.sources.find((source) => source.id === "openalex").status, "error");
  assert.match(result.sources.find((source) => source.id === "openalex").error, /429/);
});

test("fetchRecentPapers combines OpenAlex and arXiv Atom XML feeds", async () => {
  const arxivXml = `<feed><entry><id>http://arxiv.org/abs/2611.01234v1</id><title>Sodium Cathode Stability</title><summary>We measure cathode degradation under cycling.</summary><published>2026-11-18T00:00:00Z</published><author><name>M. Chen</name></author></entry></feed>`;
  const fetch = async (url) => url.includes("arxiv")
    ? response(arxivXml, true, 200)
    : response({ results: [{ id: "https://openalex.org/W9", doi: "https://doi.org/10.1000/recent", title: "Recent Electrolyte Study", publication_year: 2026, publication_date: "2026-11-15", authorships: [{ author: { display_name: "J. Patel" } }], primary_location: { source: { display_name: "Energy Letters" } }, cited_by_count: 2, abstract_inverted_index: { Solid: [0], electrolytes: [1], improved: [2], "stability.": [3] } }] });
  const recent = await fetchRecentPapers("chemistry", { fetch, limit: 6 });
  assert.equal(recent.papers.length, 2);
  assert.ok(recent.papers.some((p) => p.provider === "arXiv"));
  assert.ok(recent.papers.some((p) => p.provider === "OpenAlex"));
});

test("discoverLabsFromDois derives real uncontacted OpenAlex institutions without fabricating pricing", async () => {
  const fetch = async () => response({
    id: "https://openalex.org/W10",
    doi: "https://doi.org/10.1000/labtest",
    title: "Real Authorship Paper",
    authorships: [{
      author: { display_name: "Dr. A. Kim" },
      institutions: [{ id: "https://openalex.org/I99", display_name: "Institute for Materials Testing", ror: "https://ror.org/01test" }],
    }],
  });
  const discovery = await discoverLabsFromDois(["10.1000/labtest"], { fetch });
  assert.equal(discovery.labs.length, 1);
  assert.equal(discovery.labs[0].contacted, false);
  assert.equal(discovery.labs[0].price.kind, "unavailable");
  const nodes = labNodesFromDiscovery(discovery);
  assert.equal(nodes[0].type, "lab");
  assert.equal(nodes[0].data.rorUrl, "https://ror.org/01test");
});
