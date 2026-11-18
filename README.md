# dsh-client-deliverable-pipeline

**Markdown 进，客户级交付报告出：封面、目录、品牌色、能打印的 A4 排版。**
**Markdown in, a client-grade printable HTML report out.**

把会议记录、分析结论、项目周报这类 Markdown 变成可以直接发给客户的 HTML 报告——不是"能看"，而是**能打印、能导出 PDF、不会在分页处断表格**。单文件输出，无外部 CSS/JS/字体依赖。

## Install

```bash
npm install @liuhange/dsh-client-deliverable-pipeline
```

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-headless",
        "@liuhange/dsh-client-deliverable-pipeline"
      ]
    }
  },
  "dependencies": {
    "@liuhange/dsh-client-deliverable-pipeline": "0.1.0"
  }
}
```

Restart the profile. One tool appears: `build_report`.

## Quick start

```
你：把 report.md 做成给 Acme 的交付报告，品牌色 #1f6feb
模型：build_report  inputFile="report.md"  clientName="Acme"  brandColor="#1f6feb"  subtitle="2026 秋季交付评审"

交付级报告已生成：`Report-Acme-1795000000000.html`
- 客户：Acme
- 章节：4 个，目录 5 条
- 大小：31 KB，渲染 12ms

打开后按 Ctrl+P：A4、2cm 页边距，表格不断行、表头跨页重复、标题不落单。
```

## Command

### `build_report`

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `inputFile` | 是 | 工作区内的 Markdown 源文件 |
| `clientName` | 是 | 客户名称，用于封面、页脚与文件名 |
| `title` | 否 | 报告标题，默认「<客户名> 交付报告」 |
| `subtitle` | 否 | 封面副标题 |
| `brandColor` | 否 | 十六进制品牌色，默认 `#1f6feb`；其他格式直接报错 |
| `date` | 否 | 封面日期，默认今天（`YYYY-MM-DD`） |
| `footerNote` | 否 | 页脚附加说明，例如「机密 · 仅限内部使用」 |
| `lang` | 否 | `<html lang>`，默认 `zh-CN` |
| `output` | 否 | 输出路径，默认 `Report-<客户>-<时间戳>.html`；必须在工作区内且以 `.html` 结尾 |

返回：`path`、`clientName`、`title`、`brandColor`、`sectionCount`、`tocEntries`、`bytes`、`elapsedMs`。

## What the output contains

- **封面页**：品牌色顶条、报告标题、副标题、客户/日期/类型三栏信息；打印时独占第一页。
- **目录页**：自动从 H2/H3 生成，编号 + 锚点；少于 2 条时不生成空目录页。
- **正文排版**：品牌色 H2 左边线、品牌色表头、代码块、引用块、条纹表格。
- **打印规则**（核心）：

```css
@page { size: A4; margin: 2cm; }

@media print {
  .cover { page-break-after: always; }
  h1, h2, h3, h4 { page-break-after: avoid; }
  thead { display: table-header-group; }
  tr, img, figure, pre, blockquote { page-break-inside: avoid; }
}
```

即：封面独占一页、标题不会孤零零留在页底、表格行不被切断、表头在每页重复、图片/代码块不被劈开。

- **页脚**：`客户 · 标题 · 日期 · 附加说明`，打印时固定在每页底部。

## Runtime contract

- 无外部 CSS/JS/字体依赖；断网也能打开与打印。Markdown 里引用的图片仍由浏览器按原 URL 加载（打印前需保证可访问）。
- 品牌色按 WCAG 相对亮度处理：浅色品牌色（如 `#ffff00`）不会被拿来当白底文字，链接/目录编号会自动压深到 4.5:1 以上；封面文字则自动选黑或白；`#rrggbbaa` 的 alpha 会先合成到白底再计算对比度。
- 渲染耗时 < 500ms（Markdown 解析 + 模板拼装），不依赖浏览器内核。
- 客户名、标题、副标题、页脚均做 HTML 转义；文件名剔除 Windows/POSIX 非法字符。
- 输入/输出路径必须位于当前会话工作区内，越界直接报错，不落半成品。

## Known limits

- Markdown 里的原始 HTML 会原样透传（`marked` 不过滤）——报告内容由你提供，请不要把不可信 HTML 喂进来。
- 目录只索引 H2/H3；H1 视为正文标题，不进目录。
- 页码由浏览器打印引擎生成，HTML 内不做页码计数（避免 `@page` 计数器兼容性问题）。
- 只做排版，不做图表渲染；需要图表请先在 Markdown 里放图片。

## Development

```bash
npm install
npm run typecheck   # strict, no any
npm test            # build + real plugin load + real file calls
```

## License

MIT
