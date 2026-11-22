import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, COLORS, EASE_OUT, GLASS_STYLE, POP, SOFT } from "../theme";
import { MONO, SANS } from "../fonts";
import { LockIcon } from "../components/icons";
import { Headline, IrisWipe, SceneShell, drawPath } from "../components/primitives";

const REVIEWERS = [
  {
    cx: 480,
    delay: 50,
    title: "Evidence Auditor",
    verdictAt: 170,
    verdictText: "✓ Citations verified",
    verdictColor: COLORS.emeraldOnDark,
    verdictBg: "rgba(74, 222, 128, 0.12)",
  },
  {
    cx: 960,
    delay: 60,
    title: "Methodology Critic",
    verdictAt: 180,
    verdictText: "△ Add a control group",
    verdictColor: COLORS.amberOnDark,
    verdictBg: "rgba(251, 191, 36, 0.12)",
  },
  {
    cx: 1440,
    delay: 70,
    title: "Feasibility Reviewer",
    verdictAt: 190,
    verdictText: "✓ Testable",
    verdictColor: COLORS.emeraldOnDark,
    verdictBg: "rgba(74, 222, 128, 0.12)",
  },
] as const;

export const S5Review: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hypEnter = spring({
    frame: frame - 15,
    fps,
    config: SOFT,
  });
  const hypBlur = (1 - hypEnter) * 10;
  const hypY = (1 - hypEnter) * 30;

  const lineDraw = interpolate(frame, [80, 110], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  return (
    <SceneShell tone="dark" duration={duration} exit="none">
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 180,
          width: 1600,
          transform: "translate(-50%, -50%)",
        }}
      >
        <Headline
          tone="dark"
          size={84}
          delay={8}
          parts={[
            { t: "Three fresh reviewers." },
            { t: "Zero bias.", accent: true },
          ]}
        />
      </div>

      {/* Connector lines + scanning pulses */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden
      >
        {REVIEWERS.map((rev, i) => {
          const x1 = rev.cx;
          const y1 = 695;
          const x2 = 960;
          const y2 = 505;
          const len = Math.hypot(x2 - x1, y2 - y1);
          const scanOffset = i * 8;
          const localScan = frame - 110 - scanOffset;
          const scanning = frame >= 110 && frame <= 170 && localScan >= 0;
          const t = (localScan % 30) / 30;
          const dx = x1 + (x2 - x1) * t;
          const dy = y1 + (y2 - y1) * t;

          return (
            <g key={rev.title}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(126, 162, 255, 0.4)"
                strokeWidth={1}
                {...drawPath(len, lineDraw)}
              />
              {scanning && (
                <circle
                  cx={dx}
                  cy={dy}
                  r={3}
                  fill={COLORS.cobaltOnDark}
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(126, 162, 255, 0.9))",
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Hypothesis glass card */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 430,
          width: 640,
          height: 150,
          borderRadius: 20,
          ...GLASS_STYLE,
          padding: "26px 34px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: hypEnter,
          transform: `translate(-50%, -50%) translateY(${hypY}px)`,
          filter: hypBlur > 0.05 ? `blur(${hypBlur}px)` : undefined,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.14em",
            color: COLORS.cobaltOnDark,
          }}
        >
          HYPOTHESIS
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 500,
            lineHeight: 1.3,
            color: "#FFFFFF",
          }}
        >
          A fluorinated additive restores Na⁺ transfer at −20 °C
        </div>
      </div>

      {/* Three reviewer glass cards */}
      {REVIEWERS.map((rev) => {
        const enter = spring({
          frame: frame - rev.delay,
          fps,
          config: SOFT,
        });
        const y = (1 - enter) * 60;
        const blur = (1 - enter) * 10;
        const verdictPop = spring({
          frame: frame - rev.verdictAt,
          fps,
          config: POP,
        });

        return (
          <div
            key={rev.title}
            style={{
              position: "absolute",
              left: rev.cx,
              top: 800,
              width: 400,
              height: 210,
              borderRadius: 20,
              ...GLASS_STYLE,
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              opacity: enter,
              transform: `translate(-50%, -50%) translateY(${y}px)`,
              filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  letterSpacing: "-0.02em",
                }}
              >
                {rev.title}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 9px",
                  borderRadius: 999,
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontFamily: MONO,
                  fontSize: 12,
                  color: COLORS.white60,
                  flexShrink: 0,
                }}
              >
                <LockIcon size={12} color={COLORS.white60} />
                <span>ISOLATED</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  color: COLORS.white60,
                  letterSpacing: "0.04em",
                }}
              >
                CONTEXT: 0 TOKENS
              </span>
              <div
                style={{
                  width: 120,
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255, 255, 255, 0.12)",
                }}
              />
            </div>

            <div style={{ minHeight: 36, display: "flex", alignItems: "center" }}>
              {frame >= rev.verdictAt && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: rev.verdictBg,
                    color: rev.verdictColor,
                    fontFamily: MONO,
                    fontSize: 14,
                    fontWeight: 500,
                    transform: `scale(${verdictPop})`,
                    transformOrigin: "left center",
                  }}
                >
                  {rev.verdictText}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <IrisWipe color={COLORS.paper} cx={960} cy={430} start={234} duration={36} />
    </SceneShell>
  );
};
