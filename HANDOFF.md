# Handoff — Open Research IDE

Status on 2026-11-22: Wave 1 completed the required live generative workflow and created the first git checkpoint. The app source builds cleanly; remaining items are evidence confirmation, final responsive verification on the new state, and external/scientific limitations—not an incomplete generative pipeline.

## Verified

- `npm test`: PASS. `npm run typecheck`: PASS. `npm run build`: PASS. Logs are under `.scratch/last-test.log`, `.scratch/last-typecheck.log`, and `.scratch/last-run.log`.
- One accepted Cerebras investigation used `cerebras/moonshotai-kimi-k3.1-pro-trial` for exactly two completed Elephant runs and three completed, distinct fresh Goldfish sessions. No Cerebras `429 queue_exceeded` occurred.
- Live curiosity: “Does acute caffeine supplementation at 3 mg/kg improve repeated-sprint performance in trained team-sport athletes compared with placebo?”
- Canonical `workspace/research-project.json` is r20: 30 nodes, 25 valid semantic edges, one hypothesis, three reviews, one proposed experiment, two lab candidates, and one separately imported honest workflow-check result.
- Expected outcomes and their freeze timestamp are byte-identical before and after result import. The result explicitly says no participants/intervention/measured outcomes exist and is not scientific evidence.
- HTML, PDF, `main.tex`, and `references.bib` are nonempty and match manifest hashes and shared source r19. Recording manifests advanced canonical state to r20; the UI labels downloads `r19` and correctly says r20 is not yet exported.
- Browser console/page errors after export: zero. Detailed live-run evidence is in `.scratch/reports/live-investigation.md`.

## Remaining gaps

- Evidence is intentionally unconfirmed: 0 of 12 passages verified. No deterministic confirmation was performed in Wave 1.
- Semantic Scholar returned HTTP 429; this investigation's literature is OpenAlex-only. Do not invent substitute records.
- Provider usage was absent, so run-average output TPS remains unavailable/blank.
- The experiment is proposed, not run. Labs are model-suggested and unverified; no outreach or prices exist. Reviewers left power/sample-size, endpoint thresholds, exposure/blinding controls, safety, and cost work before real execution.
- The prior partial states remain recoverable under `workspace/smoke/`. No scientific conclusion should be drawn from the workflow-check result.

## Exact next wave (Wave 2)

1. On the existing r20 project, deterministically confirm exactly one exact-quote evidence passage through the UI; assert its quote is unchanged, only that passage becomes verified, and the other 11 remain unverified.
2. Re-run desktop 1440×1000 and mobile 390×844 checks on Research, Graph, and Published; assert no horizontal overflow, working inspector/navigation/composer states, and zero final-pass console errors. Restart the loopback production server with `npm start` only if needed to serve the verified build.
3. Run `npm test`, `npm run typecheck`, and `npm run build` with logs redirected under `.scratch/`; update `context/CHANGELOG.md` and this handoff, then commit the Wave 2 checkpoint.
4. Do not launch another investigation or scientific execution. A Semantic Scholar retry is optional only as part of a future new investigation after its 429 clears; provider TPS must remain blank until real usage is returned.
