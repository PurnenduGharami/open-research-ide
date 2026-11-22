import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const repository = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const script = (name) => path.isAbsolute(name) ? name : path.join(repository, "scripts", name);

function runPython(name, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(python, [script(name), ...args], {
      cwd: repository,
      env: { ...process.env, ...(options.env || {}) },
      timeout: options.timeout || 20_000,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error && typeof error.code !== "number") reject(error);
      else resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}

async function temporaryDirectory(t, prefix) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("data-script CLIs expose clear help without running side effects", async () => {
  for (const name of ["preflight.py", "search_papers.py", "find_labs.py", "export_journey.py"]) {
    const result = await runPython(name, ["--help"]);
    assert.equal(result.code, 0, `${name}: ${result.stderr}`);
    assert.match(result.stdout, /usage:/);
    assert.match(result.stdout, /--timeout/);
  }
});

test("search_papers uses literature.mjs, preserves DOI/provenance and reports total source failure", async (t) => {
  const directory = await temporaryDirectory(t, "literature-cli-");
  const fetchFixture = path.join(directory, "mock-fetch.mjs");
  await writeFile(fetchFixture, `
const allFail = process.env.FIXTURE_ALL_FAIL === "1";
globalThis.fetch = async (url) => {
  if (allFail || url.includes("semanticscholar") || url.includes("arxiv")) {
    return new Response(JSON.stringify({ error: "fixture unavailable" }), { status: 503 });
  }
  return new Response(JSON.stringify({ results: [{
    id: "https://openalex.org/W-real-fixture",
    doi: "https://doi.org/10.1000/REAL",
    title: "Real fixture paper",
    publication_year: 2026,
    authorships: [{ author: { display_name: "A. Researcher" } }],
    primary_location: { source: { display_name: "Fixture Journal" } },
    cited_by_count: 3,
    abstract_inverted_index: { Real: [0], abstract: [1] }
  }] }), { status: 200 });
};
`, "utf8");
  const env = { NODE_OPTIONS: `--import ${pathToFileURL(fetchFixture).href}` };
  const partial = await runPython("search_papers.py", ["real fixture", "--limit", "4"], { env });
  assert.equal(partial.code, 0, partial.stderr);
  const parsed = JSON.parse(partial.stdout);
  assert.equal(parsed.papers.length, 1);
  assert.equal(parsed.papers[0].doi, "10.1000/REAL");
  assert.deepEqual(parsed.papers[0].providers, ["OpenAlex"]);
  assert.equal(parsed.papers[0].id, "openalex:W-real-fixture");
  assert.equal(parsed.sources.find((source) => source.id === "openalex").status, "ok");
  assert.match(parsed.sources.find((source) => source.id === "semantic-scholar").error, /503/);
  assert.ok(parsed.sources.every((source) => source.url.startsWith("https://api.") || source.url.startsWith("https://export.arxiv.org/")));

  const failed = await runPython("search_papers.py", ["real fixture"], { env: { ...env, FIXTURE_ALL_FAIL: "1" } });
  assert.equal(failed.code, 2);
  assert.equal(JSON.parse(failed.stdout).papers.length, 0);
  assert.ok(JSON.parse(failed.stdout).sources.every((source) => source.status === "error"));
  assert.match(failed.stderr, /every literature source returned an error/);
});

test("find_labs reads real mock OpenAlex authorships over HTTP and never mutates canonical JSON", async (t) => {
  const directory = await temporaryDirectory(t, "labs-cli-");
  const projectPath = path.join(directory, "research-project.json");
  const fixture = {
    nodes: [
      { id: "paper:one", type: "paper", data: { doi: "https://doi.org/10.1000/REAL" } },
      { id: "paper:two", type: "paper", data: { doi: "10.1000/REAL" } },
      { id: "paper:missing", type: "paper", data: { doi: "10.1000/MISSING" } },
      { id: "paper:no-doi", type: "paper", data: { title: "Not retrievable by DOI" } }
    ]
  };
  const before = JSON.stringify(fixture, null, 2);
  await writeFile(projectPath, before, "utf8");
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    const doi = decodeURIComponent(new URL(request.url, "http://fixture.local").pathname.slice("/works/doi:".length));
    if (doi === "10.1000/missing") {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture source failure" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      id: "https://openalex.org/W1",
      doi: "https://doi.org/10.1000/REAL",
      display_name: "Source-backed work",
      authorships: [
        {
          author_position: "first",
          author: { id: "https://openalex.org/A1", display_name: "A. Researcher" },
          institutions: [{ id: "https://openalex.org/I1", display_name: "Real Fixture Institute", ror: "https://ror.org/01fixture" }],
          raw_affiliation_strings: ["Real Fixture Institute, Test City"]
        },
        {
          author_position: "last",
          author: { id: "https://openalex.org/A2", display_name: "B. Researcher" },
          institutions: [{ id: "https://openalex.org/I1", display_name: "Real Fixture Institute", ror: "https://ror.org/01fixture" }],
          raw_affiliation_strings: ["Real Fixture Institute, Test City"]
        },
        {
          author_position: "middle",
          author: { id: "https://openalex.org/A3", display_name: "No Affiliation Recorded" },
          institutions: []
        }
      ]
    }));
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const args = ["--project", projectPath, "--openalex-base-url", baseUrl, "--timeout", "2"];

  const result = await runPython("find_labs.py", args);
  assert.equal(result.code, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.labs.length, 1);
  assert.equal(parsed.totalCandidates, 1);
  const lab = parsed.labs[0];
  assert.equal(lab.name, "Real Fixture Institute");
  assert.equal(lab.candidateType, "institution-affiliation");
  assert.deepEqual(lab.authors, ["A. Researcher", "B. Researcher"]);
  assert.deepEqual(lab.paperDois, ["10.1000/REAL"]);
  assert.deepEqual(lab.paperNodeIds, ["paper:one", "paper:two"]);
  assert.equal(lab.provenance.length, 2);
  assert.equal(lab.provenance[0].rawAffiliationStrings[0], "Real Fixture Institute, Test City");
  assert.equal(lab.contacted, false);
  assert.equal(lab.contactStatus, "uncontacted");
  assert.deepEqual(lab.price, { kind: "unavailable", note: "OpenAlex authorship metadata does not supply service pricing." });
  assert.equal(parsed.works.length, 1);
  assert.equal(parsed.sources.find((source) => source.id.endsWith("10.1000/missing")).status, "error");
  assert.match(parsed.sources.find((source) => source.id.endsWith("10.1000/missing")).error, /502/);
  assert.equal(requests.length, 2);
  assert.equal(await readFile(projectPath, "utf8"), before);

  const failed = await runPython("find_labs.py", ["--doi", "10.1000/MISSING", "--openalex-base-url", baseUrl, "--timeout", "2"]);
  assert.equal(failed.code, 2);
  assert.deepEqual(JSON.parse(failed.stdout).labs, []);
  assert.match(failed.stderr, /every OpenAlex work request failed/);
});

test("export_journey uses argument arrays and parses renderer manifests without shell interpolation", async (t) => {
  const directory = await temporaryDirectory(t, "export-cli-");
  const root = path.join(directory, "project;touch INJECTED");
  await mkdir(root);
  const fakeNodeScript = path.join(directory, "fake node.py");
  const argumentLog = path.join(directory, "arguments.json");
  await writeFile(fakeNodeScript, `#!/usr/bin/env python3
import json, os, sys
with open(os.environ["ARGUMENT_LOG"], "w", encoding="utf-8") as stream:
    json.dump(sys.argv[1:], stream)
if os.environ.get("FAIL_EXPORT") == "1":
    print("deterministic renderer failure", file=sys.stderr)
    raise SystemExit(4)
print("revision\\t9")
print("html\\t" + sys.argv[2] + "/workspace/exports/research-report.html\\tsha256:" + "a" * 64)
print("pdf\\t" + sys.argv[2] + "/workspace/exports/pdf/research-report.pdf\\tsha256:" + "b" * 64)
print("latex\\t" + sys.argv[2] + "/workspace/exports/latex/main.tex\\tsha256:" + "c" * 64)
print("latex\\t" + sys.argv[2] + "/workspace/exports/latex/references.bib\\tsha256:" + "d" * 64)
`, "utf8");
  let fakeNode = fakeNodeScript;
  if (process.platform === "win32") {
    fakeNode = path.join(directory, "fake node.cmd");
    await writeFile(fakeNode, `@echo off\r\n"${python}" "${fakeNodeScript}" %*\r\n`, "utf8");
  } else {
    await chmod(fakeNodeScript, 0o755);
  }
  const env = { ARGUMENT_LOG: argumentLog };
  const result = await runPython("export_journey.py", [root, "--node", fakeNode], { env });
  assert.equal(result.code, 0, result.stderr);
  const manifest = JSON.parse(result.stdout);
  assert.equal(manifest.revision, 9);
  assert.equal(await realpath(manifest.projectRoot), await realpath(root));
  assert.equal(manifest.files.length, 4);
  assert.deepEqual(manifest.files.map((file) => file.format), ["html", "pdf", "latex", "latex"]);
  assert.equal(manifest.files[0].sha256, "a".repeat(64));
  const invoked = JSON.parse(await readFile(argumentLog, "utf8"));
  assert.equal(await realpath(invoked[0]), await realpath(script("export-project.mjs")));
  assert.equal(await realpath(invoked[1]), await realpath(root));
  assert.equal(await readFile(projectPathForInjection(directory)).catch(() => null), null);

  const failed = await runPython("export_journey.py", [root, "--node", fakeNode], { env: { ...env, FAIL_EXPORT: "1" } });
  assert.equal(failed.code, 4);
  assert.match(failed.stderr, /deterministic renderer failure/);
});

function projectPathForInjection(directory) {
  return path.join(directory, "INJECTED");
}

test("preflight delegates to preflight.mjs, propagates failures, and gives an actionable missing-script error", async (t) => {
  const directory = await temporaryDirectory(t, "preflight-cli-");
  const scripts = path.join(directory, "scripts");
  await mkdir(scripts);
  await writeFile(path.join(scripts, "preflight.py"), await readFile(script("preflight.py"), "utf8"), "utf8");

  const copiedPreflight = path.join(scripts, "preflight.py");
  const missing = await runPython(copiedPreflight, [directory]);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /integrator-owned script/);
  assert.match(missing.stderr, /no substitute checks were run/);

  const preflight = path.join(scripts, "preflight.mjs");
  await writeFile(preflight, `console.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));\n`, "utf8");
  const passed = await runPython(copiedPreflight, [directory]);
  assert.equal(passed.code, 0, passed.stderr);
  const parsedPassed = JSON.parse(passed.stdout);
  assert.equal(await realpath(parsedPassed.cwd), await realpath(directory));
  assert.deepEqual(parsedPassed.args, []);

  await writeFile(preflight, `console.error("deterministic preflight failure"); process.exitCode = 7;\n`, "utf8");
  const failed = await runPython(copiedPreflight, [directory]);
  assert.equal(failed.code, 7);
  assert.match(failed.stderr, /deterministic preflight failure/);
});
