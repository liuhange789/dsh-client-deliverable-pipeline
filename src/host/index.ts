/**
 * Host half of dsh-client-deliverable-pipeline.
 *
 * `build_report` reads a Markdown file from the workspace and writes one
 * self-contained HTML report: cover page, table of contents, brand colour,
 * and print rules that keep tables and headings intact in the PDF export.
 *
 * @module dsh-client-deliverable-pipeline
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { buildReport, safeFileName } from '../core/report.js'

/** Plugin id used by the loader entry and diagnostics. */
export const name = 'client-deliverable-pipeline'

/** Only the tool registry is a hard dependency. */
export const inject = ['tools']

/** Narrow view of the session header the file tools also read. */
interface WorkspaceExec {
  agent?: { session?: { header?: { cwd?: string } } }
}

/** The calling session's workspace, with `process.cwd()` as the fallback. */
function workspaceOf(exec: ToolRunContext): string {
  const view = exec as unknown as WorkspaceExec
  const cwd = view.agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd !== '' ? cwd : process.cwd()
}

/** Resolve a caller path inside the workspace, rejecting escapes. */
function insideWorkspace(workspace: string, candidate: string, label: string): { absolute: string; relative: string } {
  const absolute = path.resolve(workspace, candidate)
  const relative = path.relative(workspace, absolute)
  if (relative === '' || relative.split(path.sep)[0] === '..' || path.isAbsolute(relative)) {
    throw new Error(`${label} 必须位于当前工作区内：${candidate}`)
  }
  return { absolute, relative: relative.split(path.sep).join('/') }
}

/** Local calendar date, `YYYY-MM-DD`. */
function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/** Register the host plugin. */
export function apply(ctx: { tools: { register(definition: unknown): () => void } }): void {
  ctx.tools.register(defineTool({
    name: 'build_report',
    description: [
      'Turn a Markdown file into a client-grade printable HTML report in one call.',
      'Output is a single self-contained .html: branded cover page, auto table of contents, typographic body, running footer, and print rules — A4 @page with 2cm margins, table rows that never split across pages, repeating table headers, headings kept with their content.',
      'Open the file and press Ctrl+P to export a professional PDF. Brand colour must be a hex value; client name and title are HTML-escaped; both input and output must stay inside the session workspace.',
    ].join(' '),
    parameters: {
      inputFile: { type: 'string', required: true, description: '工作区内的 Markdown 源文件，例如 report.md' },
      clientName: { type: 'string', required: true, description: '客户名称，用于封面、页脚与文件名' },
      title: { type: 'string', description: '报告标题，默认「<客户名> 交付报告」' },
      subtitle: { type: 'string', description: '封面副标题，一句话说明交付内容' },
      brandColor: { type: 'string', description: '品牌色（十六进制），默认 #1f6feb' },
      date: { type: 'string', description: '封面日期，默认今天（YYYY-MM-DD）' },
      footerNote: { type: 'string', description: '页脚附加说明，例如「机密 · 仅限内部使用」' },
      lang: { type: 'string', description: 'HTML 语言标记，默认 zh-CN' },
      output: { type: 'string', description: '工作区内的输出路径，默认 Report-<客户>-<时间戳>.html' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          clientName: { type: 'string', required: true },
          title: { type: 'string', required: true },
          brandColor: { type: 'string', required: true },
          sectionCount: { type: 'integer', required: true },
          tocEntries: { type: 'integer', required: true },
          bytes: { type: 'integer', required: true },
          elapsedMs: { type: 'integer', required: true },
        },
      },
      render(_args, value) {
        return [{
          type: 'text',
          text: [
            `交付级报告已生成：\`${value.path}\``,
            '',
            `- 客户：${value.clientName}`,
            `- 标题：${value.title}`,
            `- 品牌色：${value.brandColor}`,
            `- 章节：${value.sectionCount} 个，目录 ${value.tocEntries} 条`,
            `- 大小：${Math.round(value.bytes / 1024)} KB，渲染 ${value.elapsedMs}ms`,
            '',
            '打开后按 `Ctrl+P`：A4、2cm 页边距，表格不断行、表头跨页重复、标题不落单。',
          ].join('\n'),
        }]
      },
    },
    presentCall(args) {
      return { card: 'generic', title: `生成客户报告：${args.clientName}`, kind: 'other', rawInput: { inputFile: args.inputFile, brandColor: args.brandColor } }
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const workspace = workspaceOf(exec)
      const signal = (exec as unknown as { signal?: AbortSignal }).signal
      if (args.clientName.trim() === '') throw new Error('clientName 不能为空')
      const source = insideWorkspace(workspace, args.inputFile, 'inputFile')
      const info = await stat(source.absolute).catch(() => null)
      if (info === null || !info.isFile()) throw new Error(`找不到 Markdown 源文件：${args.inputFile}`)
      if (info.size === 0) throw new Error(`Markdown 源文件为空：${args.inputFile}`)

      const markdown = await readFile(source.absolute, { encoding: 'utf8', signal })
      const startedAt = Date.now()
      const built = buildReport(markdown, {
        clientName: args.clientName,
        title: args.title ?? '',
        subtitle: args.subtitle ?? '',
        brandColor: args.brandColor ?? '#1f6feb',
        date: args.date ?? today(),
        footerNote: args.footerNote ?? '',
        lang: args.lang ?? 'zh-CN',
      })
      const elapsedMs = Date.now() - startedAt

      const output = insideWorkspace(
        workspace,
        args.output === undefined || args.output.trim() === '' ? `Report-${safeFileName(args.clientName)}-${startedAt}.html` : args.output,
        'output',
      )
      if (!output.relative.toLowerCase().endsWith('.html')) throw new Error('output 必须以 .html 结尾')
      await mkdir(path.dirname(output.absolute), { recursive: true })
      await writeFile(output.absolute, built.html, { encoding: 'utf8', signal })

      return {
        path: output.relative,
        clientName: args.clientName,
        title: args.title === undefined || args.title.trim() === '' ? `${args.clientName} 交付报告` : args.title.trim(),
        brandColor: built.brand.color,
        sectionCount: built.headings.filter(heading => heading.depth === 2).length,
        tocEntries: built.headings.filter(heading => heading.depth === 2 || heading.depth === 3).length,
        bytes: Buffer.byteLength(built.html, 'utf8'),
        elapsedMs,
      }
    },
  }))
}
