<div align="center">

# Open Research IDE

**An open-source, local-first scientific research workspace powered by Google Gemini & Gemma — grounded in peer-reviewed literature, side-by-side contradiction verification, independent critique, and reproducible outputs.**

*Good research starts with curiosity, not credentials. The investigation is the product.*

[![License: MIT](https://img.shields.io/badge/License-MIT-1e4fc2.svg)](./LICENSE)
[![Google Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini%20%26%20Gemma-1e4fc2.svg)](#powered-by-google-ai--cloud)
[![Node.js](https://img.shields.io/badge/Node.js-22.19%2B-111315.svg)](./package.json)
[![Local-First](https://img.shields.io/badge/Runtime-Standalone%20%26%20Cloud%20Run-166534.svg)](#quick-start--deployment)

<br />



https://github.com/user-attachments/assets/40d6cc28-3740-40a0-91f8-fd50fc44c3e9


</div>

---

## Why Open Research IDE Exists

General chat windows are great for isolated questions—yet serious scientific inquiry demands persistent workspace state, exact source provenance, independent verification, real-world testing workflows, and reproducible outputs.

Chat threads lose track of which quote came from which paper, silently invent DOIs or experimental outcomes, conflate predictions with results, and stop at walls of unverified prose.

**Open Research IDE is not an AI paper generator.** The entire lived investigation—every peer-reviewed paper read, contradiction compared side-by-side, hypothesis challenged, and real-world test executed—is the product. A formal manuscript is simply the final output once hypotheses and real evidence come together.

**Our core belief:** Research should not be gated behind institutional silos. A curious student, independent builder, or explorer outside a formal lab often asks the exact questions domain veterans take for granted. Open Research IDE gives *anyone*—across chemistry, AI/ML, software systems, psychology, materials, or economics—a calm, structured environment to move from raw curiosity to peer-reviewed grounding, independent critique, real-world validation, and a credible research dossier.

---

## Powered by Google AI & Cloud

- **Google Gemini API (Default):** Native `v1beta` streaming, tool calling, multi-call turn merging, and thought-signature preservation for `gemini-2.5-flash` and `gemini-2.5-pro`.
- **Google Cloud Vertex AI & Local Gemma 3:** Switch seamlessly between **Google Gemini API**, **Vertex AI**, and offline **Local Gemma 3** (via Ollama) per agent role inside the isolated Setup Modal.
- **Google Colab Export:** One-click `.ipynb` notebook export for computational experiments.
- **Google Antigravity, Firebase App Hosting & Cloud Run Ready:** Includes [`GEMINI.md`](./GEMINI.md), [`.agents/skills/deploy-google-cloud/SKILL.md`](./.agents/skills/deploy-google-cloud/SKILL.md), [`apphosting.yaml`](./apphosting.yaml), [`firebase.json`](./firebase.json), and [`Dockerfile`](./Dockerfile) — zero external daemon required.

---

## Five-Stage Research Workflow

Choose **Guided Research (default)** to steer every pivot collaboratively, or **Autonomous Investigation** to execute the full arc end-to-end and pause cleanly when real-world test data is required. You can also click **Explore Sample Investigation** on the home screen to try a full walkthrough without an API key.

| Stage | What Happens | Epistemic Guarantee |
| :--- | :--- | :--- |
| **1. Ideation, Task Tracker & Literature Dialogue** | Organize ideas, stage-tagged research milestones, direct OpenAlex/Semantic Scholar/arXiv queries (or `.bib`/`.ris`/PDF uploads), and optional Gemini multi-turn dialogue. | Works 100% locally even without an AI API key; real academic APIs only. |
| **2. Files, Notebooks & Full-Text PDF Screening** | VS Code-style Explorer sidebar (`Ctrl+K` / `Ctrl+B`), CodeMirror 6 + KaTeX Markdown notebooks with `[[wikilinks]]`, PRISMA screening tags, OpenAlex retraction alerts, and Citation Snowballing. | Extracted PDF pages (`unpdf`/PDF.js) and abstracts are immutable; quotes use exact `SHA-256` substring anchoring and require human confirmation. |
| **3. Contradictions, Competing Hypotheses & Review Panel** | Compare conflicting studies side-by-side in 1 click, score `Evidence × Hypotheses` (`H1` vs. `H2`), and run 3 zero-memory independent reviewers (**Auditor**, **Critic**, **Feasibility**). | `0` shared conversation tokens across reviewers so confirmation bias never creeps in. |
| **4. Computational & Statistical Figure Studio** | Write & run code (or export Google Colab `.ipynb`), run CSV descriptive stats, Welch's two-sample `t`-tests, Pearson regression, power calculators, and save publication SVG plots to `figures/`. | Pre-registered `expectedOutcomes` freeze before testing; observations import separately (`supports` / `contradicts` / `inconclusive`). |
| **5. Overleaf-Class Manuscript & RO-Crate 1.1 Archive** | Split-pane CodeMirror + KaTeX composer with live Citation.js bibliographies (APA, IEEE, Vancouver, Harvard), claim-level citation checks, Vale prose audit, and round-trip bundle import/verification. | One canonical revision compiles deterministically to **HTML**, **PDF**, **Article/IEEE/NeurIPS/Nature LaTeX**, `ro-crate-metadata.json`, and **ZIP**. |

---

## Epistemic Guardrails (What It Never Does)

- Never invents papers, DOIs, quotes, lab facilities, supplier quotes, or experimental results.
- Evidence passages must be literal substrings of immutable stored abstracts (`SHA-256` verified) and stay unverified until explicit human confirmation.
- Frozen `expectedOutcomes` cannot be overwritten when observations arrive (`import_result` creates separate `result` nodes).
- Literature source outages and rate limits remain visible in the UI and exports.
- Run telemetry shows measured elapsed time and **run-average output TPS** only when actual provider token usage exists.

---

## Quick Start & Deployment

### 1. Run Locally (Zero External Daemon Required)
Requires **Node.js 22.19+** and a free [Google AI Studio API key](https://aistudio.google.com/apikey) (or click **Explore Sample Investigation** in the UI without a key).

```bash
git clone https://github.com/PurnenduGharami/open-research-ide.git
cd open-research-ide
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000** and click **Setup** in the top bar to paste your `GEMINI_API_KEY`, configure **Vertex AI** or **Local Gemma 3**, or add optional `OPENALEX_MAILTO` / `SEMANTIC_SCHOLAR_API_KEY` credentials.

### 2. Deploy to Firebase App Hosting
```bash
npx -y firebase-tools@latest apphosting:secrets:set GEMINI_API_KEY
npx -y firebase-tools@latest apphosting:secrets:grantaccess GEMINI_API_KEY --backend open-research-ide
npm run deploy:firebase
```

### 3. Deploy to Google Cloud Run
```bash
gcloud run deploy open-research-ide \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars RESEARCH_HARNESS=standalone,RESEARCH_PROVIDER=gemini,RESEARCH_MODEL=gemini-2.5-flash,RESEARCH_REVIEW_PROVIDER=gemini,RESEARCH_REVIEW_MODEL=gemini-2.5-flash \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

See [`.agents/skills/deploy-google-cloud/SKILL.md`](./.agents/skills/deploy-google-cloud/SKILL.md) for Antigravity-guided deployment steps.

---

## Daily Commands

```bash
npm run dev             # Development server (127.0.0.1:3000)
npm run build           # Production build
npm start               # Serve production build
npm run typecheck       # Strict TypeScript check
npm test                # Engine, literature, runtime, platform, export & CLI tests
npm run preflight       # Non-generative Gemini & runtime diagnostics
npm run test:fixture-ui # Desktop/mobile Playwright QA (server must be running)
```

---

## Architecture & Trust Boundaries

- **Browser (`app/`, `dashboard/`, `components/`):** Same-origin HTTP & SSE only. Editorial scientific workspace palette (`#fcfcfb` warm paper canvas, `#111315` ink, `#1e4fc2` cobalt accent) with `Instrument Serif`, `Inter`, and `IBM Plex Mono` (`app/globals.css`, `app/layout.tsx`).
- **Next.js Server (`app/api/`, `src/`):** Direct Standalone Runtime (`src/harnesses/harness-adapter.mjs`), native Google Gemini / Vertex AI / Local Gemma provider (`src/providers/model-provider.mjs`), server-only secrets (`workspace/runtime-config.json`, `0600`), and proxy-aware same-origin enforcement (`src/server-utils.ts`).
- **Canonical Engine (`plugins/research-engine/engine.mjs`):** Sole writer for multi-project storage under `workspace/projects/<projectId>/project.json` + `index.json` with per-project write queues, `baseRevision` optimistic locking, idempotent `commandIds`, `.bak` backups, atomic temp-file renames, and startup recovery for interrupted runs.

---

## Open-Source Inspirations & Credits

- **[Google `paper-orchestra`](https://github.com/google/paper-orchestra):** Inspired our structured multi-stage manuscript drafting, reflection, and academic LaTeX/BibTeX export pipeline.
- **[Google `elephant-goldfish-model`](https://github.com/google/elephant-goldfish-model):** Inspired our persistent **Research Orchestrator** paired with zero-memory fresh-context **Independent Review Panel** reviewers to prevent confirmation bias.
- **`FOREST`:** Inspired strict separation between canonical typed semantic research-graph state and interactive visual layout.
- **[`Vale`](https://vale.sh/), `avoid-ai-writing`, & `humanizer`:** Inspired our built-in academic prose linter and optional Vale CLI integration before publication.

---

## License

Released under the [MIT License](./LICENSE).
