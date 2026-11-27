"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";

export type EditorLanguage = "markdown" | "python" | "javascript" | "json" | "text";

export function CodeEditor({
  value,
  onChange,
  language = "markdown",
  readOnly = false,
  minHeight = 260,
  ariaLabel = "Code and notes editor",
}: {
  value: string;
  onChange?: (next: string) => void;
  language?: EditorLanguage;
  readOnly?: boolean;
  minHeight?: number;
  ariaLabel?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const langExt = language === "python"
      ? [python()]
      : language === "javascript" || language === "json"
        ? [javascript({ jsx: false, typescript: false })]
        : language === "markdown"
          ? [markdown()]
          : [];

    const theme = EditorView.theme({
      "&": {
        fontSize: "13.5px",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        backgroundColor: "var(--bg-surface)",
        color: "var(--text-primary)",
        borderRadius: "10px",
        border: "1px solid var(--border-strong)",
        minHeight: `${minHeight}px`,
        maxHeight: "640px",
      },
      ".cm-scroller": {
        overflow: "auto",
        minHeight: `${minHeight}px`,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        lineHeight: "1.58",
      },
      ".cm-gutters": {
        backgroundColor: "var(--bg-subtle)",
        color: "var(--text-muted)",
        borderRight: "1px solid var(--border-subtle)",
        borderTopLeftRadius: "10px",
        borderBottomLeftRadius: "10px",
      },
      ".cm-content": {
        padding: "12px 10px",
        caretColor: "var(--accent)",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--accent-tint)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--bg-hover)",
      },
      "&.cm-focused": {
        outline: "2px solid var(--accent)",
        outlineOffset: "1px",
      },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        EditorView.lineWrapping,
        theme,
        ...langExt,
        EditorState.readOnly.of(readOnly),
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChangeRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readOnly, minHeight, ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="ori-cm-host" />;
}
