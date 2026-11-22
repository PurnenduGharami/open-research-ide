# Open Research IDE workflow

This repository runs a local-first investigation through the real OpenClaw Gateway. It does not provide a fake model fallback or an automatic project-creation shortcut.

## Configure and verify

From the repository root:

```bash
npm install
node scripts/bootstrap-env.mjs
# Add CEREBRAS_API_KEY to .env if it is not already configured in OpenClaw.
node scripts/configure-openclaw.mjs
npm run preflight
```

`bootstrap-env.mjs` writes local Gateway settings to `.env` without printing the token. `configure-openclaw.mjs` registers `plugins/research-engine` and the four dedicated agents: `research`, `research-auditor`, `research-critic`, and `research-feasibility`. Elephant must have allow-only access to `research_literature_search`, `research_project_read`, and `research_project_commit`; do not add `deny: ["*"]`, because deny takes precedence over allow. Each Goldfish agent denies all tools. All four use `cerebras/moonshotai-kimi-k3.1-pro-trial` with reasoning off.

Preflight is non-generative: it inspects Gateway status, configured agents, and the `models.list` RPC. It creates neither a session nor a project.

## Run the IDE

```bash
npm run dev
```

Open `http://127.0.0.1:3000`. Only an explicit curiosity submission calls `startInvestigation`. That is the sole application path that creates the canonical `workspace/research-project.json` and OpenClaw sessions.

The runtime then:

1. Starts Elephant's literature turn. Elephant searches real OpenAlex and Semantic Scholar records, records source failures, and commits normalized papers, raw abstract snapshots, exact unverified evidence, genuine contradictions, gaps, and one hypothesis.
2. Reads fresh canonical state and creates three unique, fresh Goldfish sessions in parallel. Each receives only the hypothesis, relevant analysis/evidence artifacts, and whole raw abstracts within a bounded packet. Goldfish sessions have no tools, memory, forked context, or canonical write access.
3. Parses their JSON responses, including fenced or prose-wrapped JSON. Elephant/plugin writes alone commit review nodes, packet hashes, session/run provenance, and visible parse or invocation failures.
4. Starts Elephant's bounded second turn in the original research session to commit the protocol, frozen expected outcomes, honest lab candidates, and outreach draft.
5. Emits assistant deltas, run state, and full snapshots from real canonical state. Canonical runs include measured duration and actual provider usage; run-average output TPS is absent when output usage is unavailable.

`stopInvestigation(sessionKey, runId?)` aborts only the dedicated Elephant and reviewer sessions for that investigation. A stopped or failed run persists `error` state rather than claiming synthesis completed.

## Verify and export

```bash
node --test tests/engine.test.mjs tests/literature.test.mjs tests/runtime.test.mjs
npm run typecheck
npm run build
npm run preflight
```

Unit runtime tests mock the Gateway boundary; they do not make model calls. A deliberate live smoke test is separate and requires preflight to pass.

Export the current canonical revision:

```bash
node scripts/export-project.mjs "$PWD"
```

The exporter writes standalone interactive HTML, print-derived PDF, `main.tex`, and `references.bib` under `workspace/exports/`. Results are imported separately through the application and never replace frozen predictions. Evidence remains unverified until the deterministic human confirmation command.
