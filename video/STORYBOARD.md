# Open Research IDE — Premium Launch Video (Remotion) — Build Plan

Goal: replace the old composition in `open-research-ide/video/` with a 36s, 1920×1080, 60fps, 8-scene launch video. Rules for every scene: **one idea, one headline, one hero visual**. All motion is driven by `useCurrentFrame()`; no CSS transitions or animations, and no `Math.random()` (use `random(seed)` from `remotion`).

**Step 0 — save this plan.** Write this whole plan to `open-research-ide/video/STORYBOARD.md` before you write any code.

> PowerShell pitfall: the workspace path contains backticks (`` `Master Identity` ``), and PowerShell treats the backtick as an escape character. Always `cd open-research-ide\video` relative to the workspace cwd. Never paste the absolute path into a double-quoted string.

---

## 1. Setup

1. `cd open-research-ide\video; npm install; npm install --save-exact @remotion/google-fonts@4.0.540` (node_modules is not installed yet; remotion is pinned at 4.0.540, so the add-on must match exactly).
2. `tsconfig.json`: add `"resolveJsonModule": true` to compilerOptions.
3. `remotion.config.ts`: change `setCrf(23)` → `setCrf(18)` to avoid gradient banding. Keep everything else.
4. `package.json` scripts:
   - `"audio": "node scripts/generate-audio.mjs"`
   - `"render": "npm run audio && remotion render src/index.ts OpenResearchIDE out/open-research-ide-launch.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p"`
   - `"still": "remotion still src/index.ts OpenResearchIDE"` (use: `npm run still -- out/s3.png --frame=756`)
   - `"verify": "node scripts/verify.mjs"`
5. Delete the old `src/LaunchVideo.tsx` content entirely and rewrite it as described below. Update `video/README.md` to a short section listing the commands.

## 2. File structure (`video/src/`)

```
timeline.json          scene frames + audio cues (shared by TSX and the audio script)
theme.ts               colors, easings, spring presets
fonts.ts               loads the Google fonts, exports family names
components/primitives.tsx  SceneShell, Headline, IrisWipe, Glow, Grain, Scramble, CountUp, drawPath helper
components/BrandMark.tsx
components/icons.tsx   inline SVG icons: Search, ArrowRight, Check, Lock, Warning
scenes/S1Hook.tsx … scenes/S8Finale.tsx
LaunchVideo.tsx        <AbsoluteFill> + 8 <Sequence>s + <Audio>
Root.tsx               Composition id "OpenResearchIDE", fps 60, 1920×1080, durationInFrames 2160
```

### timeline.json (exact)
```json
{
  "fps": 60, "width": 1920, "height": 1080, "durationInFrames": 2160,
  "scenes": [
    {"id":"hook","from":0,"duration":270},
    {"id":"curiosity","from":270,"duration":300},
    {"id":"literature","from":570,"duration":270},
    {"id":"graph","from":840,"duration":270},
    {"id":"review","from":1110,"duration":270},
    {"id":"validate","from":1380,"duration":270},
    {"id":"exports","from":1650,"duration":240},
    {"id":"finale","from":1890,"duration":270}
  ],
  "typing": {"scene":"curiosity","startFrame":60,"framesPerChar":2.4,"text":"Why do sodium-ion batteries fail below 0°C?"},
  "cues": [
    {"scene":"hook","frame":234,"type":"transition"},
    {"scene":"curiosity","frame":190,"type":"tap"},
    {"scene":"literature","frame":178,"type":"snap"},
    {"scene":"graph","frame":140,"type":"ping"},
    {"scene":"graph","frame":234,"type":"transition"},
    {"scene":"review","frame":170,"type":"tick"},
    {"scene":"review","frame":180,"type":"tick"},
    {"scene":"review","frame":190,"type":"tick"},
    {"scene":"review","frame":234,"type":"transition"},
    {"scene":"validate","frame":180,"type":"chime"},
    {"scene":"exports","frame":50,"type":"softWhoosh"},
    {"scene":"exports","frame":204,"type":"transition"},
    {"scene":"finale","frame":0,"type":"finaleChord"}
  ]
}
```
In this plan, every "fN" means a **local** frame inside that scene's Sequence. Absolute frame = scene.from + local.

### theme.ts
- Colors: `obsidian #0A0B0E`, `paper #FCFCFB`, `surface #FFFFFF`, `ink #111315`, `ink2 #525760`, `muted #787E88`, `hairline #E6E6E2`, `cobalt #1E4FC2`, `cobaltTint rgba(30,79,194,0.12)`, `cobaltOnDark #7EA2FF`, `emerald #166534`, `emeraldBg #F0FDF4`, `emeraldOnDark #4ADE80`, `amberOnDark #FBBF24`, `amber #92400E`, `crimson #B91C1C`, `crimsonBg #FEF2F2`, `white60 rgba(255,255,255,0.6)`.
- Easings: `EASE_OUT = Easing.bezier(0.16,1,0.3,1)`, `EASE_IN = Easing.bezier(0.7,0,0.84,0)`, `EASE_INOUT = Easing.bezier(0.65,0,0.35,1)`.
- Spring: `SOFT = { damping: 200, stiffness: 120, mass: 0.9 }` (no overshoot). `POP = { damping: 14, stiffness: 160, mass: 0.6 }` (only for chips and stamps).
- Card shadow (light): `0 40px 100px -30px rgba(17,19,21,0.22), 0 2px 6px rgba(17,19,21,0.05)`.
- Glass (dark): bg `rgba(255,255,255,0.05)`, border `1px solid rgba(255,255,255,0.12)`, shadow `0 30px 80px -20px rgba(0,0,0,0.6)`.

### fonts.ts
```ts
import { loadFont as serif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as mono } from "@remotion/google-fonts/IBMPlexMono";
export const SERIF = serif("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
serif("italic", { weights: ["400"], subsets: ["latin"] });
export const SANS = inter("normal", { weights: ["400","500","600"], subsets: ["latin"] }).fontFamily;
export const MONO = mono("normal", { weights: ["400","500"], subsets: ["latin"] }).fontFamily;
```
If the loadFont signature differs, check `node_modules/@remotion/google-fonts/dist/.../InstrumentSerif.d.ts` and adapt. Fallback if the render cannot fetch fonts (network blocked): download the woff2 files into `public/fonts/`, load them with `@font-face` and `staticFile`, and wait for them with `delayRender`/`continueRender`.

### primitives.tsx (exact behavior)
- **SceneShell** `{tone:"dark"|"light", duration, exit?: "fade"|"none", children}`
  - Background: obsidian or paper.
  - Camera: the children wrapper scales from 1 to 1.035 linearly over `duration` (slow push).
  - Dark tone also gets a radial glow, `radial-gradient(circle at 50% 55%, rgba(30,79,194,0.22), transparent 60%)`, with opacity `0.8 + 0.2*sin(f/40)`, plus a vignette (`radial-gradient(transparent 55%, rgba(0,0,0,0.55))`).
  - Grain overlay: opacity 0.035 on light, 0.05 on dark.
  - `exit:"fade"`: over the last 14 frames, opacity 1→0, `blur(0→6px)`, scale +0.01, using EASE_IN.
  - Any scene that ends in an IrisWipe uses `exit:"none"`.
- **Headline** `{parts:{t:string,accent?:boolean}[], size=88, delay=0, stagger=4, tone}`
  - Splits parts into words. Each word sits in an `overflow:hidden` inline-block. The inner span animates translateY 110%→0, opacity 0→1 and `blur 8px→0` over 28 frames with EASE_OUT, starting at `delay + i*stagger`.
  - Font SERIF, `letterSpacing:-0.02em`, `lineHeight:1.05`, centered.
  - Accent words are italic and colored cobalt (light) or cobaltOnDark (dark).
  - Non-accent color is ink (light) or `#FFFFFF` (dark).
- **IrisWipe** `{color, cx, cy, start, duration=36}`: an absolutely positioned div with `clipPath: circle(R px at cx px cy px)`. R goes from 0 to `1.05*maxDistanceToCorners` with EASE_INOUT. It sits on top of everything in the outgoing scene, and the next scene's bg equals `color`, so the cut is seamless.
- **Grain**: a full-frame SVG `<feTurbulence baseFrequency=0.9 numOctaves=2 seed=3>` rect with `mixBlendMode: overlay`. Offset it each frame by `translate(random('gx'+f)*40px, random('gy'+f)*40px)` (the SVG is 40px oversize). If the full render takes over 25 minutes, delete Grain.
- **Scramble** `{text, start, duration, seed}`: before `start`, show `text` with opacity 0. Between `start` and `start+duration`, char i is resolved once `progress > i/len`. Otherwise it shows a hex char chosen by `Math.floor(random(seed+i+'-'+f)*16)`. Keep spaces fixed.
- **CountUp** `{from,to,start,duration,decimals,suffix}`: interpolate with EASE_OUT and render with `fontVariantNumeric:"tabular-nums"`. Use a real minus sign "−".
- **drawPath helper**: for SVG paths use `strokeDasharray=L`, `strokeDashoffset=L*(1-p)`. Get L from `@remotion/paths` `getLength()` (`npm i --save-exact @remotion/paths@4.0.540`) or compute it analytically.
- **Quadratic Bezier point**: `B(t)=(1-t)²P0+2(1-t)tC+t²P1`, used for traveling dots.

---

## 3. Scenes (layout in 1920×1080 px, f = local frame)

General layout: the headline is centered horizontally with its center at y≈170–210. The hero visual sits centered in the lower ⅔. No other copy beyond what is listed.

### S1 Hook — dark, 270f, exit none
- Headline at center (y 540), size 112, two lines:
  - Line 1: "Good research starts with **curiosity,**" (accent on "curiosity,"). Delay 40.
  - Line 2: "not credentials." Delay 110.
  - "credentials." is colored `rgba(255,255,255,0.45)`.
- f0–40: a cobalt caret (4×80px, cobaltOnDark, `boxShadow 0 0 24px #7EA2FF`) at the center blinks: opacity `0.5+0.5*cos(f/6)`. It fades out at f40–50 as the words begin.
- f150–170: a 3px `rgba(255,255,255,0.6)` strike line draws across "credentials." (scaleX 0→1, transformOrigin left, EASE_OUT). Put the line inside the word's wrapper so it aligns.
- f215–240: the text block goes opacity→0 and scale 1→0.97.
- **IrisWipe** paper from (960,540), start f234, duration 36.

### S2 Curiosity — light, 300f, exit none
- Headline "What are you **curious** about?", size 96, center y 300, delay 6. f200–225: the headline fades to 0 and moves translateY −20.
- **Composer**: 1120×104 at center (960,600), radius 28, surface bg, hairline border, card shadow.
  - Enter at f20: spring SOFT, translateY 40→0, scale 0.96→1, opacity.
  - Content: a Search icon at left (28px, muted, 36px from the left edge), then text in SANS 34px ink.
  - Placeholder "Ask anything, in any field…" in muted, shown until f60.
  - Typing: `chars = clamp(floor((f-60)/2.4), 0, 43)` from timeline.typing.
  - Cobalt caret 2×40px after the text, blinking `opacity = (floor(f/18)%2)?0.2:1`.
  - Submit button: 64px circle on the right, cobalt, white ArrowRight. At f190 it presses: scale 1→0.9→1 over 12f. A ripple ring (2px cobalt border) grows from the button center, radius 32→170, opacity 0.4→0, over f190–222.
- **Match-cut**: f215–260 (EASE_INOUT) the composer moves translateY 0→−490 and scales 1→0.55. It ends as a small pill centered at y 110. S3 starts with an identical static pill at that geometry.

### S3 Literature — light, 300f→ **270f**, exit fade
- Query pill: same geometry as S2's final state (1120×104 scaled 0.55, center y 110) with the full query text. Opacity 1→0 over f0–30.
- Headline "Every claim, anchored to a **real paper.**", size 80, center y 215, delay 10.
- Ghost cards: two 760×330 white cards behind the main card, opacity 0.5, `blur(6px)`, scale 0.85.
  - Positions: (580,690) rotated −6° and (1340,700) rotated 5°.
  - They fade in f20–50 and drift x ±10px over the scene.
- **Main card**: 1000×440 at center (960,650), radius 24, surface, card shadow, padding 48.
  - Enter f18: parent `perspective:1600px`, rotateX 18°→0, translateY 80→0, opacity, spring SOFT.
  - Row 1: MONO 15px muted, letterSpacing 0.12em: "PEER-REVIEWED · ABSTRACT · 2024" (no fake DOI; the product never invents DOIs).
  - Title: SANS 30px 600 ink, "Low-temperature failure in sodium-ion cells".
  - Abstract: SANS 24px, lineHeight 1.6, ink2: "We examine capacity loss in hard-carbon anodes below 0 °C. {H}Sluggish Na⁺ desolvation at the electrolyte interface limits charge transfer{/H}, driving plating and rapid fade under repeated cycling."
  - Highlight span H: `backgroundImage: linear-gradient(cobaltTint,cobaltTint)`, `backgroundRepeat:no-repeat`, `backgroundSize: ${p*100}% 100%`, `p` = EASE_OUT over f80–130. The text color interpolates ink2→ink.
  - Footer row (border-top hairline, starts at f135): MONO 18px. Label "SHA-256" in muted, then `<Scramble text="8f4a 19c2 b7e0 c21d" start=135 duration=40>` in ink.
  - At f178: a "VERIFIED" chip (Check icon, emerald on emeraldBg, MONO 15px 500, radius 999). Scale 0.6→1 with spring POP. One emerald ring pulse expands from the chip (scale 1→1.8, opacity 0.35→0, 24f).

### S4 Graph — light, 270f, exit none
- Headline "Contradictions surface. **Gaps** appear.", size 80, center y 170, delay 8.
- Background constellation: 18 dots (4px, #D0D1CC) at positions from `random('n'+i)` inside x 200–1720, y 330–1000. Connect each dot to its nearest neighbour with 1px #E6E6E2 lines. Opacity 0→0.6 over f0–40, plus a slow drift of 6px using sin.
- Nodes (white pill cards, radius 16, hairline border, card shadow, padding 18×26, SANS 22px 600 ink with a MONO 13px muted sublabel):
  - **A** at (560,520): "Paper A" / "DESOLVATION LIMITS RATE". Enters f20 (spring SOFT, scale 0.85→1, opacity).
  - **B** at (1360,520): "Paper B" / "SEI RESISTANCE DOMINATES". Enters f32.
- Contradiction edge: quadratic A(700,520)→C(960,430)→B(1220,520), crimson, width 3, `filter: drop-shadow(0 0 6px rgba(185,28,28,0.35))`.
  - Draws f50–85.
  - At f85: a chip "CONTRADICTION" (MONO 14px, crimson on crimsonBg) scales in at the curve's midpoint (POP).
  - f85–220: a 10px crimson glowing dot travels along the curve, looping every 50f.
- Gap edges: cobalt, width 2, `strokeDasharray "8 10"`, from A(560,560)→(960,780) and B(1360,560)→(960,780), drawn f110–140. Animate the dash offset `-f*0.8` afterward so they flow.
- **GAP node** at (960,800), from f135:
  - A 22px cobalt solid circle with `boxShadow 0 0 30px rgba(30,79,194,0.6)`.
  - A 120px dashed cobalt ring (2px, "6 8") rotating `f*0.6deg`.
  - Three ripple rings, radius 60→240, opacity 0.4→0, 50f each, starting f140/160/180.
  - Labels below: MONO 15px cobalt "RESEARCH GAP", then SANS 22px ink "An unanswered question".
- Camera: from f120, extra scale 1→1.06 (EASE_INOUT) with `transformOrigin "960px 800px"`, so the gap node stays fixed on screen.
- **IrisWipe** obsidian from (960,800), start f234.

### S5 Review — dark, 270f, exit none
- Headline "Three fresh reviewers. **Zero bias.**", size 84, center y 180, delay 8, white.
- Hypothesis glass card: 640×150 at center (960,430), radius 20.
  - MONO 14px cobaltOnDark "HYPOTHESIS", then SANS 26px white "A fluorinated additive restores Na⁺ transfer at −20 °C".
  - Enters f15: opacity, translateY 30→0, `blur 10→0`.
- Three reviewer glass cards, 400×210, radius 20, centers at (480,800), (960,800), (1440,800). They enter f50/60/70 from translateY 60 with blur 10→0 (spring SOFT). Each card has:
  - Title SANS 24px 600 white: "Evidence Auditor" / "Methodology Critic" / "Feasibility Reviewer".
  - Row: MONO 13px white60 "CONTEXT: 0 TOKENS", plus a 120×4 empty track (rgba white 0.12) to show empty memory.
  - Chip at top-right: MONO 12px "ISOLATED" with a Lock icon, in white60.
  - Verdict at f170/180/190 (POP): "✓ Citations verified" (emeraldOnDark), "△ Add a control group" (amberOnDark), "✓ Testable" (emeraldOnDark). Each is a chip with a tinted bg at 0.12 alpha.
- Connectors: 1px lines `rgba(126,162,255,0.4)` from each card's top center to the hypothesis bottom (960,505). They draw f80–110. Then, f110–170, a 6px glowing cobaltOnDark dot travels upward along each line, offset 8f per line, looping every 30f (scan).
- **IrisWipe** paper from (960,430), start f234.

### S6 Validate — light, 270f, exit fade
- Headline "Predict first. **Then test for real.**", size 80, center y 170, delay 8.
- Main card: 1200×520 at center (960,640), radius 24, surface, card shadow. Enters f15 with spring SOFT, translateY 50→0.
- Left column (x pad 56, width 400), two tiles stacked:
  - **EXPECTED tile**:
    - MONO 14px muted "EXPECTED" + Lock icon.
    - Value SERIF 96px ink "−38%".
    - MONO 14px muted "capacity loss · −20 °C".
    - f70 lock: the lock shackle moves translateY −4→0, a "FROZEN" chip (cobalt on cobaltTint) pops in with POP, and the tile border goes hairline→`rgba(30,79,194,0.36)`.
  - **OBSERVED tile** (enters f100): MONO "OBSERVED", value `<CountUp from=0 to=-35.4 decimals=1 suffix="%" start=110 duration=60>` SERIF 96px, then MONO "lab CSV · 12 cells".
- Right column chart (≈640×400):
  - Y axis 0% → −50%, with hairline gridlines at −10/−20/−30/−40.
  - Predicted band: rect between −34% and −42%, filled cobaltTint, with a dashed cobalt line at −38%. Reveals f75–100 via scaleX 0→1 from the left.
  - 12 observed dots (10px, ink) at evenly spaced x. Values `-33 - random('o'+i)*5.5` (most land in the band). They drop in from y−40 with opacity, staggered 5f from f110 (spring SOFT).
- f180: a verdict chip "SUPPORTS HYPOTHESIS" (Check, emerald on emeraldBg, MONO 16px) pops above the chart. The band tint briefly crossfades to `rgba(22,101,52,0.14)` (f180–200) and then holds.
- Caption below the card at f195: MONO 16px muted, letterSpacing 0.2em, "CODE · SURVEYS · REAL LABS".

### S7 Exports — light, 240f, exit none
- Headline "One investigation. **Every format.**", size 84, center y 170, delay 6.
- Four sheets, each 300×400, radius 14, surface, hairline border, card shadow. Each sheet has:
  - A 10px top color strip.
  - 7 gray content bars (#EFEFEC, heights 10, widths 60–90%) and one small block.
  - Footer: SANS 22px 600 label + MONO 15px muted ext.
  - Sheets in order: "Research Dossier" `.html` (strip cobalt), "Print Report" `.pdf` (crimson), "Manuscript" `.tex` (ink), "Archive" `.zip` (amber).
- f10–40: all four stacked at center (960,620) with offsets of 0/3/6/9px. They read as one sheet. Opacity in.
- f50–110: the sheets fan out with spring SOFT, staggered 5f, inside a parent with `perspective:1800px`. Final positions:
  - x offsets −495, −165, +165, +495
  - y offsets +20, 0, 0, +20
  - rotateZ −6, −2, 2, 6°
  - rotateY 12, 4, −4, −12°
- After f120: each sheet floats `translateY(6*sin((f+i*20)/30))`.
- Spine (single source of truth), f115–150:
  - A 2px cobalt horizontal line at y 880 draws from the center outward to x 465–1455.
  - A cobalt node at the center (12px dot) with a MONO 14px cobalt label below: "research-project.json".
  - Short 1px cobalt verticals connect the line up to each sheet's bottom.
- **IrisWipe** obsidian from (960,620), start f204, duration 36.

### S8 Finale — dark, 270f
- BrandMark (SVG viewBox 0 0 120 120, rendered at 150px, center (960,380), stroke cobaltOnDark):
  - Circle cx52 cy52 r34, strokeWidth 5: drawPath f0–30.
  - Handle line (76,76)→(102,102), strokeWidth 6, round caps: draws f20–36.
  - Node dot cx98 cy22 r7, filled: POP at f34.
  - Thin line (80,30)→(92,25), strokeWidth 3: draws f34–44.
  - Glow: `filter: drop-shadow(0 0 18px rgba(126,162,255,0.5))`.
- Wordmark at center y 560, SERIF 128px white, letterSpacing −0.02em: "Open Research " + italic cobaltOnDark "IDE". Uses the Headline reveal with delay 40 and stagger 5.
- Tagline at y 670, SERIF italic 50px `rgba(255,255,255,0.75)`: "The investigation is the product." Opacity/translateY reveal at f85.
- Footer at y 980, MONO 18px, letterSpacing 0.24em, `rgba(255,255,255,0.45)`: "OPEN-SOURCE · LOCAL-FIRST · MODEL-AGNOSTIC · MIT". Fades in at f120.
- f250–270: everything fades to obsidian (clean loop end).

### LaunchVideo.tsx
Map `timeline.scenes` to `<Sequence from durationInFrames>` with the matching scene component. Add `<Audio src={staticFile("soundtrack.wav")} volume={0.9} />` at the top level.

---

## 4. Audio — `scripts/generate-audio.mjs` (deterministic, pure Node, no dependencies)
- Import the timeline with `import tl from "../src/timeline.json" with { type: "json" };`.
- Output `public/soundtrack.wav`: 48000 Hz, 16-bit, stereo, length exactly 36.0s. Write the RIFF header by hand. Create `public/` if missing.
- PRNG: mulberry32(42) for noise.
- Cue time in seconds = `(scene.from + frame)/60`.
- **Pad** (whole duration):
  - Voices 110, 164.81, 220, 277.18, 329.63 Hz.
  - Each voice = `sin + 0.3*sin(2x)`, with amplitude LFO `0.55+0.45*sin(2π·0.07·t + i)`.
  - Detune right channel +0.15 Hz.
  - Master pad gain 0.045. Fade in over 0–2s and out over the last 2.5s.
- **transition** (each iris cue, which starts at the iris begin):
  - Whoosh: white noise through a one-pole lowpass. Cutoff sweeps 300→4000 Hz over 0.6s with `a = 1-exp(-2π fc/sr)`. Envelope: attack 0.45s, release 0.2s. Gain 0.12.
  - Sub: sine sweeping 50→38 Hz over 0.7s, envelope `sin(πx)`, gain 0.22.
- **Typing clicks**: one per char i at `t = (270 + 60 + i*2.4)/60`. Each is a 6ms differentiated noise burst (`x[n]-x[n-1]`) with exp decay τ 1.5ms, gain `0.07*(0.8+0.4*rand)`, panned randomly ±0.3. Skip spaces.
- **tap**: 880 + 1320 Hz sines, decay τ 60ms, gain 0.08.
- **snap**: 1046.5 + 1568 Hz, τ 0.25s, gain 0.09.
- **ping**: 1318.5 + 1975.5 Hz, τ 0.6s, gain 0.07, plus an echo at +0.18s ×0.4.
- **tick**: 660 Hz, τ 0.08s, gain 0.06.
- **chime**: 784 + 1174.7 Hz, τ 0.4s, gain 0.08.
- **softWhoosh**: the whoosh shortened to 0.3s, gain 0.06.
- **finaleChord**: 110, 220, 277.18, 329.63, 440 Hz, attack 0.05s, τ 4s, gain 0.05 each. Plus a 55 Hz sub, τ 2s, gain 0.14.
- Master: soft-clip with `tanh(1.2x)/tanh(1.2)`, fade out over the last 1.5s, then convert to Int16.
- Use short 5ms attacks on all one-shots to avoid clicks.

## 5. Verify — rewrite `scripts/verify.mjs`
- Update the checks:
  - fps `"60/1"` (both r and avg)
  - frames 2160
  - `|duration−36| < 0.1`
  - size under 40 MiB
  - add an ffprobe check that an audio stream exists (`-select_streams a:0`, codec_name `aac`)
- Contact-sheet timestamps: `[3.3, 7.6, 12.6, 17.0, 21.8, 26.4, 29.8, 35.0]` (one settled moment per scene, keep the 8-tile xstack).
- Keep the report/JSON output.

## 6. Execution order and QA
1. Setup → write all files → `npx tsc --noEmit` must exit 0.
2. Render quick stills and **look at each PNG** with read_file before doing the full render: `npm run still -- out/sN.png --frame=X` for X = 200, 456, 756, 1020, 1308, 1584, 1788, 2100, plus transition frames 252 and 1092 (iris mid-way).
   - Check: no text clipping or overflow, headline never overlaps the visual, accent words italic and cobalt, fonts actually loaded (serif headlines, not Times/Georgia), cards centered, nothing off-canvas.
   - Fix any issues, then re-check that still.
3. `npm run render` (generates audio, then the MP4). Then `npm run verify` must print `status: "PASS"`.
4. View `out/contact-sheet.png` and confirm all 8 scenes read as one idea each.
5. Report the file path, size, and verification output to the user.

## Re-plan if
- `@remotion/google-fonts@4.0.540` or `@remotion/paths@4.0.540` cannot be installed. Do not upgrade remotion core without asking; use the woff2 fallback for fonts and analytic path lengths instead.
- The render fails because Chrome/headless shell can't be downloaded, or the full render takes over 40 minutes even after removing Grain.
- `<Audio>` doesn't produce an AAC stream in the output after a correct WAV is generated.
- Any scene can't fit its visual + headline in 1920×1080 without shrinking type below ~64px headline / 20px body. That means the layout is wrong, so ask instead of cramming.
