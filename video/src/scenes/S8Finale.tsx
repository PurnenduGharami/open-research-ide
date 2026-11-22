import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS, EASE_IN, EASE_OUT } from "../theme";
import { MONO, SERIF } from "../fonts";
import { BrandMark } from "../components/BrandMark";
import { Headline, SceneShell } from "../components/primitives";

export const S8Finale: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();

  const taglineP = interpolate(frame, [85, 113], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const footerP = interpolate(frame, [120, 145], [0, 1], CLAMP);
  const loopFade = interpolate(frame, [250, 270], [1, 0], {
    ...CLAMP,
    easing: EASE_IN,
  });

  return (
    <SceneShell tone="dark" duration={duration} exit="none">
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: loopFade,
        }}
      >
        {/* Emblem */}
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 380,
            transform: "translate(-50%, -50%)",
          }}
        >
          <BrandMark size={150} />
        </div>

        {/* Wordmark */}
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 560,
            width: 1700,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Headline
            tone="dark"
            size={128}
            delay={40}
            stagger={5}
            parts={[
              { t: "Open Research" },
              { t: "IDE", accent: true },
            ]}
          />
        </div>

        {/* Tagline */}
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 670,
            transform: `translate(-50%, -50%) translateY(${(1 - taglineP) * 18}px)`,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 50,
            color: "rgba(255, 255, 255, 0.75)",
            opacity: taglineP,
            whiteSpace: "nowrap",
          }}
        >
          The investigation is the product.
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            left: 960,
            top: 980,
            transform: "translate(-50%, -50%)",
            fontFamily: MONO,
            fontSize: 18,
            letterSpacing: "0.24em",
            color: "rgba(255, 255, 255, 0.45)",
            opacity: footerP,
            whiteSpace: "nowrap",
          }}
        >
          OPEN-SOURCE · LOCAL-FIRST · MODEL-AGNOSTIC · MIT
        </div>
      </div>
    </SceneShell>
  );
};
