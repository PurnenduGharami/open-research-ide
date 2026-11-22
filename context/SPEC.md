# Open Research IDE — Locked MVP Specification

## Product
An open-source, local-first scientific research IDE: **Claude Code for academic research — free**. The lived investigation is the product, not a generated paper. OpenClaw executes a dedicated Elephant orchestrator and three isolated Goldfish reviewers; Cerebras serves `moonshotai-kimi-k3.1-pro-trial`, reasoning off by default.

## End-to-end arc
1. An isolated native setup dialog validates server-side Cerebras and Gateway configuration without creating a research session.
2. A curiosity starts a dedicated research session. Elephant retrieves real OpenAlex and Semantic Scholar literature and writes normalized papers, immutable abstract snapshots, exact evidence passages, contradictions, gaps, and hypotheses.
3. A React Flow graph and right inspector derive from the same canonical revision. Evidence remains unverified until a deterministic human confirmation command.
4. Three zero-memory Goldfish agents (Auditor, Critic, Feasibility) receive only the artifact and raw abstracts, run at most three in parallel, and return structured findings. They never write project JSON directly.
5. Elephant produces an experiment with protocol, frozen expected outcomes, lab options, honest price claims, and an outreach draft. Results are imported separately and never overwrite predictions.
6. One click exports the same state as standalone interactive HTML, print-derived PDF, and `main.tex` + `references.bib`.

## Architecture
- Next.js Node server uses the official Gateway WebSocket client for sessions/chat/tool/lifecycle events. The browser uses same-origin HTTP and SSE only.
- `plugins/research-engine` is the sole writer of `workspace/research-project.json`: per-process queue, `baseRevision` checks, idempotent command IDs, validation, backup, same-directory atomic rename.
- The canonical state contains normalized nodes, typed semantic edges, ordered UI blocks with stable IDs, runs/usage, timeline events, hashed asset metadata, and export manifests.
- The app SSE stream carries assistant deltas, run state, and full project snapshots. It never parses markdown to manufacture research counters.
- API keys and bearer tokens remain server-side and are excluded from state, logs, prompts, UI, and exports. `.env` is gitignored.
- Live telemetry uses measured elapsed time. TPS is shown only from actual provider usage and labelled as run-average output TPS; otherwise it is honestly unavailable.

## UI
Apple-inspired light Operate surface: white/soft-gray, hairline borders, crisp typography, muted status colors, no dark neon or purple gradients. The Research canvas receives the polish. Library, Experiments, Knowledge Graph, and Published are lightweight filtered projections of canonical state.

## MVP boundaries
No Remotion video, GROBID, SPECTER2, Phoenix, mandatory PaperQA2, Conda, CRDTs, full event sourcing, formal auth registry, cross-language locator engine, or silent mocks. Standard substring anchoring plus SHA-256 is sufficient for v0.1. Use concise prompts and basic 429 backoff; respect 100 RPM / 100K TPM.

## Acceptance
- Real query returns real papers and DOIs when sources supply them; source failures are visible.
- Curiosity → literature → graph → parallel reviews → experiment/labs → result → exports works without state drift.
- All exports are non-empty and reflect the live project revision.
- `npm run typecheck`, `npm run build`, unit tests, live smoke test, and desktop/mobile browser checks run; rough edges are recorded in `HANDOFF.md`.
