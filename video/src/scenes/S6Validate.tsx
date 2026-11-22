import React from "react";
import {
  interpolate,
  interpolateColors,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CARD_SHADOW, CLAMP, COLORS, EASE_OUT, POP, SOFT } from "../theme";
import { MONO, SERIF } from "../fonts";
import { CheckIcon, LockIcon } from "../components/icons";
import { CountUp, Headline, SceneShell } from "../components/primitives";

const OBSERVED_VALUES = Array.from({ length: 12 }, (_, i) => {
  return -33 - random(`o-${i}`) * 5.5;
});

const PLOT_W = 640;
const PLOT_H = 400;
const PAD_L = 62;
const PAD_R = 24;
const PAD_T = 56;
const PAD_B = 28;
const INNER_W = PLOT_W - PAD_L - PAD_R;
const INNER_H = PLOT_H - PAD_T - PAD_B;

const yForPct = (pct: number) => PAD_T + (-pct / 50) * INNER_H;

export const S6Validate: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardEnter = spring({ frame: frame - 15, fps, config: SOFT });
  const cardY = (1 - cardEnter) * 50;

  const lockP = interpolate(frame, [70, 80], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const shackleOffset = -4 * (1 - lockP);
  const frozenPop = spring({ frame: frame - 70, fps, config: POP });
  const expectedBorder = interpolateColors(
    lockP,
    [0, 1],
    [COLORS.hairline, "rgba(30, 79, 194, 0.36)"]
  );

  const observedEnter = spring({ frame: frame - 100, fps, config: SOFT });
  const bandReveal = interpolate(frame, [75, 100], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  const supportP = interpolate(frame, [180, 200], [0, 1], CLAMP);
  const bandColor = interpolateColors(
    supportP,
    [0, 1],
    [COLORS.cobaltTint, "rgba(22, 101, 52, 0.14)"]
  );
  const supportPop = spring({ frame: frame - 180, fps, config: POP });
  const captionOpacity = interpolate(frame, [195, 215], [0, 1], CLAMP);

  const bandTop = yForPct(-34);
  const bandBottom = yForPct(-42);
  const expectedY = yForPct(-38);

  return (
    <SceneShell tone="light" duration={duration} exit="fade">
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
          size={80}
          delay={8}
          parts={[
            { t: "Predict first." },
            { t: "Then test for real.", accent: true },
          ]}
        />
      </div>

      {/* Main validation card */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 640,
          width: 1200,
          height: 520,
          borderRadius: 24,
          background: COLORS.surface,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: CARD_SHADOW,
          padding: "44px 56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
          opacity: cardEnter,
          transform: `translate(-50%, -50%) translateY(${cardY}px)`,
        }}
      >
        {/* Left column: EXPECTED & OBSERVED tiles */}
        <div
          style={{
            width: 400,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* EXPECTED */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: 16,
              border: `1.5px solid ${expectedBorder}`,
              background: COLORS.paper,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: MONO,
                  fontSize: 14,
                  color: COLORS.muted,
                  letterSpacing: "0.08em",
                }}
              >
                <span>EXPECTED</span>
                <LockIcon
                  size={15}
                  color={frame >= 70 ? COLORS.cobalt : COLORS.muted}
                  shackleOffset={shackleOffset}
                />
              </div>

              {frame >= 70 && (
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: COLORS.cobaltTint,
                    color: COLORS.cobalt,
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 500,
                    transform: `scale(${frozenPop})`,
                  }}
                >
                  FROZEN
                </span>
              )}
            </div>

            <div
              style={{
                marginTop: 8,
                fontFamily: SERIF,
                fontSize: 96,
                lineHeight: 0.95,
                color: COLORS.ink,
                letterSpacing: "-0.02em",
              }}
            >
              −38%
            </div>

            <div
              style={{
                marginTop: 8,
                fontFamily: MONO,
                fontSize: 14,
                color: COLORS.muted,
              }}
            >
              capacity loss · −20 °C
            </div>
          </div>

          {/* OBSERVED */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: 16,
              border: `1px solid ${COLORS.hairline}`,
              background: COLORS.surface,
              opacity: observedEnter,
              transform: `translateY(${(1 - observedEnter) * 18}px)`,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 14,
                color: COLORS.muted,
                letterSpacing: "0.08em",
              }}
            >
              OBSERVED
            </div>

            <div
              style={{
                marginTop: 8,
                fontFamily: SERIF,
                fontSize: 96,
                lineHeight: 0.95,
                color: COLORS.ink,
                letterSpacing: "-0.02em",
              }}
            >
              <CountUp
                from={0}
                to={-35.4}
                decimals={1}
                suffix="%"
                start={110}
                duration={60}
              />
            </div>

            <div
              style={{
                marginTop: 8,
                fontFamily: MONO,
                fontSize: 14,
                color: COLORS.muted,
              }}
            >
              lab CSV · 12 cells
            </div>
          </div>
        </div>

        {/* Right column: Plot + Verdict */}
        <div style={{ position: "relative", width: PLOT_W, height: PLOT_H }}>
          {frame >= 180 && (
            <div
              style={{
                position: "absolute",
                right: 24,
                top: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 16px",
                borderRadius: 999,
                background: COLORS.emeraldBg,
                border: "1px solid rgba(22, 101, 52, 0.22)",
                color: COLORS.emerald,
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 500,
                transform: `scale(${supportPop})`,
                zIndex: 5,
              }}
            >
              <CheckIcon size={17} color={COLORS.emerald} />
              <span>SUPPORTS HYPOTHESIS</span>
            </div>
          )}

          <svg width={PLOT_W} height={PLOT_H} aria-hidden>
            {/* Gridlines */}
            {[0, -10, -20, -30, -40, -50].map((pct) => {
              const y = yForPct(pct);
              return (
                <g key={pct}>
                  <line
                    x1={PAD_L}
                    y1={y}
                    x2={PAD_L + INNER_W}
                    y2={y}
                    stroke={COLORS.hairline}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_L - 12}
                    y={y + 4}
                    textAnchor="end"
                    fontFamily={MONO}
                    fontSize={12}
                    fill={COLORS.muted}
                  >
                    {pct === 0 ? "0%" : `−${Math.abs(pct)}%`}
                  </text>
                </g>
              );
            })}

            {/* Predicted band (-34% to -42%) + dashed -38% line */}
            <g
              style={{
                transformOrigin: `${PAD_L}px 0px`,
                transform: `scaleX(${bandReveal})`,
              }}
            >
              <rect
                x={PAD_L}
                y={bandTop}
                width={INNER_W}
                height={bandBottom - bandTop}
                fill={bandColor}
                rx={4}
              />
              <line
                x1={PAD_L}
                y1={expectedY}
                x2={PAD_L + INNER_W}
                y2={expectedY}
                stroke={COLORS.cobalt}
                strokeWidth={1.8}
                strokeDasharray="6 6"
              />
            </g>

            {/* 12 observed data points */}
            {OBSERVED_VALUES.map((val, i) => {
              const dotStart = 110 + i * 5;
              const drop = spring({
                frame: frame - dotStart,
                fps,
                config: SOFT,
              });
              const cx = PAD_L + ((i + 0.5) / 12) * INNER_W;
              const cy = yForPct(val) - (1 - drop) * 40;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={COLORS.ink}
                  opacity={drop}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Modality caption */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 955,
          transform: "translate(-50%, -50%)",
          fontFamily: MONO,
          fontSize: 16,
          letterSpacing: "0.2em",
          color: COLORS.muted,
          opacity: captionOpacity,
        }}
      >
        CODE · SURVEYS · REAL LABS
      </div>
    </SceneShell>
  );
};
