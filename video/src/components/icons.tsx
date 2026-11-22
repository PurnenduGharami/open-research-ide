import React from "react";

interface IconProps {
  size?: number;
  color?: string;
}

export const SearchIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <path d="M16.5 16.5L21 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 12H19M13 6L19 12L13 18"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 13L9.5 17.5L19 7"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LockIcon: React.FC<IconProps & { shackleOffset?: number }> = ({
  size = 16,
  color = "currentColor",
  shackleOffset = 0,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ overflow: "visible" }}>
    <path
      d="M7 11V7a5 5 0 0 1 10 0v4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      transform={`translate(0, ${shackleOffset})`}
    />
    <rect x="4" y="11" width="16" height="10" rx="2.5" stroke={color} strokeWidth="2" />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 4L21 20H3L12 4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M12 10V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1" fill={color} />
  </svg>
);
