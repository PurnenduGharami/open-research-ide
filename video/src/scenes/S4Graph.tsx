import React from "react";
import { getLength } from "@remotion/paths";
import {
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CARD_SHADOW, CLAMP, COLORS, EASE_INOUT, EASE_OUT, POP, SOFT } from "../theme";
import { MONO, SANS } from "../fonts";
import {
  Headline,
  IrisWipe,
  SceneShell,
  bezierPoint,
  drawPath,
} from "../components/primitives";

const CONSTELLATION = Array.from({ length: 18 }, (_, i) => ({
  x: 200 + random(`nx-${i}`) * 1520,
  y: 330 + random(`ny-${i}`) * 670,
}));

const NEAREST_EDGES = CONSTELLATION.map((pt, i) => {
  let best = -1;
  let bestDist = Infinity;
  for (let j = 0; j < CONSTELLATION.length; j++) {
    if (i === j) continue;
    const d = Math.hypot(pt.x - CONSTELLATION[j].x, pt.y - CONSTELLATION[j].y);
    if (d < bestDist) {
      bestDist = d;
      best = j;
    }
  }
  return [i, best] as const;
});

const CONTRADICTION_D = "M 700 520 Q 960 430 1220 520";
const CONTRADICTION_LEN = getLength(CONTRADICTION_D);

const GAP_EDGE_A = "M 560 560 L 960 780";
const GAP_EDGE_B = "M 1360 560 L 960 780";
const GAP_EDGE_LEN = Math.hypot(960 - 560, 780 - 560);

const PaperNode: React.FC<{
  cx: number;
  cy: number;
  title: string;
  sub: string;
  delay: number;
}> = ({ cx, cy, title, sub, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: SOFT });
  const scale = 0.85 + 0.15 * enter;

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        borderRadius: 16,
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        boxShadow: CARD_SHADOW,
        padding: "18px 26px",
        textAlign: "center",
        opacity: enter,
        transform: `translate(-50%, -50%) scale(${scale})`,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: COLORS.ink }}>
        {title}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: MONO,
          fontSize: 13,
          color: COLORS.muted,
          letterSpacing: "0.06em",
        }}
      >
        {sub}
      </div>
    </div>
  );
};

export const S4Graph: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camZoom = interpolate(frame, [120, duration], [1, 1.06], {
    ...CLAMP,
    easing: EASE_INOUT,
  });

  const constOpacity = interpolate(frame, [0, 40], [0, 0.6], CLAMP);

  const contraDraw = interpolate(frame, [50, 85], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const contraChipScale = spring({
    frame: frame - 85,
    fps,
    config: POP,
  });
  const showTravelDot = frame >= 85 && frame <= 220;
  const travelT = ((frame - 85) % 50) / 50;
  const [dotX, dotY] = bezierPoint([700, 520], [960, 430], [1220, 520], travelT);

  const gapEdgeDraw = interpolate(frame, [110, 140], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  const gapPop = spring({
    frame: frame - 135,
    fps,
    config: SOFT,
  });
  const gapLabelOpacity = interpolate(frame, [145, 165], [0, 1], CLAMP);

  return (
    <SceneShell tone="light" duration={duration} exit="none">
      {/* Headline stays un-zoomed for calm anchor */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 170,
          width: 1600,
          transform: "translate(-50%, -50%)",
          zIndex: 10,
        }}
      >
        <Headline
          tone="light"
          size={80}
          delay={8}
          parts={[
            { t: "Contradictions surface." },
            { t: "Gaps", accent: true },
            { t: "appear." },
          ]}
        />
      </div>

      {/* Zoomable graph plane anchored on gap node (960, 800) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${camZoom})`,
          transformOrigin: "960px 800px",
        }}
      >
        {/* Background constellation */}
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0, opacity: constOpacity }}
          aria-hidden
        >
          {NEAREST_EDGES.map(([i, j], idx) => {
            const p1 = CONSTELLATION[i];
            const p2 = CONSTELLATION[j];
            const dx1 = 6 * Math.sin(frame / 45 + i);
            const dy1 = 6 * Math.cos(frame / 50 + i);
            const dx2 = 6 * Math.sin(frame / 45 + j);
            const dy2 = 6 * Math.cos(frame / 50 + j);
            return (
              <line
                key={`ce-${idx}`}
                x1={p1.x + dx1}
                y1={p1.y + dy1}
                x2={p2.x + dx2}
                y2={p2.y + dy2}
                stroke="#E6E6E2"
                strokeWidth={1}
              />
            );
          })}
          {CONSTELLATION.map((pt, i) => {
            const dx = 6 * Math.sin(frame / 45 + i);
            const dy = 6 * Math.cos(frame / 50 + i);
            return (
              <circle
                key={`cn-${i}`}
                cx={pt.x + dx}
                cy={pt.y + dy}
                r={2}
                fill="#D0D1CC"
              />
            );
          })}
        </svg>

        {/* Edges SVG */}
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          <defs>
            <mask id="gap-mask-a">
              <path
                d={GAP_EDGE_A}
                stroke="#FFFFFF"
                strokeWidth={6}
                fill="none"
                {...drawPath(GAP_EDGE_LEN, gapEdgeDraw)}
              />
            </mask>
            <mask id="gap-mask-b">
              <path
                d={GAP_EDGE_B}
                stroke="#FFFFFF"
                strokeWidth={6}
                fill="none"
                {...drawPath(GAP_EDGE_LEN, gapEdgeDraw)}
              />
            </mask>
          </defs>

          {/* Gap edges */}
          <path
            d={GAP_EDGE_A}
            stroke={COLORS.cobalt}
            strokeWidth={2}
            strokeDasharray="8 10"
            strokeDashoffset={frame > 140 ? -(frame - 140) * 0.8 : 0}
            fill="none"
            mask="url(#gap-mask-a)"
          />
          <path
            d={GAP_EDGE_B}
            stroke={COLORS.cobalt}
            strokeWidth={2}
            strokeDasharray="8 10"
            strokeDashoffset={frame > 140 ? -(frame - 140) * 0.8 : 0}
            fill="none"
            mask="url(#gap-mask-b)"
          />

          {/* Contradiction curve */}
          <path
            d={CONTRADICTION_D}
            stroke={COLORS.crimson}
            strokeWidth={3}
            fill="none"
            style={{
              filter: "drop-shadow(0 0 6px rgba(185, 28, 28, 0.35))",
            }}
            {...drawPath(CONTRADICTION_LEN, contraDraw)}
          />

          {showTravelDot && (
            <circle
              cx={dotX}
              cy={dotY}
              r={5}
              fill={COLORS.crimson}
              style={{
                filter: "drop-shadow(0 0 8px rgba(185, 28, 28, 0.7))",
              }}
            />
          )}
        </svg>

        {/* Paper A & Paper B */}
        <PaperNode
          cx={560}
          cy={520}
          title="Paper A"
          sub="DESOLVATION LIMITS RATE"
          delay={20}
        />
        <PaperNode
          cx={1360}
          cy={520}
          title="Paper B"
          sub="SEI RESISTANCE DOMINATES"
          delay={32}
        />

        {/* Contradiction chip at arc midpoint */}
        {frame >= 85 && (
          <div
            style={{
              position: "absolute",
              left: 960,
              top: 475,
              padding: "6px 14px",
              borderRadius: 999,
              background: COLORS.crimsonBg,
              border: "1px solid rgba(185, 28, 28, 0.24)",
              color: COLORS.crimson,
              fontFamily: MONO,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "0.06em",
              transform: `translate(-50%, -50%) scale(${contraChipScale})`,
            }}
          >
            CONTRADICTION
          </div>
        )}

        {/* Gap node */}
        {frame >= 135 && (
          <>
            {[140, 160, 180].map((start, idx) => {
              if (frame < start || frame > start + 50) return null;
              const p = interpolate(frame, [start, start + 50], [0, 1], CLAMP);
              const r = 60 + (240 - 60) * p;
              return (
                <div
                  key={`gr-${idx}`}
                  style={{
                    position: "absolute",
                    left: 960,
                    top: 800,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: 999,
                    border: `1.5px solid ${COLORS.cobalt}`,
                    opacity: 0.4 * (1 - p),
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                />
              );
            })}

            {/* Rotating dashed ring */}
            <svg
              width={120}
              height={120}
              style={{
                position: "absolute",
                left: 960,
                top: 800,
                opacity: gapPop,
                transform: `translate(-50%, -50%) scale(${gapPop}) rotate(${frame * 0.6}deg)`,
              }}
              aria-hidden
            >
              <circle
                cx={60}
                cy={60}
                r={58}
                fill="none"
                stroke={COLORS.cobalt}
                strokeWidth={2}
                strokeDasharray="6 8"
              />
            </svg>

            {/* Core cobalt dot */}
            <div
              style={{
                position: "absolute",
                left: 960,
                top: 800,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: COLORS.cobalt,
                boxShadow: "0 0 30px rgba(30, 79, 194, 0.6)",
                opacity: gapPop,
                transform: `translate(-50%, -50%) scale(${gapPop})`,
              }}
            />

            {/* Labels below */}
            <div
              style={{
                position: "absolute",
                left: 960,
                top: 888,
                textAlign: "center",
                transform: "translate(-50%, 0)",
                opacity: gapLabelOpacity,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  color: COLORS.cobalt,
                }}
              >
                RESEARCH GAP
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: SANS,
                  fontSize: 22,
                  fontWeight: 500,
                  color: COLORS.ink,
                }}
              >
                An unanswered question
              </div>
            </div>
          </>
        )}
      </div>

      <IrisWipe color={COLORS.obsidian} cx={960} cy={800} start={234} duration={36} />
    </SceneShell>
  );
};
