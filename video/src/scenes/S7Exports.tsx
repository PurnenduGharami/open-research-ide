import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD_SHADOW, CLAMP, COLORS, EASE_OUT, POP, SOFT } from "../theme";
import { MONO, SANS } from "../fonts";
import { Headline, IrisWipe, SceneShell } from "../components/primitives";

const SHEETS = [
  {
    title: "Research Dossier",
    ext: ".html",
    strip: COLORS.cobalt,
    x: -495,
    y: 20,
    rz: -6,
    ry: 12,
    bars: ["86%", "72%", "90%", "64%", "82%", "76%", "60%"],
  },
  {
    title: "Print Report",
    ext: ".pdf",
    strip: COLORS.crimson,
    x: -165,
    y: 0,
    rz: -2,
    ry: 4,
    bars: ["80%", "88%", "68%", "76%", "90%", "66%", "74%"],
  },
  {
    title: "Manuscript",
    ext: ".tex",
    strip: COLORS.ink,
    x: 165,
    y: 0,
    rz: 2,
    ry: -4,
    bars: ["90%", "74%", "84%", "70%", "86%", "62%", "78%"],
  },
  {
    title: "Archive",
    ext: ".zip",
    strip: COLORS.amber,
    x: 495,
    y: 20,
    rz: 6,
    ry: -12,
    bars: ["74%", "86%", "66%", "88%", "70%", "82%", "64%"],
  },
] as const;

export const S7Exports: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stackIn = interpolate(frame, [10, 40], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  const floatBlend = interpolate(frame, [110, 130], [0, 1], CLAMP);
  const spineDraw = interpolate(frame, [115, 136], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const spineNodePop = spring({ frame: frame - 115, fps, config: POP });
  const spineLabelOpacity = interpolate(frame, [122, 138], [0, 1], CLAMP);

  return (
    <SceneShell tone="light" duration={duration} exit="none">
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 170,
          width: 1600,
          transform: "translate(-50%, -50%)",
        }}
      >
        <Headline
          tone="light"
          size={84}
          delay={6}
          parts={[
            { t: "One investigation." },
            { t: "Every format.", accent: true },
          ]}
        />
      </div>

      {/* Single source of truth spine */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden
      >
        <line
          x1={960 - 495 * spineDraw}
          y1={880}
          x2={960 + 495 * spineDraw}
          y2={880}
          stroke={COLORS.cobalt}
          strokeWidth={2}
        />
        {SHEETS.map((sheet, i) => {
          const sx = 960 + sheet.x;
          const syBottom = 805 + sheet.y;
          const isOuter = i === 0 || i === 3;
          const tickStart = isOuter ? 128 : 122;
          const tickEnd = isOuter ? 138 : 134;
          const tickP = interpolate(frame, [tickStart, tickEnd], [0, 1], {
            ...CLAMP,
            easing: EASE_OUT,
          });
          return (
            <line
              key={sheet.ext}
              x1={sx}
              y1={880}
              x2={sx}
              y2={880 - (880 - syBottom) * tickP}
              stroke={COLORS.cobalt}
              strokeWidth={1.25}
              opacity={0.75}
            />
          );
        })}
      </svg>

      {/* Center source node */}
      {frame >= 115 && (
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 880,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: COLORS.cobalt,
            transform: `translate(-50%, -50%) scale(${spineNodePop})`,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: 960,
          top: 906,
          transform: "translate(-50%, 0)",
          fontFamily: MONO,
          fontSize: 14,
          fontWeight: 500,
          color: COLORS.cobalt,
          opacity: spineLabelOpacity,
        }}
      >
        research-project.json
      </div>

      {/* 3D fan stage */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1800,
        }}
      >
        {SHEETS.map((sheet, i) => {
          const fan = spring({
            frame: frame - (50 + i * 5),
            fps,
            config: SOFT,
          });
          const stackOff = i * 3;
          const tx = stackOff * (1 - fan) + sheet.x * fan;
          const ty =
            stackOff * (1 - fan) +
            sheet.y * fan +
            floatBlend * 6 * Math.sin((frame + i * 20) / 30);
          const rz = sheet.rz * fan;
          const ry = sheet.ry * fan;

          return (
            <div
              key={sheet.ext}
              style={{
                position: "absolute",
                left: 960,
                top: 620,
                width: 300,
                height: 400,
                borderRadius: 14,
                background: COLORS.surface,
                border: `1px solid ${COLORS.hairline}`,
                boxShadow: CARD_SHADOW,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                opacity: stackIn,
                transform: `translate(-50%, -50%) translate3d(${tx}px, ${ty}px, 0) rotateZ(${rz}deg) rotateY(${ry}deg)`,
              }}
            >
              <div style={{ height: 10, width: "100%", background: sheet.strip }} />
              <div
                style={{
                  padding: 24,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 11,
                }}
              >
                <div
                  style={{
                    width: "46%",
                    height: 48,
                    borderRadius: 8,
                    background: "#F5F5F3",
                    marginBottom: 8,
                  }}
                />
                {sheet.bars.map((w, bi) => (
                  <div
                    key={bi}
                    style={{
                      width: w,
                      height: 10,
                      borderRadius: 5,
                      background: "#EFEFEC",
                    }}
                  />
                ))}

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 14,
                    borderTop: `1px solid ${COLORS.hairline}`,
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: COLORS.ink,
                    }}
                  >
                    {sheet.title}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 15,
                      color: COLORS.muted,
                    }}
                  >
                    {sheet.ext}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <IrisWipe color={COLORS.obsidian} cx={960} cy={620} start={204} duration={36} />
    </SceneShell>
  );
};
