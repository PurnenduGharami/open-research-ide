"use client";

import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger";

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return <span className={`ori-badge ori-badge--${tone}`}>{children}</span>;
}

export function MonoMeta({ children }: { children: ReactNode }) {
  return <span className="ori-mono-meta">{children}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ori-sec-header">
      <div className="ori-sec-header-copy">
        {eyebrow ? <span className="ori-sec-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ori-sec-header-actions">{actions}</div> : null}
    </header>
  );
}
