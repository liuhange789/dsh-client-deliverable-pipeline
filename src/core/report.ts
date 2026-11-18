/**
 * Report assembly: cover + table of contents + rendered Markdown + print CSS
 * in one self-contained HTML file. All caller-supplied strings are escaped.
 */

import type { Brand } from './styles.js'
import { reportStyles } from './styles.js'
import { renderMarkdown, type TocEntry } from './markdown.js'

/** Caller-controlled report identity. */
export interface ReportOptions {
  clientName: string
  title: string
  subtitle: string
  /** Hex colour; validated before it reaches the stylesheet. */
  brandColor: string
  /** Display date, e.g. 2026-11-18. */
  date: string
  /** Extra line for the running footer, e.g. confidentiality notice. */
  footerNote: string
  /** `<html lang>` value. */
  lang: string
}

/** Build result. */
export interface BuiltReport {
  html: string
  headings: TocEntry[]
  brand: Brand
}

/** Escape text for HTML content and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Validate and normalise a hex brand colour.
 * @throws when the value is not `#rgb` / `#rrggbb` / `#rrggbbaa`.
 */
export function normaliseBrandColor(value: string): string {
  const trimmed = value.trim()
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    throw new Error(`brandColor 必须是十六进制颜色（如 #1f6feb），收到：${value}`)
  }
  return trimmed.toLowerCase()
}

/** Parsed colour, alpha in 0-1. */
interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Parse `#rgb` / `#rrggbb` / `#rrggbbaa`; the caller has already validated it. */
function parseHex(hex: string): Rgba {
  const value = hex.replace('#', '')
  const full = value.length === 3
    ? value.split('').map(char => char + char).join('')
    : value.slice(0, 6)
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    a: value.length === 8 ? Number.parseInt(value.slice(6, 8), 16) / 255 : 1,
  }
}

/** Composite over white, which is the report's page background. */
function overWhite(colour: Rgba): { r: number; g: number; b: number } {
  const blend = (channel: number): number => Math.round(channel * colour.a + 255 * (1 - colour.a))
  return { r: blend(colour.r), g: blend(colour.g), b: blend(colour.b) }
}

/** WCAG relative luminance for an opaque colour. */
function luminance(rgb: { r: number; g: number; b: number }): number {
  const channel = (value: number): number => {
    const ratio = value / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** WCAG contrast ratio; order-independent. */
function contrast(first: { r: number; g: number; b: number }, second: { r: number; g: number; b: number }): number {
  const light = Math.max(luminance(first), luminance(second))
  const dark = Math.min(luminance(first), luminance(second))
  return (light + 0.05) / (dark + 0.05)
}

/** `#rrggbb` for an opaque colour. */
function hexOf(rgb: { r: number; g: number; b: number }): string {
  const pad = (value: number): string => value.toString(16).padStart(2, '0')
  return `#${pad(rgb.r)}${pad(rgb.g)}${pad(rgb.b)}`
}

const WHITE = { r: 255, g: 255, b: 255 }
const BLACK = { r: 0, g: 0, b: 0 }

/** Ink colour with the highest contrast on the brand fill. */
export function brandInk(hex: string): string {
  const background = overWhite(parseHex(hex))
  return contrast(background, BLACK) >= contrast(background, WHITE) ? hexOf(BLACK) : '#ffffff'
}

/**
 * Text colour for the brand on a white page: brand itself when it reaches
 * 4.5:1, otherwise progressively darkened until it does.
 */
export function brandText(hex: string): string {
  const base = overWhite(parseHex(hex))
  if (contrast(base, WHITE) >= 4.5) return hexOf(base)
  for (let step = 1; step <= 20; step += 1) {
    const ratio = step * 0.05
    const mixed = {
      r: Math.round(base.r * (1 - ratio)),
      g: Math.round(base.g * (1 - ratio)),
      b: Math.round(base.b * (1 - ratio)),
    }
    if (contrast(mixed, WHITE) >= 4.5) return hexOf(mixed)
  }
  return hexOf(BLACK)
}

/** Remove characters Windows and POSIX reject in file names. */
export function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[\s\u3000]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  const capped = [...cleaned].slice(0, 48).join('')
  return capped === '' ? 'client' : capped
}

/** TOC list, only for headings that make sense to navigate to. */
function tocSection(headings: readonly TocEntry[]): string {
  const entries = headings.filter(heading => heading.depth === 2 || heading.depth === 3)
  if (entries.length < 2) return ''
  const items = entries.map((entry, index) => {
    const label = entry.depth === 3 ? 'depth-3' : 'depth-2'
    return `<li class="${label}"><span class="num">${String(index + 1).padStart(2, '0')}</span><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`
  })
  return `
  <section class="toc">
    <h2>目录</h2>
    <ol>${items.join('')}</ol>
  </section>`
}

/** Cover page. */
function cover(clientName: string, title: string, subtitle: string, date: string): string {
  const sub = subtitle === '' ? '' : `<p class="subtitle">${escapeHtml(subtitle)}</p>`
  return `
  <section class="cover">
    <div>
      <p class="eyebrow">客户交付文档</p>
      <h1>${escapeHtml(title)}</h1>
      ${sub}
    </div>
    <dl class="cover-meta">
      <div><dt>客户</dt><dd>${escapeHtml(clientName)}</dd></div>
      <div><dt>日期</dt><dd>${escapeHtml(date)}</dd></div>
      <div><dt>类型</dt><dd>交付报告</dd></div>
    </dl>
  </section>`
}

/**
 * Assemble the deliverable.
 * @param markdown - report body in Markdown.
 * @param options - identity, brand colour, date, footer.
 * @returns complete HTML plus the outline used for the TOC.
 */
export function buildReport(markdown: string, options: ReportOptions): BuiltReport {
  const color = normaliseBrandColor(options.brandColor)
  const brand: Brand = { color, ink: brandInk(color), text: brandText(color) }
  const rendered = renderMarkdown(markdown)
  const title = options.title.trim() === '' ? `${options.clientName} 交付报告` : options.title.trim()
  const footer = [options.clientName, title, options.date, options.footerNote]
    .map(part => part.trim())
    .filter(part => part !== '')
    .map(part => escapeHtml(part))
    .join(' · ')

  const html = `<!doctype html>
<html lang="${escapeHtml(options.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="dsh-client-deliverable-pipeline">
<title>${escapeHtml(title)} · ${escapeHtml(options.clientName)}</title>
<style>${reportStyles(brand)}</style>
</head>
<body>
<div class="sheet">${cover(options.clientName, title, options.subtitle, options.date)}${tocSection(rendered.headings)}
  <main class="content">${rendered.html}</main>
</div>
<div class="print-footer">${footer}</div>
</body>
</html>
`
  return { html, headings: rendered.headings, brand }
}
