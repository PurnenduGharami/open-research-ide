import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS, EASE_IN } from "../theme";
import { Headline, IrisWipe, SceneShell } from "../components/primitives";

export const S1Hook: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const caretBlink = 0.5 + 0.5 * Math.cos(frame / 6);
  const caretFade = interpolate(frame, [40, 50], [1, 0], CLAMP);
  const caretOpacity = frame < 40 ? caretBlink : caretFade;

  const blockExitP = interpolate(frame, [215, 240], [0, 1], {
    ...CLAMP,
    easing: EASE_IN,
  });
  const blockOpacity = 1 - blockExitP;
  const blockScale = 1 - 0.03 * blockExitP;

  return (
    <SceneShell tone="dark" duration={duration} exit="none">
      {/* Intro blinking cobalt caret */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          width: 4,
          height: 80,
          borderRadius: 2,
          background: COLORS.cobaltOnDark,
          boxShadow: "0 0 24px #7EA2FF",
          transform: "translate(-50%, -50%)",
          opacity: caretOpacity,
        }}
      />

      {/* Centered two-line manifesto */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          width: 1520,
          transform: `translate(-50%, -50%) scale(${blockScale})`,
          opacity: blockOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Headline
          tone="dark"
          size={112}
          delay={40}
          stagger={4}
          parts={[
            { t: "Good research starts with" },
            { t: "curiosity,", accent: true },
          ]}
        />
        <Headline
          tone="dark"
          size={112}
          delay={110}
          stagger={4}
          parts={[
            { t: "not" },
            {
              t: "credentials.",
              color: "rgba(255, 255, 255, 0.45)",
              strike: { start: 150, duration: 20 },
            },
          ]}
        />
      </div>

      <IrisWipe color={COLORS.paper} cx={960} cy={540} start={234} duration={36} />
    </SceneShell>
  );
};
