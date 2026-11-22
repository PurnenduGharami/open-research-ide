<div align="center">

# Open Research IDE

**Cursor & Claude Code for scientific research — open-source, local-first, harness-agnostic, and auditable.**

*Good research starts with curiosity, not credentials. The investigation is the product.*

[![License: MIT](https://img.shields.io/badge/License-MIT-1e4fc2.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.19%2B-111315.svg)](./package.json)
[![Local-First](https://img.shields.io/badge/Storage-Local--First-166534.svg)](#architecture--trust-boundaries)
[![Model-Agnostic](https://img.shields.io/badge/Models-OpenClaw%20%7C%20Cerebras%20%7C%20Any%20LLM-525760.svg)](#1-harness---model-agnostic-first-class-openclaw-default)

<br />

<!--
  To enable GitHub's native inline video player:
  1. Open README.md in the GitHub web editor.
  2. Drag and drop your MP4 (< 10 MB) here.
  3. Replace the preview image line below with the GitHub user-attachments URL.
-->
![Open Research IDE — Overview](./docs/open-research-ide-launch-web.mp4)

</div>

---

## Why Open Research IDE Exists

General chat windows like ChatGPT and Claude are great for isolated questions—yet serious software engineers rely on **Cursor**, **Claude Code**, and **CodeRabbit** because real engineering demands persistent workspace state, structured diffs, independent verification, and reproducible builds.

Scientific inquiry faces the exact same gap. Chat threads lose track of which quote came from which paper, silently invent DOIs or experimental outcomes, conflate predictions with results, and stop at walls of unverified prose.

**Open Research IDE is not an AI paper generator.** The entire lived investigation—every peer-reviewed paper read, contradiction uncovered, hypothesis challenged, and real-world test executed—is the product. A formal manuscript is simply the final output once hypotheses and real evidence come together.

**Our core belief:** Research should not be gated behind institutional silos. A curious student, independent builder, or outsider who has never stepped inside a wet lab or published a paper often asks the exact questions domain veterans take for granted. Open Research IDE gives *anyone*—across chemistry, AI/ML, software systems, psychology, materials, or economics—a calm, structured environment to move from raw curiosity to peer-reviewed grounding, independent critique, real-world validation, and a credible research dossier.

---

## Five-Stage Research Workflow

Choose **User-Guided Mode (default)** to steer every pivot collaboratively, or **Autonomous Investigation** to execute the full arc end-to-end and pause cleanly when real-world test data is required.

| Stage | What Happens | Epistemic Guarantee |
| :--- | :--- | :--- |
| **1. Curiosity & Literature Dialogue** | Calm search entry (*"What are you curious about?"*) with a live strip of recent papers (OpenAlex + arXiv) and multi-turn peer-reviewed dialogue (OpenAlex, Semantic Scholar, arXiv). | Real academic APIs only; prior proof blocks stay intact across turns. |
| **2. Knowledge Graph & Evidence Anchoring** | Interactive React Flow graph linking papers, contradictions, gaps, and hypotheses alongside immutable stored abstracts. | Highlighted passages must be exact substrings (`SHA-256` hashed) and remain unverified until human confirmation. |
| **3. Independent Review Panel** | Three isolated zero-memory reviewers (**Evidence Auditor**, **Methodology Critic**, **Feasibility Reviewer**) audit every hypothesis in parallel. | `0` shared conversation tokens so confirmation bias never creeps in. |
| **4. Universal Validation Workspace** | Adapts to the science: runnable **Code / Colab**, **Human Surveys**, or **Real Labs & Facilities** (via OpenAlex/ROR metadata). | `expectedOutcomes` freeze automatically before observations arrive; results import separately (`supports` / `contradicts` / `inconclusive`). |
| **5. Manuscript & Living Exports** | Synthesizes verified literature, reviews, and real data, runs a prose linter (`Vale` + `avoid-ai-writing` + `humanizer`), and compiles exports. | One canonical `research-project.json` compiles deterministically to **Interactive HTML Dossier**, **PDF**, **LaTeX/BibTeX**, and **ZIP**. |

### Multi-Modal Validation Details

- **Computational & Code (Python / JS / C++):** Editable experiment code, opt-in sandboxed local runner with captured `stdout`/`stderr`, and one-click **Google Colab (`.ipynb`)** export.
- **Human Surveys & Behavioral Studies:** Structured questionnaires, distribution guidance (free academic/community cohorts vs. Prolific/CloudResearch/MTurk cost framing), **Survey JSON**, and **CSV response templates**.
- **Physical, Wet-Lab, Hardware & Facilities:** Wired directly to real **OpenAlex authorship/institution/ROR discovery** (`research_find_labs`), never hallucinating labs from memory. Includes outreach email drafts and UI tracking for `contacted` status and verified written `quoted` pricing.

### Publication & Export Formats (From One Source of Truth)

- **Interactive Research Dossier (`HTML`)** — standalone, strict CSP, embedded SVG Knowledge Graph, expected-vs-observed tables, and timeline.
- **Print-Ready Report (`PDF`)** — light editorial print typography with deterministic timestamps.
- **Academic Manuscript (`main.tex` + `references.bib`)** — clean `@article`/`@inproceedings` entries with zero raw hash dumps.
- **Complete Archive (`ZIP`)** — `/api/exports/zip` bundling HTML, PDF, LaTeX, BibTeX, and canonical `research-project.json`.

---

## Key Capabilities

### 1. Harness- & Model-Agnostic (First-Class OpenClaw Default)
Never locked into a single model or agent harness:
- **OpenClaw Gateway (Default Preset):** Works out of the box with OpenClaw and `cerebras/moonshotai-kimi-k3.1-pro-trial` via one-step setup (`npm run setup` or `./setup.sh`).
- **Direct Standalone Runtime:** Run the complete IDE with **zero external gateway** using any supported provider directly.
- **Any LLM Provider (Per Role):** Configure **Research Orchestrator** and **Independent Review Panel** independently across **Cerebras**, **OpenAI / OpenAI-compatible**, **Anthropic Claude**, **Google Gemini**, **OpenRouter**, or **Local Ollama** in `.env` or the isolated Setup Modal.
- **Zero-Pollution Onboarding:** Credentials and preflight health checks stay strictly inside the isolated Setup Modal and server-side storage (`0600`)—never leaking into the browser or research conversation context.

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

- **Browser (`app/`, `dashboard/`, `components/`):** Same-origin HTTP & SSE only. Editorial scientific workspace palette (`#fcfcfb` warm paper canvas, `#111315` ink, `#1e4fc2` cobalt accent) with `Instrument Serif`, `Inter`, and `IBM Plex Mono` (`app/globals.css`, `app/layout.tsx`).
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
