# Open Research IDE

**Claude Code for academic research — free, local-first, and auditable.**

Open Research IDE turns a scientific curiosity into a lived investigation instead of a one-shot generated paper. A dedicated **Elephant** orchestrator uses real OpenAlex and Semantic Scholar records; three fresh, isolated **Goldfish** reviewers audit evidence, challenge reasoning, and assess feasibility. The canonical research state drives the literature view, React Flow knowledge graph, inspector, telemetry, experiment/lab bridge, and exports.

## What it does not do

- It does not invent papers, DOIs, quotations, reviews, laboratory contacts, prices, or experimental results.
- An evidence passage is not marked verified until a researcher explicitly confirms its exact abstract excerpt.
- Lab suggestions are uncontacted unless a real contacted status is supplied. Model estimates are never supplier quotes.
- Imported observations are separate from frozen expected outcomes; a result cannot silently rewrite a prediction.
- Source outages and rate limits remain visible in the investigation.

## Requirements

- Linux/macOS or WSL2
- Node.js 22.19+ and npm
- OpenClaw 2026.11.6+ running locally
- A Cerebras provider configuration in OpenClaw with access to `moonshotai-kimi-k3.1-pro-trial`
- Python 3.10+ only for the optional data-script CLIs
- Playwright Chromium for PDF and browser checks (`npx playwright install chromium` if not already installed)

## Setup

```bash
git clone <your-fork-url> open-research-ide
cd open-research-ide
chmod +x setup.sh
./setup.sh
npm run dev
```

Open **http://127.0.0.1:3000**. The Next.js server binds to loopback by default. Do not expose it publicly without adding authentication and transport security.

`setup.sh` installs locked dependencies, preserves existing `.env` credentials, discovers the local Gateway token without printing it, and idempotently configures only the research plugin and these agents:

- `research` — Elephant, with only the three research tools allowed
- `research-auditor` — evidence auditor, all tools denied
- `research-critic` — scientific critic, all tools denied
- `research-feasibility` — feasibility reviewer, all tools denied

Existing unrelated OpenClaw configuration and the existing default agent are preserved. The shared model is `cerebras/moonshotai-kimi-k3.1-pro-trial`; reasoning is off by default.

If Cerebras is not configured, configure that provider in OpenClaw first. The app's setup dialog performs a non-generative preflight; it does not create a research session.

## Daily commands

```bash
npm run dev          # development server, loopback only
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # strict TypeScript validation
npm test             # canonical writer, literature, runtime, export, and script tests
npm run preflight    # non-generative Gateway/model/agent diagnostics
npm run test:ui      # desktop/mobile browser checks (server must be running)
```

### Optional data CLIs

```bash
python3 scripts/preflight.py
python3 scripts/search_papers.py --help
python3 scripts/find_labs.py --help
python3 scripts/export_journey.py --help
node scripts/export-project.mjs
```

## Research workflow

1. Open **Setup** and run preflight. This checks the local connection, model inventory, and four agents without generating text.
2. Enter a specific curiosity. This is the only action that creates a research session and canonical project.
3. Elephant searches concise scientific keywords, records normalized papers and immutable abstract snapshots, and anchors evidence as exact abstract substrings with SHA-256 hashes.
4. Inspect the graph and right-hand inspector. Click an evidence node, compare its quotation with the source abstract, and explicitly confirm it.
5. The runtime launches three unique, zero-memory Goldfish sessions in parallel. Each receives only a bounded hypothesis/artifact/raw-abstract packet. Only Elephant/plugin code commits their structured findings.
6. Elephant synthesizes an experiment protocol, frozen expected outcomes, honest lab options, and an outreach draft. Drafts are not sent automatically.
7. Import actual observations separately. Predictions remain unchanged.
8. Export the same canonical revision to interactive standalone HTML, print-derived PDF, and LaTeX (`main.tex` + `references.bib`).

## Architecture and trust boundaries

- **Browser:** same-origin HTTP and SSE only. No Gateway token, Cerebras key, or direct provider connection.
- **Next.js Node server:** owns the authenticated OpenClaw Gateway WebSocket and all mutations requested by the UI.
- **`plugins/research-engine`:** sole writer of `workspace/research-project.json`; revision checks, command idempotency, serialized writes, backup, validation, and same-directory atomic rename.
- **`workspace/research-project.json`:** canonical typed nodes, semantic edges, UI blocks, source failures, runs/usage, timeline, assets, and export manifests.
- **Goldfish:** fresh agent session per review, no personal/cross-session memory, no tools, bounded evidence packet, no direct canonical writes.

`.env`, live canonical state, backups, generated assets, exports, and test artifacts are gitignored. Keep `CEREBRAS_API_KEY` and Gateway tokens out of `NEXT_PUBLIC_*`, logs, prompts, exports, and commits.

## Rate limits and honest telemetry

Research prompts are bounded. At most three review calls run concurrently, with basic 429 backoff for Cerebras's **100 RPM / 100K TPM** limits. Stopwatch values use measured elapsed time. Output TPS is shown only when actual provider output-token usage and duration exist, and is labelled **run-average output TPS**—not a fabricated live token counter.

## Project map

- `context/SPEC.md`, `context/DESIGN.md` — locked product and design contracts
- `packages/contracts` — shared TypeScript canonical types
- `plugins/research-engine` — real literature retrieval and sole canonical writer
- `agents` — Elephant and Goldfish operating instructions
- `src/gateway.mjs`, `src/research-runtime.mjs` — Gateway and investigation/review runtime
- `app` — Next.js routes, same-origin APIs, and SSE
- `dashboard`, `components` — Operate UI, graph, inspector slots, and export views
- `src/export-renderer.mjs` — deterministic standalone HTML/PDF/LaTeX renderer
- `scripts` — setup, preflight, data, export, and verification CLIs

See `HANDOFF.md` for the exact verification record and any remaining limitations.
