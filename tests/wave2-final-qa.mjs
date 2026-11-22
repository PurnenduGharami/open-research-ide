import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const targetId = "evidence:openalex:W3215270220";
const quote = "Previous studies have investigated caffeine (CAF) and taurine (TAU) in isolation and combined during exercise in males.";
const errors = [];
const checks = [];

async function project(page) {
  const response = await page.request.get(`${base}/api/project`);
  assert.equal(response.status(), 200);
  return (await response.json()).project;
}

async function assertNoOverflow(page, view, viewport) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dimensions.html <= dimensions.innerWidth, `${viewport} ${view} html overflow: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.body <= dimensions.innerWidth, `${viewport} ${view} body overflow: ${JSON.stringify(dimensions)}`);
  checks.push(`${viewport} ${view}: no horizontal page overflow`);
}

async function selectAndCloseInspector(page, mobile) {
  const dialog = page.getByRole("dialog", { name: "Research node inspector" });
  await dialog.waitFor({ state: "visible" });
  assert.equal(await dialog.evaluate((node) => node.open), true);
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && viewport && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width, `Inspector is off-screen: ${JSON.stringify(bounds)}`);
  if (mobile) {
    assert.equal(await dialog.getAttribute("data-modal"), "true");
    await dialog.getByRole("button", { name: "Close inspector" }).click();
    assert.equal(await page.locator(".ori-inspector").evaluate((node) => node.open), false);
  } else {
    assert.equal(await dialog.getAttribute("data-modal"), "false");
    assert.equal(Math.round(bounds.width), 304);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const testCase of [
    { name: "desktop 1440x1000", width: 1440, height: 1000, mobile: false },
    { name: "mobile 390x844", width: 390, height: 844, mobile: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${testCase.name} pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${testCase.name} console: ${message.text()}`);
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /caffeine/i }).first().waitFor();
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
    await page.getByRole("navigation", { name: "Research views" }).waitFor();
    assert.equal(await page.getByLabel("Research curiosity").count(), 1);
    const composer = page.getByLabel("Research curiosity");
    await composer.fill("UI composer state check only; do not submit.");
    assert.equal(await page.getByRole("button", { name: "Start research" }).isEnabled(), true);
    await composer.clear();
    assert.equal(await page.getByRole("button", { name: "Start research" }).isDisabled(), true);
    checks.push(`${testCase.name} Research: reduced motion and native labelled composer`);

    const canonical = await project(page);
    const evidence = canonical.nodes.filter((node) => node.type === "evidence");
    const verified = evidence.filter((node) => node.data.verified === true);
    assert.equal(canonical.revision, 21);
    assert.equal(evidence.length, 12);
    assert.deepEqual(verified.map((node) => node.id), [targetId]);
    assert.equal(verified[0].data.quote, quote);
    assert.equal(evidence.filter((node) => node.id !== targetId && node.data.verified).length, 0);
    const confirmedItem = page.locator(".ori-evidence-list li").first();
    assert.equal(await confirmedItem.locator("blockquote").textContent(), quote);
    assert.match(await confirmedItem.innerText(), /Confirmed/);
    assert.equal(await confirmedItem.getByRole("button", { name: "Confirm evidence" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Confirm evidence" }).count(), 11);
    await confirmedItem.locator(".ori-node-link").click();
    await selectAndCloseInspector(page, testCase.mobile);
    await assertNoOverflow(page, "Research", testCase.name);
    checks.push(`${testCase.name} Research: exact quote, 1 verified / 11 unverified, inspector and composer states`);

    await page.getByRole("button", { name: /Knowledge graph/ }).click();
    await page.locator(".react-flow").waitFor();
    assert.equal(canonical.nodes.length, 30);
    assert.ok(await page.locator(".react-flow__node").count() > 0);
    const graphNode = page.locator(".react-flow__node").first();
    const graphNodeTitle = (await graphNode.getAttribute("aria-label")).split(": ").slice(1).join(": ");
    await graphNode.click();
    await page.getByRole("dialog", { name: "Research node inspector" }).getByRole("heading", { name: graphNodeTitle, exact: true }).waitFor();
    await selectAndCloseInspector(page, testCase.mobile);
    await assertNoOverflow(page, "Graph", testCase.name);
    checks.push(`${testCase.name} Graph: 30 canonical nodes, rendered navigation and inspector states`);

    await page.getByRole("button", { name: /^Published/ }).click();
    await page.getByRole("heading", { name: "Faithful exports" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Export revision 21" }).isEnabled(), true);
    const integrity = await page.locator(".exp-evidence-summary").innerText();
    assert.match(integrity, /Verified evidence\s*1 of 12/);
    assert.match(integrity, /Unverified evidence\s*11/);
    await assertNoOverflow(page, "Published", testCase.name);
    checks.push(`${testCase.name} Published: navigation, export state, 1 verified / 11 unverified`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, revision: 21, evidence: { verified: 1, unverified: 11, total: 12, targetId, quoteUnchanged: true }, errors, checks }, null, 2));
} finally {
  await browser.close();
}
