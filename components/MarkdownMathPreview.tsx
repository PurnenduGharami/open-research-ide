"use client";

import { useMemo } from "react";
import type { MouseEvent } from "react";
import { renderMarkdownWithMathAndLinks } from "../src/markdown-math";

export function MarkdownMathPreview({
  markdown,
  projectId,
  onOpenWikilink,
  onOpenCitation,
}: {
  markdown: string;
  projectId?: string;
  onOpenWikilink?: (target: string) => void;
  onOpenCitation?: (citeKey: string) => void;
}) {
  const html = useMemo(
    () => renderMarkdownWithMathAndLinks(markdown, { projectId }),
    [markdown, projectId],
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const el = (event.target as HTMLElement | null)?.closest("button");
    if (!el) return;
    const wikilink = el.getAttribute("data-wikilink");
    if (wikilink && onOpenWikilink) {
      event.preventDefault();
      onOpenWikilink(wikilink);
      return;
    }
    const citeKey = el.getAttribute("data-citekey");
    if (citeKey && onOpenCitation) {
      event.preventDefault();
      onOpenCitation(citeKey);
    }
  };

  return (
    <div
      className="ori-md-preview"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
