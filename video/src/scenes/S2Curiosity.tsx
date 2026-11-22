import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "../timeline.json";
import { CARD_SHADOW, CLAMP, COLORS, EASE_IN, EASE_INOUT, SOFT } from "../theme";
import { SANS } from "../fonts";
import { ArrowRightIcon, SearchIcon } from "../components/icons";
import { Headline, SceneShell } from "../components/primitives";

export const S2Curiosity: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { startFrame, framesPerChar, text } = timeline.typing;

  const headExitP = interpolate(frame, [200, 225], [0, 1], {
    ...CLAMP,
    easing: EASE_IN,
  });

  const enter = spring({
    frame: frame - 20,
    fps,
    config: SOFT,
  });
  const enterY = (1 - enter) * 40;
  const enterScale = 0.96 + 0.04 * enter;

  const matchP = interpolate(frame, [215, 260], [0, 1], {
    ...CLAMP,
    easing: EASE_INOUT,
  });
  const matchY = -490 * matchP;
  const matchScale = 1 - 0.45 * matchP;

  const isTyping = frame >= startFrame;
  const chars = isTyping
    ? Math.min(text.length, Math.max(0, Math.floor((frame - startFrame) / framesPerChar)))
    : 0;
  const shownText = text.slice(0, chars);
  const caretOpacity = Math.floor(frame / 18) % 2 ? 0.2 : 1;

  const pressDown = interpolate(frame, [190, 196], [1, 0.9], CLAMP);
  const pressUp = interpolate(frame, [196, 202], [0.9, 1], CLAMP);
  const buttonScale = frame < 190 ? 1 : frame < 196 ? pressDown : pressUp;

  const rippleP = interpolate(frame, [190, 222], [0, 1], CLAMP);
  const rippleRadius = 32 + (170 - 32) * rippleP;
  const rippleOpacity = frame >= 190 && frame <= 222 ? 0.4 * (1 - rippleP) : 0;

  return (
    <SceneShell tone="light" duration={duration} exit="none">
      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 300,
          width: 1600,
          transform: `translate(-50%, -50%) translateY(${-20 * headExitP}px)`,
          opacity: 1 - headExitP,
        }}
      >
        <Headline
          tone="light"
          size={96}
          delay={6}
          parts={[
            { t: "What are you" },
            { t: "curious", accent: true },
            { t: "about?" },
          ]}
        />
      </div>

      {/* Floating search composer */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 600,
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
          opacity: enter,
          transform: `translate(-50%, -50%) translateY(${enterY + matchY}px) scale(${enterScale * matchScale})`,
        }}
      >
        <SearchIcon size={28} color={COLORS.muted} />
        <div
          style={{
            marginLeft: 20,
            flex: 1,
            display: "flex",
            alignItems: "center",
            fontFamily: SANS,
            fontSize: 34,
            fontWeight: 400,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {!isTyping ? (
            <span style={{ color: COLORS.muted }}>Ask anything, in any field…</span>
          ) : (
            <span style={{ color: COLORS.ink }}>{shownText}</span>
          )}
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 40,
              marginLeft: isTyping ? 4 : 6,
              background: COLORS.cobalt,
              opacity: caretOpacity,
              flexShrink: 0,
            }}
          />
        </div>

        {/* Submit button + ripple */}
        <div
          style={{
            position: "relative",
            width: 64,
            height: 64,
            flexShrink: 0,
          }}
        >
          {rippleOpacity > 0 && (
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 32,
                width: rippleRadius * 2,
                height: rippleRadius * 2,
                borderRadius: 999,
                border: `2px solid ${COLORS.cobalt}`,
                opacity: rippleOpacity,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: COLORS.cobalt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${buttonScale})`,
            }}
          >
            <ArrowRightIcon size={28} color="#FFFFFF" />
          </div>
        </div>
      </div>
    </SceneShell>
  );
};
