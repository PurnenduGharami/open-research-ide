# Changelog

## 2026-11-21 — Foundation started
Locked the approved MVP specification and exact UI tokens. No application behavior implemented yet.

## 2026-11-22 — Integrated implementation and verification handoff
Integrated the canonical research runtime, live literature/evidence workflow, isolated Goldfish runtime, deterministic HTML/PDF/LaTeX exports, and loopback-only Operate UI. Recorded 20/20 passing unit tests, passing typecheck/build and non-generative Gateway preflight, idempotent setup, and desktop/mobile UI checks with no final-pass console errors.
The full live investigation remains incomplete after Cerebras returned `429 queue_exceeded`; see `HANDOFF.md` for the partial canonical state and acceptance gaps.

## 2026-11-22 — Wave 1 live acceptance checkpoint
Completed one caffeine/repeated-sprint investigation with two Elephant turns, three fresh Goldfish reviews, a proposed experiment with frozen outcomes, separate honest result import, and four hash-matched exports from canonical r19 (now r20 after manifest recording).
`npm test`, `npm run typecheck`, and `npm run build` passed. Evidence confirmation, Semantic Scholar's HTTP 429, unavailable provider TPS, and unverified labs/protocol execution remain explicitly open in `HANDOFF.md`.
