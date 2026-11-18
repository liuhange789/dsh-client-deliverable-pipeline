/**
 * Print-first CSS. The report is a single file, so every rule lives here:
 * an A4 sheet for screen preview, a cover page, running footer, and the
 * pagination rules that keep tables and headings readable in the PDF.
 */

/** Brand colour plus a readable foreground for it. */
export interface Brand {
  /** Validated hex colour, used for fills and rules. */
  color: string
  /** `#ffffff` or `#000000`, whichever contrasts more on the brand fill. */
  ink: string
  /** Opaque colour safe as text on white (links, labels, TOC numbers). */
  text: string
}

/**
 * Build the stylesheet.
 * @param brand - validated brand colour and its ink.
 * @returns CSS for one self-contained report.
 */
export function reportStyles(brand: Brand): string {
  return `
:root {
  --brand: ${brand.color};
  --brand-ink: ${brand.ink};
  --brand-text: ${brand.text};
  --ink: #16181c;
  --muted: #5f6672;
  --line: #d8dde3;
  --soft: #f4f5f7;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  color: var(--ink);
  background: #e9ebee;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 10.5pt;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

.sheet {
  width: 210mm;
  min-height: 297mm;
  margin: 18mm auto;
  padding: 18mm 20mm;
  background: #ffffff;
  box-shadow: 0 2px 18px rgba(15, 20, 30, 0.14);
}

/* ---------- cover ---------- */

.cover {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 245mm;
  border-top: 8px solid var(--brand);
  padding-top: 14mm;
}

.cover .eyebrow {
  margin: 0;
  color: var(--brand-text);
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.cover h1 {
  margin: 10mm 0 0;
  font-size: 34pt;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.cover .subtitle {
  margin: 6mm 0 0;
  max-width: 130mm;
  color: var(--muted);
  font-size: 12pt;
  line-height: 1.6;
}

.cover-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8mm;
  margin: 0;
  padding-top: 8mm;
  border-top: 1px solid var(--line);
}

.cover-meta dt {
  color: var(--muted);
  font-size: 8pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cover-meta dd {
  margin: 1mm 0 0;
  font-size: 11pt;
  font-weight: 600;
}

/* ---------- table of contents ---------- */

.toc { padding-top: 6mm; }

.toc h2 {
  margin: 0 0 8mm;
  font-size: 15pt;
}

.toc ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc li {
  display: flex;
  align-items: baseline;
  gap: 4mm;
  padding: 2.2mm 0;
  border-bottom: 1px solid var(--line);
}

.toc .num {
  min-width: 8mm;
  color: var(--brand-text);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.toc .depth-3 { padding-left: 12mm; color: var(--muted); }
.toc a { color: inherit; text-decoration: none; }

/* ---------- body ---------- */

.content h1 {
  margin: 12mm 0 4mm;
  font-size: 20pt;
  line-height: 1.25;
}

.content h2 {
  margin: 11mm 0 4mm;
  padding-left: 4mm;
  border-left: 4px solid var(--brand);
  font-size: 15pt;
  line-height: 1.3;
}

.content h3 {
  margin: 8mm 0 3mm;
  font-size: 12pt;
}

.content h4 { margin: 6mm 0 2mm; font-size: 11pt; }

.content p { margin: 0 0 4mm; }

.content ul, .content ol { margin: 0 0 4mm; padding-left: 6mm; }
.content li { margin-bottom: 1.5mm; }

.content blockquote {
  margin: 4mm 0;
  padding: 3mm 5mm;
  border-left: 3px solid var(--brand);
  background: var(--soft);
  color: var(--muted);
}

.content code {
  padding: 0.4mm 1.4mm;
  background: var(--soft);
  border: 1px solid var(--line);
  border-radius: 2px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 9pt;
}

.content pre {
  margin: 4mm 0;
  padding: 4mm;
  overflow-x: auto;
  background: #fbfbfa;
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand);
  font-size: 8.8pt;
  line-height: 1.5;
}

.content pre code { padding: 0; border: 0; background: none; }

.content table {
  width: 100%;
  margin: 4mm 0 6mm;
  border-collapse: collapse;
  font-size: 9pt;
  line-height: 1.45;
}

.content thead th {
  padding: 2.2mm 2.6mm;
  background: var(--brand);
  color: var(--brand-ink);
  text-align: left;
  font-weight: 600;
}

.content tbody td, .content tbody th {
  padding: 2mm 2.6mm;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}

.content tbody tr:nth-child(even) { background: #fafbfc; }

.content img { max-width: 100%; height: auto; }

.content hr { margin: 8mm 0; border: 0; border-top: 1px solid var(--line); }

.content a { color: var(--brand-text); }

.print-footer { display: none; }

/* ---------- print ---------- */

@page {
  size: A4;
  margin: 2cm;
}

@media print {
  body { background: #ffffff; font-size: 10pt; }

  .sheet {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }

  .cover {
    min-height: 247mm;
    page-break-after: always;
    break-after: page;
  }

  .toc { page-break-after: always; break-after: page; }

  /* Keep headings with the content they introduce. */
  h1, h2, h3, h4 {
    page-break-after: avoid;
    break-after: avoid;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .content h2 { page-break-before: auto; }

  /* Tables survive pagination: no row split, header repeats. */
  table { page-break-inside: auto; break-inside: auto; }
  thead { display: table-header-group; }
  tr, img, figure, pre, blockquote {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .print-footer {
    display: block;
    position: fixed;
    bottom: -12mm;
    left: 0;
    right: 0;
    padding-top: 2mm;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 7.5pt;
  }

  .print-footer strong { color: var(--brand-text); }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  a { color: inherit; text-decoration: none; }
}
`
}
