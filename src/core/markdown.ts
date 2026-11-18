/**
 * Markdown → HTML with stable heading ids, so the report's table of contents
 * links resolve both on screen and in the printed PDF's bookmark-less pages.
 * `marked` renders; ids are assigned here in document order.
 */

import { marked } from 'marked'

/** One table-of-contents entry. */
export interface TocEntry {
  depth: number
  /** Plain-text heading. */
  text: string
  /** Id injected into the rendered `<hN>`. */
  id: string
}

/** Rendered document plus the headings found in it. */
export interface RenderedMarkdown {
  html: string
  headings: TocEntry[]
}

/** Named HTML entities that inline text may contain. */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
}

/** Decode the entities `marked` emits, without touching a bare `&`. */
function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, entity => ENTITIES[entity] ?? entity)
}

/**
 * Strip inline Markdown so the TOC shows readable text.
 *
 * Runs on `marked`'s already-rendered inline HTML (`text`), because its `raw`
 * heading source drops characters such as `&`. Tags go first, entities second,
 * which leaves the plain text `report.ts` escapes exactly once.
 */
function plainInline(value: string): string {
  return decodeEntities(
    value
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/** Slug that is unique within the document and URL-safe. */
function slugOf(text: string, used: Set<string>): string {
  const base = plainInline(text)
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-]+|[-]+$/g, '') || 'section'
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

/**
 * Render Markdown and report the heading outline.
 *
 * Headings are recorded by the same renderer that emits the `<hN id>`, so the
 * TOC and the body cannot drift apart — including headings nested in lists.
 * @param markdown - raw Markdown source.
 * @returns HTML plus TOC entries in document order.
 */
export function renderMarkdown(markdown: string): RenderedMarkdown {
  const used = new Set<string>()
  const headings: TocEntry[] = []
  const renderer = new marked.Renderer()
  renderer.heading = (text: string, level: number): string => {
    // `text` is inline HTML, not the heading source: `marked` strips characters
    // like `&` from `raw`, so plain text is recovered from `text` and the TOC
    // label is escaped exactly once in report.ts.
    const plainText = plainInline(text)
    const id = slugOf(plainText, used)
    headings.push({ depth: level, text: plainText, id })
    return `<h${level} id="${id}">${text}</h${level}>\n`
  }

  const html = marked.parse(markdown, { gfm: true, renderer, breaks: false }) as string
  return { html, headings }
}
