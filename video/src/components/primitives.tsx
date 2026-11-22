import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";
import { CLAMP, COLORS, EASE_IN, EASE_INOUT, EASE_OUT } from "../theme";
import { MONO, SERIF } from "../fonts";

export const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const gx = random(`gx-${frame}`) * 40;
  const gy = random(`gy-${frame}`) * 40;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        mixBlendMode: "overlay",
        opacity,
        zIndex: 40,
      }}
    >
      <svg
        width={2000}
        height={1160}
        style={{
          position: "absolute",
          left: -40,
          top: -40,
          transform: `translate(${gx}px, ${gy}px)`,
        }}
      >
        <filter id="ori-grain-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.9}
            numOctaves={2}
            seed={3}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#ori-grain-filter)" />
      </svg>
    </div>
  );
};

export const Glow: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.8 + 0.2 * Math.sin(frame / 40);

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 55%, rgba(30, 79, 194, 0.22), transparent 60%)",
          opacity: pulse,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.55))",
          pointerEvents: "none",
        }}
      />
    </>
  );
};

export const SceneShell: React.FC<{
  tone: "dark" | "light";
  duration: number;
  exit?: "fade" | "none";
  children: React.ReactNode;
}> = ({ tone, duration, exit = "none", children }) => {
  const frame = useCurrentFrame();
  const pushScale = interpolate(frame, [0, duration], [1, 1.035], CLAMP);

  const exitP =
    exit === "fade"
      ? interpolate(frame, [duration - 14, duration], [0, 1], {
          ...CLAMP,
          easing: EASE_IN,
        })
      : 0;

  return (
    <AbsoluteFill
      style={{
        background: tone === "dark" ? COLORS.obsidian : COLORS.paper,
        overflow: "hidden",
      }}
    >
      {tone === "dark" && <Glow />}
      <AbsoluteFill
        style={{
          transform: `scale(${pushScale + exitP * 0.01})`,
          opacity: 1 - exitP,
          filter: exitP > 0 ? `blur(${exitP * 6}px)` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
      <Grain opacity={tone === "dark" ? 0.05 : 0.035} />
    </AbsoluteFill>
  );
};

export interface HeadlinePart {
  t: string;
  accent?: boolean;
  color?: string;
  strike?: { start: number; duration: number };
}

export const Headline: React.FC<{
  parts: HeadlinePart[];
  size?: number;
  delay?: number;
  stagger?: number;
  tone: "dark" | "light";
  style?: React.CSSProperties;
}> = ({ parts, size = 88, delay = 0, stagger = 4, tone, style }) => {
  const frame = useCurrentFrame();

  const words: Array<{
    word: string;
    accent?: boolean;
    color?: string;
    strike?: { start: number; duration: number };
  }> = [];

  for (const part of parts) {
    const split = part.t.trim().split(/\s+/).filter(Boolean);
    for (const word of split) {
      words.push({
        word,
        accent: part.accent,
        color: part.color,
        strike: part.strike,
      });
    }
  }

  return (
    <div
      style={{
        fontFamily: SERIF,
        fontSize: size,
        fontWeight: 400,
        letterSpacing: "-0.02em",
        lineHeight: 1.05,
        textAlign: "center",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: "0.24em",
        ...style,
      }}
    >
      {words.map((item, i) => {
        const start = delay + i * stagger;
        const p = interpolate(frame, [start, start + 28], [0, 1], {
          ...CLAMP,
          easing: EASE_OUT,
        });
        const y = (1 - p) * 110;
        const blur = (1 - p) * 8;
        const textColor = item.accent
          ? tone === "light"
            ? COLORS.cobalt
            : COLORS.cobaltOnDark
          : item.color ?? (tone === "light" ? COLORS.ink : "#FFFFFF");

        const strikeP = item.strike
          ? interpolate(
              frame,
              [item.strike.start, item.strike.start + item.strike.duration],
              [0, 1],
              { ...CLAMP, easing: EASE_OUT }
            )
          : 0;

        return (
          <span
            key={`${i}-${item.word}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              padding: "0.08em 0.08em 0.14em",
              margin: "-0.08em -0.08em -0.14em",
              verticalAlign: "bottom",
            }}
          >
            <span
              style={{
                position: "relative",
                display: "inline-block",
                color: textColor,
                fontStyle: item.accent ? "italic" : "normal",
                transform: `translateY(${y}%)`,
                opacity: p,
                filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
              }}
            >
              {item.word}
              {item.strike && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "54%",
                    height: 3,
                    background: "rgba(255, 255, 255, 0.6)",
                    transformOrigin: "left center",
                    transform: `scaleX(${strikeP})`,
                  }}
                />
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const IrisWipe: React.FC<{
  color: string;
  cx: number;
  cy: number;
  start: number;
  duration?: number;
}> = ({ color, cx, cy, start, duration = 36 }) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;

  const maxDist = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(1920 - cx, cy),
    Math.hypot(cx, 1080 - cy),
    Math.hypot(1920 - cx, 1080 - cy)
  );

  const p = interpolate(frame, [start, start + duration - 1], [0, 1], {
    ...CLAMP,
    easing: EASE_INOUT,
  });
  const radius = p * maxDist * 1.05;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: color,
        clipPath: `circle(${radius}px at ${cx}px ${cy}px)`,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
};

const HEX_CHARS = "0123456789abcdef";

export const Scramble: React.FC<{
  text: string;
  start: number;
  duration: number;
  seed: string;
  style?: React.CSSProperties;
}> = ({ text, start, duration, seed, style }) => {
  const frame = useCurrentFrame();

  if (frame < start) {
    return (
      <span style={{ fontFamily: MONO, opacity: 0, ...style }}>{text}</span>
    );
  }

  const progress = interpolate(frame, [start, start + duration], [0, 1], CLAMP);
  const len = text.length;
  let display = "";

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (ch === " " || progress > i / len) {
      display += ch;
    } else {
      const idx = Math.floor(random(`${seed}-${i}-${frame}`) * 16);
      display += HEX_CHARS[idx];
    }
  }

  return <span style={{ fontFamily: MONO, ...style }}>{display}</span>;
};

export const CountUp: React.FC<{
  from: number;
  to: number;
  start: number;
  duration: number;
  decimals?: number;
  suffix?: string;
  style?: React.CSSProperties;
}> = ({ from, to, start, duration, decimals = 1, suffix = "", style }) => {
  const frame = useCurrentFrame();
  const val = interpolate(frame, [start, start + duration], [from, to], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  const roundedZero = Number(Math.abs(val).toFixed(decimals)) === 0;
  const formatted = roundedZero
    ? (0).toFixed(decimals)
    : `${val < 0 ? "−" : ""}${Math.abs(val).toFixed(decimals)}`;

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {formatted}
      {suffix}
    </span>
  );
};

export function drawPath(length: number, progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - clamped),
  };
}

export function bezierPoint(
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
    u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
  ];
}
