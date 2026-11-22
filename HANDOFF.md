# Handoff — Open Research IDE

Status on 2026-11-22: **validated MVP complete**. Waves 1–2 implemented and exercised the complete live generative workflow, evidence confirmation, responsive UI, deterministic exports, and a Remotion launch film. No further MVP build wave is required.

## Final verification

- Canonical `workspace/research-project.json` is r21: exactly one of 12 evidence passages is verified; the other 11 remain unverified. The confirmed quote and SHA-256 are unchanged.
- `node tests/wave2-final-qa.mjs`: PASS for desktop 1440×1000 and mobile 390×844 Research, Graph, and Published views, navigation, inspector, composer, graph selection, evidence integrity, no horizontal overflow, and zero final-pass console/page errors.
- `npm test`: PASS (20/20). `npm run typecheck`: PASS. `npm run build`: PASS. Production server responds at `http://127.0.0.1:3000/` with HTTP 200.
- Wave 2 fixed native dialog geometry in `dashboard/styles.css`: the desktop inspector occupies the specified 304px rail, and the mobile native modal opens/closes within the viewport.
- Two completed Elephant turns and three distinct fresh Goldfish reviews succeeded with the required Cerebras model. Expected outcomes remained frozen across separate honest result import.
- HTML, PDF, `main.tex`, and `references.bib` remain nonempty and hash-matched to source r19. Later canonical revisions correctly require a fresh export.

## Launch video

- Output: `video/out/open-research-ide-launch.mp4` (local render; `video/out/` is gitignored).
- Format: 1920×1080, 30 fps, 32 seconds, H.264/yuv420p, 960 frames, approximately 1.16 MiB.
- `cd video && npm run typecheck && node scripts/verify.mjs`: PASS. Contact-sheet and full-resolution encoded-frame visual QA passed.
- Reproduction instructions: `video/README.md`. Remotion dependencies are isolated from the main app.

## Intentional/external limitations

- Semantic Scholar returned HTTP 429 during the stored investigation; its literature is OpenAlex-only. No substitute records were invented.
- Provider usage was absent, so run-average output TPS remains unavailable/blank.
- The experiment is proposed, not run. The imported record is a workflow check, not scientific evidence. Labs are model-suggested/unverified; no outreach or price claims exist.
- Real execution still requires power/sample-size justification, endpoint thresholds, exposure/blinding controls, safety, ethics/registration, and actual cost estimates.

## Next steps (post-MVP, optional)

1. Add CI and deployment/authentication hardening before public production use.
2. Create a GitHub release and attach the locally rendered MP4 if a hosted download is desired.
3. Conduct real scientific execution only through qualified researchers and the required ethics/safety process.
4. Retry Semantic Scholar only in a future investigation when its rate limit clears; never fabricate source data or telemetry.
