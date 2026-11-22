# Open Research IDE

**Cursor & Claude Code for scientific research — open-source, local-first, harness-agnostic, and auditable.**

---

## Why Open Research IDE Exists

General chat windows like ChatGPT and Claude are great for quick questions—yet serious software engineers still rely on **Cursor**, **Claude Code**, and **CodeRabbit** because real engineering demands persistent workspace state, structured diffs, automated verification, and reproducible builds.

Scientific inquiry faces the exact same gap. Chat threads lose track of which quote came from which paper, silently invent DOIs or experimental outcomes, conflate predictions with results, and stop at walls of unverified prose.

**Our core belief:** Research should not be gated behind institutional silos. A curious student, independent builder, or outsider who has never stepped inside a chemistry lab or published a paper often asks the exact questions domain veterans take for granted. **Open Research IDE** gives *anyone*—across chemistry, AI/ML, software systems, psychology, materials, or economics—a calm, structured environment to move from raw curiosity to peer-reviewed grounding, independent critique, real-world testing, and a credible research dossier.

---

## Key Capabilities

### 1. Harness- & Model-Agnostic (First-Class OpenClaw Default)
Never locked into a single model or agent harness:
- **OpenClaw Gateway (Default Preset):** Works cleanly out of the box with OpenClaw and `cerebras/moonshotai-kimi-k3.1-pro-trial` via one-step setup (`npm run setup` or `./setup.sh`).
- **Direct Standalone Runtime:** Run the complete IDE with **zero external gateway** using any supported provider directly.
- **Any LLM Provider (Per Role):** Configure **Research Orchestrator** and **Independent Review Panel** independently across **Cerebras**, **OpenAI / OpenAI-compatible**, **Anthropic Claude**, **Google Gemini**, **OpenRouter**, or **Local Ollama** in `.env` or the isolated Setup Modal.
- **Zero-Pollution Onboarding:** Credentials and preflight health checks stay strictly inside the isolated Setup Modal and server-side storage (`0600`)—never leaking into the browser or research conversation context.

### 2. Five-Stage Research Workflow (User-Guided + Autonomous Modes)
Choose **User-Guided Mode (default)** to steer every pivot collaboratively, or **Autonomous Investigation** to execute the full arc end-to-end and pause cleanly when real-world test data is required:

1. **Curiosity & Iterative Literature Dialogue:** Open on a calm search screen with a live-fetched strip of recently published peer-reviewed papers (OpenAlex + arXiv). Query real academic APIs (OpenAlex, Semantic Scholar, arXiv), receive concise grounded explanations with streaming live deltas, and push back across unlimited follow-up turns without overwriting prior proof blocks.
2. **Hypothesis, Curation & Independent Review Panel:** Form testable hypotheses alongside a stable, filterable **Knowledge Graph** (React Flow). Highlight exact substrings inside immutable paper abstracts to anchor human-verified evidence (`SHA-256`), confirm/unconfirm/reject passages, and run **3 isolated zero-memory reviewers in parallel**:
   - **Evidence Auditor:** Verifies passage-level citation accuracy and quote integrity.
   - **Methodology Critic:** Challenges assumptions, confounding variables, and missing controls.
   - **Feasibility Reviewer:** Evaluates novelty and practical testability.
3. **Universal Multi-Modal Validation & Testing Workspace:** Adapts to what the science actually requires:
   - **Computational & Code (Python / JS / C++):** Editable experiment code, opt-in sandboxed local runner with captured stdout/stderr, and one-click **Google Colab (`.ipynb`)** export.
   - **Human Surveys & Behavioral Studies:** Structured questionnaires, distribution guidance (free academic/community cohorts vs. Prolific/CloudResearch/MTurk cost framing), **Survey JSON**, and **CSV response templates**.
   - **Physical, Wet-Lab, Hardware & Facilities:** Wired directly to real **OpenAlex authorship/institution/ROR discovery** (`research_find_labs`), never hallucinating labs from memory. Includes outreach email drafts and UI tracking for `contacted` status and verified written `quoted` pricing.
   - **Structured Expected-vs-Observed Results:** `expectedOutcomes` freeze automatically before data arrives; observations import separately with per-metric verdicts (`supports` / `contradicts` / `inconclusive`) and optional CSV upload.
4. **Human-Quality Manuscript Studio:** Synthesizes verified literature, reviews, frozen expectations, and observed data into a structured academic manuscript, then audits prose with an integrated **`Vale` + `avoid-ai-writing` + `humanizer`** style pass to eliminate AI clichés, filler transitions, and monotonous cadence.
5. **Publication & Export Studio:** Deterministically generates four formats from one canonical revision:
   - **Interactive Research Dossier (`HTML`)** — standalone, strict CSP, embedded SVG Knowledge Graph, expected-vs-observed tables, and timeline.
   - **Print-Ready Report (`PDF`)** — Apple-style light print typography with deterministic timestamps.
   - **Academic Manuscript (`main.tex` + `references.bib`)** — clean `@article`/`@inproceedings` entries with zero raw hash dumps.
   - **Complete Archive (`ZIP`)** — `/api/exports/zip` bundling HTML, PDF, LaTeX, BibTeX, and canonical `research-project.json`.

---

## Epistemic Guardrails (What It Never Does)

- Never invents papers, DOIs, quotes, lab facilities, supplier quotes, or experimental results.
- Evidence passages must be literal substrings of immutable stored abstracts (`SHA-256` verified) and stay unverified until explicit human confirmation.
- Frozen `expectedOutcomes` cannot be overwritten when observations arrive (`import_result` creates separate `result` nodes).
- Literature source outages and rate limits remain visible in the UI and exports.
- Run telemetry shows measured elapsed time and **run-average output TPS** only when actual provider token usage exists.

---

## Quick Start

### Requirements
- Node.js **22.19+** and npm
- **Option A (Default):** OpenClaw running locally + Cerebras provider configured
- **Option B (Standalone):** Any API key (Cerebras, OpenAI, Anthropic, Gemini, OpenRouter) or local **Ollama** — no external gateway required
- Optional: Python 3.10+ (local Python experiment runner & optional data CLIs), Playwright Chromium (for PDF export: `npx playwright install chromium`), and [`vale`](https://vale.sh/) CLI (automatically detected for manuscript linting)

### Cross-Platform Setup (macOS, Linux, Windows)
```bash
git clone https://github.com/PurnenduGharami/open-research-ide.git
cd open-research-ide
npm run setup
npm run dev
```

Or on Linux/macOS/WSL2 with OpenClaw:
```bash
chmod +x setup.sh && ./setup.sh
npm run dev
```

Open **http://127.0.0.1:3000** (binds to loopback only by default). Click **Setup** in the top bar to switch between **OpenClaw Gateway** and **Direct Standalone Runtime**, pick providers/models per role, or add optional `OPENALEX_MAILTO` / `SEMANTIC_SCHOLAR_API_KEY` credentials.

---

## Daily Commands

```bash
npm run dev             # Development server (127.0.0.1:3000)
npm run build           # Production build
npm start               # Serve production build
npm run typecheck       # Strict TypeScript check
npm test                # Engine, literature, runtime, platform, export & CLI tests
npm run preflight       # Non-generative harness/provider diagnostics
npm run test:fixture-ui # Clean-clone desktop/mobile Playwright QA (server must be running)
```

---

## Architecture & Trust Boundaries

- **Browser (`app/`, `dashboard/`, `components/`):** Same-origin HTTP & SSE only. Strictly follows our Apple Design System ([DESIGN.md](./DESIGN.md)): `#0066cc` Action Blue accent, `#ffffff` / `#f5f5f7` / `#272729` surface alternation, `#000000` global nav, frosted sub-nav, `SF Pro Display` / `SF Pro Text`, zero decorative gradients, zero card shadows.
- **Next.js Server (`app/api/`, `src/`):** Owns all harness connections (`src/harnesses/harness-adapter.mjs`), LLM provider calls (`src/providers/model-provider.mjs`), server-only secrets (`workspace/runtime-config.json`, `0600`), and same-origin enforcement (`src/server-utils.ts`).
- **Canonical Engine (`plugins/research-engine/engine.mjs`):** Sole writer for multi-project storage under `workspace/projects/<projectId>/project.json` + `index.json` with per-project write queues, `baseRevision` optimistic locking, idempotent `commandIds`, `.bak` backups, atomic temp-file renames, and startup recovery for interrupted runs.

---

## Open-Source Inspirations & Credits

Open Research IDE builds on ideas from and explicitly credits these remarkable open-source projects:

- **[Google `paper-orchestra`](https://github.com/google/paper-orchestra):** Inspired our structured multi-stage manuscript drafting, reflection, and academic LaTeX/BibTeX export pipeline.
- **[Google `elephant-goldfish-model`](https://github.com/google/elephant-goldfish-model):** Inspired our persistent **Research Orchestrator** paired with zero-memory fresh-context **Independent Review Panel** reviewers to prevent confirmation bias.
- **`FOREST`:** Inspired strict separation between canonical typed semantic research-graph state and interactive visual layout.
- **[`Vale`](https://vale.sh/), `avoid-ai-writing`, & `humanizer`:** Inspired our built-in academic prose linter and optional Vale CLI integration to strip AI clichés, filler transitions, and monotonous cadence before publication.

---

## License

Released under the [MIT License](./LICENSE).
