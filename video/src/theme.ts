import { Easing } from "remotion";

export const COLORS = {
  obsidian: "#0A0B0E",
  paper: "#FCFCFB",
  surface: "#FFFFFF",
  ink: "#111315",
  ink2: "#525760",
  muted: "#787E88",
  hairline: "#E6E6E2",
  cobalt: "#1E4FC2",
  cobaltTint: "rgba(30, 79, 194, 0.12)",
  cobaltOnDark: "#7EA2FF",
  emerald: "#166534",
  emeraldBg: "#F0FDF4",
  emeraldOnDark: "#4ADE80",
  amberOnDark: "#FBBF24",
  amber: "#92400E",
  crimson: "#B91C1C",
  crimsonBg: "#FEF2F2",
  white60: "rgba(255, 255, 255, 0.6)",
} as const;

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_INOUT = Easing.bezier(0.65, 0, 0.35, 1);

export const SOFT = { damping: 200, stiffness: 120, mass: 0.9 } as const;
export const POP = { damping: 14, stiffness: 160, mass: 0.6 } as const;

export const CARD_SHADOW =
  "0 40px 100px -30px rgba(17, 19, 21, 0.22), 0 2px 6px rgba(17, 19, 21, 0.05)";

export const GLASS_STYLE = {
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 30px 80px -20px rgba(0, 0, 0, 0.6)",
} as const;

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
