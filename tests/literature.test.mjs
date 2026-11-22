import assert from "node:assert/strict";
import test from "node:test";
import { literatureNodes, searchLiterature } from "../plugins/research-engine/literature.mjs";

const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

test("literature normalizes, merges DOI records, and preserves source provenance", async () => {
  const fetch = async (url) => url.includes("openalex") ? response({ results: [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.1000/XYZ", title: "Mycelium materials", publication_year: 2025, authorships: [{ author: { display_name: "A. Researcher" } }], primary_location: { source: { display_name: "Materials Journal" } }, cited_by_count: 4, abstract_inverted_index: { Humidity: [0], matters: [1], greatly: [2] } }] }) : response({ data: [{ paperId: "S1", title: "Mycelium materials", abstract: "Humidity matters greatly.", year: 2025, authors: [{ name: "A. Researcher" }], venue: "Materials Journal", externalIds: { DOI: "10.1000/xyz" }, url: "https://example.org/paper", citationCount: 5 }] });
  const result = await searchLiterature("mycelium humidity", { fetch });
  assert.equal(result.papers.length, 1);
  assert.equal(result.papers[0].doi, "10.1000/XYZ");
  assert.deepEqual(result.papers[0].providers, ["OpenAlex", "Semantic Scholar"]);
  const converted = literatureNodes(result);
  const evidence = converted.nodes.find((node) => node.type === "evidence");
  assert.ok(converted.nodes[0].data.abstract.includes(evidence.data.quote));
});

test("one unavailable source remains visible while the other returns real records", async () => {
  const fetch = async (url) => url.includes("openalex") ? response({}, false, 429) : response({ data: [{ paperId: "S2", title: "Retained record", abstract: "Real abstract.", authors: [], externalIds: {} }] });
  const result = await searchLiterature("test", { fetch });
  assert.equal(result.papers.length, 1);
  assert.equal(result.sources.find((source) => source.id === "openalex").status, "error");
  assert.match(result.sources.find((source) => source.id === "openalex").error, /429/);
});
