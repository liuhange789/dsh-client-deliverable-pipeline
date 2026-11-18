import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

/** Load the built host entry the way the loader does (real plugin apply). */
async function loadHost() {
  const module = await import(pathToFileURL(path.resolve('lib/index.js')).href)
  const tools = {}
  const ctx = {
    fiber: { state: 0 },
    tools: { register(tool) { tools[tool.name] = tool } },
    effect(callback) { const dispose = callback(); return typeof dispose === 'function' ? dispose : () => {} },
    on() {},
    logger: console,
    inject() {},
  }
  module.apply(ctx)
  return { module, tools }
}

/** Real workspace exec context. */
const execFor = workspace => ({ agent: { session: { header: { cwd: workspace } } } })

const MARKDOWN = `# 项目进展回顾

本报告覆盖 2026 年 10-11 月的交付进展与风险。

## 概览

- 完成 3 个迭代
- 缺陷率下降 18%
- 客户满意度 4.6 / 5

## 关键指标

| 指标 | 上期 | 本期 | 变化 |
| --- | --- | --- | --- |
| 交付周期 | 14 天 | 11 天 | -21% |
| 遗留缺陷 | 42 | 27 | -36% |
| 自动化覆盖 | 61% | 74% | +13pp |

## 风险与建议

### 风险 1：依赖第三方接口

\`\`\`text
upstream p99 从 220ms 升到 980ms
\`\`\`

建议：加入超时与降级开关。

## 概览

第二段概览（用于验证重复标题的锚点唯一性）。

> 本报告数据截止 2026-11-18。
`

test('registers build_report with required inputFile and clientName', async () => {
  const { tools } = await loadHost()
  assert.ok(tools.build_report)
  assert.deepEqual(tools.build_report.parameters.required, ['inputFile', 'clientName'])
})

test('renders a printable client report with cover, TOC, brand and pagination rules', async () => {
  const { tools } = await loadHost()
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'client-report-'))
  await writeFile(path.join(workspace, 'report.md'), MARKDOWN, 'utf8')

  const result = await tools.build_report.execute({
    inputFile: 'report.md',
    clientName: 'Acme & Co',
    title: '项目进展回顾',
    subtitle: '2026 秋季交付评审',
    brandColor: '#1F6FEB',
    date: '2026-11-18',
    footerNote: '机密 · 仅限内部使用',
  }, execFor(workspace))

  assert.equal(result.brandColor, '#1f6feb')
  assert.equal(result.elapsedMs < 500, true, `render took ${result.elapsedMs}ms`)
  assert.equal(result.sectionCount, 4)
  assert.equal(result.tocEntries, 5)
  assert.match(result.path, /^Report-Acme-&-Co-\d+\.html$/)

  const html = await readFile(path.join(workspace, result.path), 'utf8')
  assert.match(html, /<!doctype html>/)
  assert.match(html, /<style>/)
  assert.match(html, /--brand: #1f6feb/)
  assert.match(html, /@page\s*\{\s*size: A4;\s*margin: 2cm;/, 'A4 with the required 2cm margin')
  assert.match(html, /page-break-inside: avoid/)
  assert.match(html, /page-break-after: avoid/)
  assert.match(html, /display: table-header-group/)
  assert.match(html, /<section class="cover">/)
  assert.match(html, /Acme &amp; Co/, 'client name is escaped')
  assert.match(html, /项目进展回顾/)
  assert.match(html, /2026 秋季交付评审/)
  assert.match(html, /<table>/)
  assert.match(html, /<thead>/)
  assert.match(html, /交付周期/)

  // TOC links must resolve to real ids, including the duplicate heading.
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1])
  assert.ok(anchors.length >= 4)
  for (const anchor of anchors) {
    assert.match(html, new RegExp(`id="${anchor}"`), `missing id for ${anchor}`)
  }
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length, 'ids are unique')
  assert.match(html, /id="概览-2"/)

  // Markdown structure survived.
  assert.match(html, /<ul>/)
  assert.match(html, /<pre><code class="language-text">/)
  assert.match(html, /<blockquote>/)
  assert.ok((await stat(path.join(workspace, result.path))).size < 1024 * 1024)
  assert.match(tools.build_report.output.render({}, result)[0].text, /Ctrl\+P/)
})

test('rejects invalid brand colours instead of writing a broken file', async () => {
  const { tools } = await loadHost()
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'client-report-'))
  await writeFile(path.join(workspace, 'report.md'), MARKDOWN, 'utf8')
  const before = await readdir(workspace)
  await assert.rejects(tools.build_report.execute({
    inputFile: 'report.md',
    clientName: 'Acme',
    brandColor: 'blue',
  }, execFor(workspace)), /十六进制/)
  assert.deepEqual(await readdir(workspace), before)
})

test('rejects missing or empty input and output outside the workspace', async () => {
  const { tools } = await loadHost()
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'client-report-'))
  await writeFile(path.join(workspace, 'report.md'), MARKDOWN, 'utf8')
  await writeFile(path.join(workspace, 'empty.md'), '', 'utf8')

  await assert.rejects(tools.build_report.execute({ inputFile: 'missing.md', clientName: 'A' }, execFor(workspace)), /找不到/)
  await assert.rejects(tools.build_report.execute({ inputFile: 'empty.md', clientName: 'A' }, execFor(workspace)), /为空/)
  await assert.rejects(tools.build_report.execute({ inputFile: 'report.md', clientName: 'A', output: '../../escape.html' }, execFor(workspace)), /工作区内/)
  await assert.rejects(tools.build_report.execute({ inputFile: 'report.md', clientName: 'A', output: '../escape.html' }, execFor(workspace)), /工作区内/)
  await assert.rejects(tools.build_report.execute({ inputFile: '../report.md', clientName: 'A' }, execFor(workspace)), /工作区内/)
  await assert.rejects(tools.build_report.execute({ inputFile: 'report.md', clientName: 'A', output: 'out.pdf' }, execFor(workspace)), /\.html/)
  assert.equal((await readdir(workspace)).filter(name => name.endsWith('.html')).length, 0)
})

test('TOC ids match their own heading text, including headings nested in lists', async () => {
  const { tools } = await loadHost()
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'client-report-'))
  await writeFile(path.join(workspace, 'nested.md'), '- 步骤一\n\n  ## 步骤说明\n\n- 步骤二\n\n## A & B\n\n## 真实章节\n\n## 字段 user_id 说明\n\n正文。\n', 'utf8')
  const result = await tools.build_report.execute({ inputFile: 'nested.md', clientName: 'Gamma' }, execFor(workspace))
  const html = await readFile(path.join(workspace, result.path), 'utf8')
  assert.equal(result.tocEntries, 4)
  assert.match(html, /<h2 id="[^"]+">步骤说明<\/h2>/, 'list heading keeps a matching id')
  assert.match(html, /<h2 id="[^"]+">真实章节<\/h2>/)
  assert.match(html, /<a href="#[^"]+">A &amp; B<\/a>/, 'TOC label is escaped exactly once')
  assert.match(html, /<a href="#[^"]+">字段 user_id 说明<\/a>/, 'literal underscores survive in the TOC label')
  assert.equal(html.includes('&amp;amp;'), false)
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1])
  for (const anchor of anchors) assert.match(html, new RegExp(`id="${anchor}"`))
})

test('light brand colours get a readable text colour on white', async () => {
  const { tools } = await loadHost()
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'client-report-'))
  await writeFile(path.join(workspace, 'report.md'), MARKDOWN, 'utf8')
  const result = await tools.build_report.execute({ inputFile: 'report.md', clientName: 'Delta', brandColor: '#ffff00' }, execFor(workspace))
  const html = await readFile(path.join(workspace, result.path), 'utf8')
  const match = html.match(/--brand-text: (#[0-9a-f]{6});/)
  assert.ok(match, 'brand-text variable is emitted')
  const hex = match[1]
  assert.notEqual(hex, '#ffff00', 'pure yellow is not used as text on white')
  const luminance = value => {
    const channel = parseInt(value, 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  const rgb = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(luminance)
  const ratio = (1.05) / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05)
  assert.ok(ratio >= 4.5, `contrast ${ratio.toFixed(2)} must reach 4.5`)
})

test('small documents still get a cover but no empty TOC page', async () => {
  const { tools } = await loadHost()
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'client-report-'))
  await writeFile(path.join(workspace, 'note.md'), '## 只有一个小节\n\n一句话。\n', 'utf8')
  const result = await tools.build_report.execute({ inputFile: 'note.md', clientName: 'Beta' }, execFor(workspace))
  const html = await readFile(path.join(workspace, result.path), 'utf8')
  assert.equal(result.tocEntries, 1)
  assert.equal(html.includes('<section class="toc">'), false)
  assert.match(html, /<section class="cover">/)
})
