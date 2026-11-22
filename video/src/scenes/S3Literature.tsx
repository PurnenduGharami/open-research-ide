import React from "react";
import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import timeline from "../timeline.json";
import { CARD_SHADOW, CLAMP, COLORS, EASE_OUT, POP, SOFT } from "../theme";
import { MONO, SANS } from "../fonts";
import { ArrowRightIcon, CheckIcon, SearchIcon } from "../components/icons";
import { Headline, SceneShell, Scramble } from "../components/primitives";

export const S3Literature: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pillOpacity = interpolate(frame, [0, 30], [1, 0], CLAMP);

  const ghostFade = interpolate(frame, [20, 50], [0, 0.5], CLAMP);
  const ghostDrift = interpolate(frame, [0, duration], [-10, 10], CLAMP);

  const cardEnter = spring({
    frame: frame - 18,
    fps,
    config: SOFT,
  });
  const cardRotateX = (1 - cardEnter) * 18;
  const cardY = (1 - cardEnter) * 80;

  const highlightP = interpolate(frame, [80, 130], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const highlightTextColor = interpolateColors(
    highlightP,
    [0, 1],
    [COLORS.ink2, COLORS.ink]
  );

  const footerOpacity = interpolate(frame, [135, 150], [0, 1], CLAMP);
  const verifiedScale = spring({
    frame: frame - 178,
    fps,
    config: POP,
  });
  const pulseP = interpolate(frame, [178, 202], [0, 1], CLAMP);
  const pulseOpacity = frame >= 178 && frame <= 202 ? 0.35 * (1 - pulseP) : 0;

  return (
    <SceneShell tone="light" duration={duration} exit="fade">
      {/* Match-cut fading query pill */}
      {pillOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 110,
            width: 1120,
            height: 104,
            borderRadius: 28,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            boxShadow: CARD_SHADOW,
            display: "flex",
            alignItems: "center",
            paddingLeft: 36,
            paddingRight: 20,
            opacity: pillOpacity,
            transform: "translate(-50%, -50%) scale(0.55)",
          }}
        >
          <SearchIcon size={28} color={COLORS.muted} />
          <div
            style={{
              marginLeft: 20,
              flex: 1,
              fontFamily: SANS,
              fontSize: 34,
              color: COLORS.ink,
              whiteSpace: "nowrap",
            }}
          >
            {timeline.typing.text}
          </div>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: COLORS.cobalt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRightIcon size={28} color="#FFFFFF" />
          </div>
        </div>
      )}

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 215,
          width: 1600,
          transform: "translate(-50%, -50%)",
        }}
      >
        <Headline
          tone="light"
          size={80}
          delay={10}
          parts={[
            { t: "Every claim, anchored to a" },
            { t: "real paper.", accent: true },
          ]}
        />
      </div>

      {/* Blurred background ghost cards */}
      <div
        style={{
          position: "absolute",
          left: 580 + ghostDrift,
          top: 690,
          width: 760,
          height: 330,
          borderRadius: 24,
          background: COLORS.surface,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: CARD_SHADOW,
          opacity: ghostFade,
          filter: "blur(6px)",
          transform: "translate(-50%, -50%) scale(0.85) rotate(-6deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1340 - ghostDrift,
          top: 700,
          width: 760,
          height: 330,
          borderRadius: 24,
          background: COLORS.surface,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: CARD_SHADOW,
          opacity: ghostFade,
          filter: "blur(6px)",
          transform: "translate(-50%, -50%) scale(0.85) rotate(5deg)",
        }}
      />

      {/* Main literature card */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 650,
          width: 1000,
          height: 440,
          transform: "translate(-50%, -50%)",
          perspective: 1600,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 24,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            boxShadow: CARD_SHADOW,
            padding: 48,
            display: "flex",
            flexDirection: "column",
            opacity: cardEnter,
            transform: `translateY(${cardY}px) rotateX(${cardRotateX}deg)`,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: COLORS.muted,
            }}
          >
            PEER-REVIEWED · ABSTRACT · 2024
          </div>

          <div
            style={{
              marginTop: 12,
              fontFamily: SANS,
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: COLORS.ink,
            }}
          >
            Low-temperature failure in sodium-ion cells
          </div>

          <div
            style={{
              marginTop: 18,
              fontFamily: SANS,
              fontSize: 24,
              lineHeight: 1.6,
              color: COLORS.ink2,
            }}
          >
            We examine capacity loss in hard-carbon anodes below 0 °C.{" "}
            <span
              style={{
                backgroundImage: `linear-gradient(${COLORS.cobaltTint}, ${COLORS.cobaltTint})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${highlightP * 100}% 100%`,
                borderRadius: 4,
                padding: "2px 4px",
                margin: "0 -4px",
                color: highlightTextColor,
              }}
            >
              Sluggish Na⁺ desolvation at the electrolyte interface limits charge transfer
            </span>
            , driving plating and rapid fade under repeated cycling.
          </div>

          {/* Hash + Verified footer */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 20,
              borderTop: `1px solid ${COLORS.hairline}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: footerOpacity,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 18 }}>
              <span style={{ color: COLORS.muted }}>SHA-256</span>
              <Scramble
                text="8f4a 19c2 b7e0 c21d"
                start={135}
                duration={40}
                seed="s3sha"
                style={{ color: COLORS.ink, fontWeight: 500 }}
              />
            </div>

            {frame >= 178 && (
              <div style={{ position: "relative" }}>
                {pulseOpacity > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 999,
                      border: `2px solid ${COLORS.emerald}`,
                      transform: `scale(${1 + 0.8 * pulseP})`,
                      opacity: pulseOpacity,
                      pointerEvents: "none",
                    }}
                  />
                )}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 16px",
                    borderRadius: 999,
                    background: COLORS.emeraldBg,
                    border: "1px solid rgba(22, 101, 52, 0.22)",
                    color: COLORS.emerald,
                    fontFamily: MONO,
                    fontSize: 15,
                    fontWeight: 500,
                    transform: `scale(${0.6 + 0.4 * verifiedScale})`,
                  }}
                >
                  <CheckIcon size={16} color={COLORS.emerald} />
                  <span>VERIFIED</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SceneShell>
  );
};
