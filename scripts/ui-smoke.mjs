import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const curiosity = "Does twenty minutes of morning outdoor light reduce sleep-onset latency in healthy adults compared with ordinary indoor light?";
const observations = "A separate pilot log recorded a median sleep-onset latency of 18 minutes after the outdoor-light condition and 31 minutes after ordinary indoor light. This import is an observation, not a replacement for the frozen prediction.";
const out = path.resolve("workspace/smoke");

async function project(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/project", { cache: "no-store" });
    if (!response.ok) throw new Error(`Project API ${response.status}`);
    return response.json();
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
await mkdir(out, { recursive: true });

try {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("heading", { name: "Begin with a real question" }).waitFor();
  await page.screenshot({ path: path.join(out, "desktop-empty.png"), fullPage: true });

  await page.getByRole("button", { name: "Check setup" }).click();
  await page.getByText("Configuration checks passed").waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(out, "desktop-setup.png"), fullPage: true });
  await page.getByRole("button", { name: "Close setup" }).click();

  await page.getByLabel("Research curiosity").fill(curiosity);
  await page.getByRole("button", { name: "Start research" }).click();
  const startDeadline = Date.now() + 120000;
  while (Date.now() < startDeadline) {
    const alerts = await page.locator("[role=\"alert\"]").allInnerTexts();
    const fatal = alerts.find((text) => /failed|not allowed/i.test(text));
    if (fatal) throw new Error(fatal.replace(/\s+/g, " "));
    if ((await project(page)).project) break;
    await page.waitForTimeout(1000);
  }
  if (!(await project(page)).project) throw new Error("Research start did not create a canonical project");

  const deadline = Date.now() + 12 * 60 * 1000;
  let snapshot = await project(page);
  while (Date.now() < deadline) {
    snapshot = await project(page);
    const status = snapshot.project?.status;
    const active = (snapshot.runs || []).some((run) => run.status === "running" || run.status === "connecting");
    if (status === "ready" || (status === "error" && !active)) break;
    await page.waitForTimeout(5000);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  snapshot = await project(page);
  await page.screenshot({ path: path.join(out, "desktop-research.png"), fullPage: true });
  if (snapshot.project?.status !== "ready") {
    throw new Error(`Investigation did not become ready: ${snapshot.project?.status || "missing"} ${snapshot.project?.timeline?.at?.(-1)?.message || ""}`);
  }

  const before = snapshot.project;
  const evidence = before.nodes.filter((node) => node.type === "evidence");
  if (!evidence.length || evidence.some((node) => node.data.verified === true)) throw new Error("Evidence was missing or verified before explicit confirmation");
  const experiment = before.nodes.find((node) => node.type === "experiment");
  if (!experiment || !Array.isArray(experiment.data.protocol) || !Array.isArray(experiment.data.expectedOutcomes)) throw new Error("Experiment protocol or frozen outcomes missing");
  const frozen = JSON.stringify(experiment.data.expectedOutcomes);
  const reviewers = new Set(before.nodes.filter((node) => node.type === "review").map((node) => node.data.reviewer));
  if ([...reviewers].sort().join() !== ["auditor", "critic", "feasibility"].sort().join()) {
    throw new Error(`Expected three reviewers, got ${[...reviewers].join(",") || "none"}`);
  }

  await page.getByRole("button", { name: "Confirm evidence" }).first().click();
  await page.getByText("Evidence confirmed").first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Knowledge graph/ }).click();
  await page.locator(".react-flow").waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(out, "desktop-graph.png"), fullPage: true });

  await page.getByRole("button", { name: /^Experiments/ }).click();
  await page.getByLabel("Observed measurements and outcomes").fill(observations);
  await page.getByRole("button", { name: "Import observed results" }).click();
  await page.getByText(observations).waitFor({ timeout: 20000 });

  await page.getByRole("button", { name: /^Published/ }).click();
  await page.getByRole("button", { name: /Export revision/ }).click();
  await page.getByRole("link", { name: /Download Standalone HTML/ }).waitFor({ timeout: 120000 });
  await page.getByRole("link", { name: "references.bib" }).waitFor();
  await page.screenshot({ path: path.join(out, "desktop-export.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Research/ }).click();
  await page.screenshot({ path: path.join(out, "mobile-research.png"), fullPage: true });
  await page.getByRole("button", { name: /Knowledge graph/ }).click();
  await page.screenshot({ path: path.join(out, "mobile-graph.png"), fullPage: true });

  const after = (await project(page)).project;
  const sameExperiment = after.nodes.find((node) => node.id === experiment.id);
  if (JSON.stringify(sameExperiment.data.expectedOutcomes) !== frozen) throw new Error("Imported observations changed frozen expected outcomes");
  if (!after.nodes.some((node) => node.type === "result" && node.data.observations === observations)) throw new Error("Imported observation was not stored separately");
  if (after.exports.length < 4) throw new Error(`Expected four export manifests, got ${after.exports.length}`);
  const sourceRevision = after.exports[0].revision;
  if (!after.exports.every((item) => item.revision === sourceRevision)) throw new Error("Export manifests do not share one source revision");

  const summary = {
    ok: true,
    revision: after.revision,
    papers: after.nodes.filter((node) => node.type === "paper").length,
    evidence: after.nodes.filter((node) => node.type === "evidence").map((node) => ({ verified: node.data.verified === true, doi: after.nodes.find((paper) => paper.id === node.data.paperId)?.data.doi || null })),
    reviewers: [...reviewers],
    labs: after.nodes.filter((node) => node.type === "lab").map((node) => ({ contacted: node.data.contacted === true, priceKind: node.data.price?.kind || null })),
    sources: after.sources.map((source) => ({ provider: source.provider, status: source.status, error: source.error || null })),
    exports: after.exports.map((item) => ({ format: item.format, revision: item.revision, sha256: item.sha256 })),
    runs: after.runs.map((run) => ({ kind: run.kind, status: run.status, outputTokens: run.outputTokens ?? null, outputTps: run.outputTps ?? null, error: run.error || null })),
    consoleErrors,
  };
  await writeFile(path.join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
