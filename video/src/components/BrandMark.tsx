import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, COLORS, EASE_OUT, POP } from "../theme";

export const BrandMark: React.FC<{ size?: number }> = ({ size = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const circleP = interpolate(frame, [0, 30], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const handleP = interpolate(frame, [20, 36], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const nodeScale = spring({
    frame: frame - 34,
    fps,
    config: POP,
  });
  const thinLineP = interpolate(frame, [34, 44], [0, 1], { ...CLAMP, easing: EASE_OUT });

  const circleLen = 2 * Math.PI * 34;
  const handleLen = Math.hypot(102 - 76, 102 - 76);
  const thinLen = Math.hypot(92 - 80, 25 - 30);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      style={{
        filter: "drop-shadow(0 0 18px rgba(126, 162, 255, 0.5))",
        overflow: "visible",
      }}
    >
      <circle
        cx={52}
        cy={52}
        r={34}
        stroke={COLORS.cobaltOnDark}
        strokeWidth={5}
        strokeDasharray={circleLen}
        strokeDashoffset={circleLen * (1 - circleP)}
        transform="rotate(-90 52 52)"
      />
      <line
        x1={76}
        y1={76}
        x2={102}
        y2={102}
        stroke={COLORS.cobaltOnDark}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={handleLen}
        strokeDashoffset={handleLen * (1 - handleP)}
      />
      <line
        x1={80}
        y1={30}
        x2={92}
        y2={25}
        stroke={COLORS.cobaltOnDark}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={thinLen}
        strokeDashoffset={thinLen * (1 - thinLineP)}
      />
      <circle
        cx={98}
        cy={22}
        r={7}
        fill={COLORS.cobaltOnDark}
        style={{
          transformOrigin: "98px 22px",
          transform: `scale(${frame < 34 ? 0 : nodeScale})`,
        }}
      />
    </svg>
  );
};
