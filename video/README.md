# Open Research IDE Launch Video

A 36-second, 1920×1080, 60 fps launch film built with Remotion, native React/SVG motion graphics, and deterministic synthesized audio.

## Commands

```bash
cd open-research-ide/video
npm install
npm run typecheck
npm run audio
npm run still -- out/s3.png --frame=756
npm run render
npm run verify
npm run studio
```

Output: `out/open-research-ide-launch.mp4` (1920×1080, 60 fps, H.264 `yuv420p`, 2160 frames, AAC stereo audio).
