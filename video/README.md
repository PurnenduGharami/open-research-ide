# Open Research IDE launch video

A silent, 32-second motion-design launch film built entirely with Remotion and native React/SVG. Product interfaces are clearly labelled schematics; no live results, experiment execution, or external media are represented.

## Reproduce

```bash
cd video
npm ci
npm run typecheck
npm run render
node scripts/verify.mjs
```

Output: `video/out/open-research-ide-launch.mp4` (1920×1080, 30 fps, H.264, yuv420p, 960 frames).

The verifier checks codec, dimensions, frame rate, duration, frame count, and the 30 MB size ceiling. It also extracts eight representative encoded-video frames and builds `out/contact-sheet.png` for visual review. FFmpeg and FFprobe binaries are supplied by video-local npm packages; no system installation or credentials are required.

For interactive preview, run `npm run studio` and select `OpenResearchIDE`. Remotion will prepare its supported browser automatically if needed.
