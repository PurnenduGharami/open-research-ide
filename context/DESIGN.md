# Design System

## Scene and world
A researcher operates the IDE at a desk in bright ambient light. The approved world is a clean Apple-style light-mode dashboard: precise, quiet, dense enough for real work, and never gamified. This brief is pinned whole by the project owner; the Research canvas is an Operate surface.

## Core tokens
- Font: system sans `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`; data uses `ui-monospace, "SFMono-Regular", monospace`.
- Canvas: `#f5f5f4`; primary surface `#ffffff`; secondary surface `#f9f9f8`; selected surface `#f0f4f1`.
- Ink: `#1d1d1f`; secondary `#636366`; tertiary `#858587`.
- Hairline: `#e4e4e1`; strong border `#d4d4d0`.
- Accent: forest `#2f6550`; accent soft `#eaf2ed`; blue `#476c87`; contradiction `#b34b43`; warning `#9a6a27`.
- Radius: controls 8px; cards 14px; dialog 18px; pills 999px.
- Border: 1px solid hairline. Elevation only for dialogs/top-layer: `0 20px 60px rgb(0 0 0 / 12%)`; cards use borders only.
- Spacing: 4px base unit; shell gutter 20px; section separation 28px; card padding 20–24px.
- Body: 14px/1.55; small 12px/1.45; canvas title 28px/1.2; dialog title 24px/1.25.
- Controls: desktop minimum 36px, form inputs 44px, coarse pointers 48px.

## Composition
A 72px navigation rail on the left, a full-height Research canvas in the middle, and a 304px inspector on the right. The top bar owns project context, live telemetry, setup, and exports. The conversation is a continuous research document with persistent artifact blocks, not a grid of interchangeable cards. The composer stays at the bottom of the Research canvas.

## Signature interaction
On every committed tool mutation, the inline artifact and the right inspector resolve to the same new revision in one subtle cross-fade. Semantic contradictions use a single red edge and matching text label; color never carries meaning alone.

## Responsive behavior
Below 1180px the inspector becomes collapsible. Below 820px the rail becomes a compact top navigation and the composer/artifacts become one column. Use `100dvh`, stable scrollbar gutters, and no horizontal page overflow. Honor reduced motion.

## Accessibility
Use native controls and a native modal dialog, visible labels, keyboard-operable tabs, `:focus-visible` rings, non-color status cues, semantic tables, 4.5:1 body contrast, and live announcements only for meaningful run/status changes.
