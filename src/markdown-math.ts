import katex from "katex";
import { marked } from "marked";

function escHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch] || ch));
}

function safeImageSrc(href: string, projectId?: string): string {
  const clean = String(href || "").trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  const rel = clean.replace(/^\.?\//, "");
  if (rel && !rel.includes("..") && projectId) {
    return `/api/files?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(rel)}&raw=1`;
  }
  return "";
}

export function renderMarkdownWithMathAndLinks(
  markdown: string,
  options: { projectId?: string } = {},
): string {
  const source = String(markdown || "");
  const mathTokens: Array<{ id: string; expr: string; display: boolean }> = [];
  const makeToken = (index: number) => `ORI_MATH_TOKEN_${index}_PLACEHOLDER`;

  // Extract $$...$$ block math before inline $...$ so underscores don't get mangled by Marked
  let preprocessed = source.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    const id = makeToken(mathTokens.length);
    mathTokens.push({ id, expr: String(expr).trim(), display: true });
    return `\n\n${id}\n\n`;
  });

  preprocessed = preprocessed.replace(/(^|[^\\$])\$([^\n$]{1,400}?)\$/g, (_m, prefix, expr) => {
    const id = makeToken(mathTokens.length);
    mathTokens.push({ id, expr: String(expr).trim(), display: false });
    return `${prefix}${id}`;
  });

  // Replace [[wikilinks]] and [@citeKey] with safe inert placeholders, restored after Marked
  const linkTokens: Array<{ id: string; html: string }> = [];
  preprocessed = preprocessed.replace(/\[\[([^\]]{1,160})\]\]/g, (_m, target) => {
    const id = `ORI_WIKI_TOKEN_${linkTokens.length}_END`;
    const clean = String(target).trim();
    linkTokens.push({
      id,
      html: `<button type="button" class="ori-wikilink" data-wikilink="${escHtml(clean)}">[[${escHtml(clean)}]]</button>`,
    });
    return id;
  });

  preprocessed = preprocessed.replace(/\[@([a-zA-Z0-9_:-]{1,64})\]/g, (_m, key) => {
    const id = `ORI_CITE_TOKEN_${linkTokens.length}_END`;
    linkTokens.push({
      id,
      html: `<button type="button" class="ori-cite-chip" data-citekey="${escHtml(key)}">@${escHtml(key)}</button>`,
    });
    return id;
  });

  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escHtml(text);
  renderer.link = ({ href, title, tokens }) => {
    const text = renderer.parser.parseInline(tokens);
    let safeHref = "";
    try {
      const u = new URL(String(href || ""), "https://example.invalid");
      if (["https:", "http:", "mailto:"].includes(u.protocol)) safeHref = String(href);
    } catch {
      safeHref = "";
    }
    if (!safeHref) return text;
    return `<a href="${escHtml(safeHref)}" target="_blank" rel="noreferrer nofollow"${title ? ` title="${escHtml(title)}"` : ""}>${text}</a>`;
  };
  renderer.image = ({ href, title, text }) => {
    const src = safeImageSrc(href, options.projectId);
    if (!src) return `<span>[Missing image: ${escHtml(text || href)}]</span>`;
    return `<figure class="ori-md-figure"><img src="${escHtml(src)}" alt="${escHtml(text)}" loading="lazy" />${text ? `<figcaption>${escHtml(title || text)}</figcaption>` : ""}</figure>`;
  };

  let html = marked.parse(preprocessed, { renderer, gfm: true, breaks: false, async: false }) as string;

  for (const item of mathTokens) {
    const rendered = katex.renderToString(item.expr, {
      displayMode: item.display,
      throwOnError: false,
      strict: false,
      output: "htmlAndMathml",
    });
    html = html.replace(item.id, rendered);
  }

  for (const tok of linkTokens) {
    html = html.replace(tok.id, tok.html);
  }

  return html;
}
