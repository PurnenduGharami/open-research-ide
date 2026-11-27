# Open Research IDE — Antigravity Workspace Guide

**Open Research IDE** is an open-source, local-first scientific research environment powered by **Google Gemini** (`gemini-2.5-flash` / `gemini-2.5-pro`), **Vertex AI**, and **Local Gemma 3**, with zero external daemon dependencies.

## Architecture & Key Paths
- **IDE Shell & Views:** `app/AppClient.tsx`, `dashboard/ResearchDashboard.tsx`, `dashboard/FilesWorkspace.tsx`, `dashboard/LiteratureWorkspace.tsx`, `dashboard/PlanningPanels.tsx`, `dashboard/TestingWorkspace.tsx`, `dashboard/StatsWorkbench.tsx`, `dashboard/ManuscriptStudio.tsx`, `components/WorkspaceSidebar.tsx`, `components/CommandPalette.tsx`, `components/CodeEditor.tsx`, `components/MarkdownMathPreview.tsx`, `components/KnowledgeGraph.tsx`, `components/ExportPanel.tsx`
- **Google Gemini Runtime & Providers:** `src/providers/model-provider.mjs`, `src/harnesses/harness-adapter.mjs`, `src/runtime-config.mjs`
- **Canonical State & Scientific Engines:** `plugins/research-engine/engine.mjs` (multi-project queue, `SHA-256` abstract & full-text anchoring, tasks, ideas, hypothesis matrix), `plugins/research-engine/literature.mjs` (OpenAlex, Semantic Scholar, arXiv, snowballing, retraction flags), `src/workspace-files.mjs`, `src/citations.mjs` (Citation.js), `src/pdf-engine.mjs` (`unpdf`), `src/stats-engine.mjs` (`simple-statistics` & SVG charts), `src/diagnostics.ts`, `src/bundle-io.mjs` (RO-Crate ZIP import/verify)
- **Exports & Sample:** `src/export-renderer.mjs` (HTML, PDF, Article/IEEE/NeurIPS/Nature LaTeX, RO-Crate 1.1 JSON-LD, ZIP), `src/contradictions.ts`, `src/sample-project.mjs`

## Epistemic Guardrails
- Never fabricate DOIs, papers, quotes, labs, prices, or experimental outcomes.
- Evidence quotes must be exact substrings of immutable paper abstracts (`SHA-256` verified) and start unverified until explicit human confirmation.
- Frozen `expectedOutcomes` cannot be overwritten by `import_result`.

## Common Commands
- Local setup & dev: `npm run setup && npm run dev`
- Checks: `npm run typecheck && npm test && npm run build`
- Health endpoint: `GET /api/health`
- Cloud deploy skill: `.agents/skills/deploy-google-cloud/SKILL.md`
