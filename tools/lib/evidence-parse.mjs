/**
 * evidence-parse.mjs — 证据档的**唯一**解析器（`frozen` 门与将来任何「读证据档自身」的判据都走这里）。
 *
 * 为什么要有这一层：判据读证据档时，证据档的**正文**里必然出现判据自己的命令与输出（引用产物）。
 * SKILL §六(b)⓵ 把「模式串出现在证据正文里、自己数自己」列为第一号脏源；围栏代码块里贴的输出
 * 正是它的载体 —— 实测反例：把 `AUDITED-BY: pass.md` 写进围栏块 ⇒ 旧脚本 exit 0。
 * 所以本解析器把**围栏块整块剔除**，并且只从**指定小节**取声明，别处出现的同形行一律不采信。
 *
 * **解析歧义一律失败（闭集，不是逐例补丁）**：围栏结构只要有一点说不清，本解析器就报告
 * `fenceIssues` 非空，调用方**必须**按失败处理（`check-frozen-audit.mjs` ⇒ exit 1）。
 * 语义只有一句：**解析器说不清，就不许放行**。歧义种类（闭集，五种，全在此处判定）：
 *   ① `unclosed`     围栏开了没关（到 EOF）
 *   ② `long-run`     开启/闭合用的记号 ≥4 个（```` 之类的「看起来像围栏的内容」）
 *   ③ `mixed-length` 闭合长度 ≠ 开启长度（``` 开、```` 关）
 *   ④ `mixed-char`   同一档里反引号与波浪号混用（含在一种围栏里出现另一种围栏行）
 *   ⑤ `indented`     围栏行带前导空白（缩进围栏）
 * ⛔ 这五种之外一律不新增逐例补丁；要放宽先改这一段的语义，再改调用方。
 *
 * 用法：
 *   import { parseEvidenceFile } from './lib/evidence-parse.mjs'
 *   const ev = parseEvidenceFile('D:/ws/.dsh/evidence/x.md')
 *   ev.fenceIssues    // [] = 结构可判；非空 = **不许放行**（每项 { line, kind, detail }）
 *   ev.declarations   // [{ kind, path, line }]  只来自路径审计小节、围栏之外
 *   ev.auditedBy      // [{ raw, line }]          只来自路径审计小节、围栏之外
 *   ev.sections       // [{ level, title, startLine, endLine }]  围栏外的 ATX 标题切出的小节
 *   ev.unfencedText   // 去围栏后的正文（行号已丢，用于「只是文本」的判断）
 *
 * 口径（写死，别在调用处重写一份）：
 *   · 小节：围栏外的 `## …` 起的 ATX 标题；小节 endLine 到下一个 level ≤ 自己的标题为止。
 *   · 路径审计小节：标题匹配 /路径审计|path[ -]audit/i 的所有小节（多轮追加时可有多个）。
 *   · 声明行 `^(in_scope|out_of_scope|undeclared|illegal) +<path>`；指针行 `^AUDITED-BY: *<path>`。
 * ⛔ 无第三方依赖；import 无副作用。
 */

import { readFileSync } from 'node:fs'

/** 判定行：四分类 + 一个路径 token（其后注记忽略）。 */
export const CLASS_LINE = /^(in_scope|out_of_scope|undeclared|illegal) +(\S+)/
/** 指针行。 */
export const AUDITED_BY_LINE = /^AUDITED-BY: *(\S.*?) *$/
/** 「这一节是路径审计」的标题判据。 */
export const AUDIT_SECTION_TITLE = /路径审计|path[ _-]?audit/i
/** 候选围栏行：允许前导空白（因为「缩进围栏」本身要被判为歧义，不能在这里先把它滤掉）。 */
export const FENCE_LINE = /^([ \t]*)(`{3,}|~{3,})(.*)$/

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/

/**
 * 扫描围栏：给出「是否在围栏内」的逐行标注 + 歧义清单（闭集五种）。
 * 标注是**尽力而为**的（歧义时不许调用方采信）；`fenceIssues` 非空即整个判定作废。
 */
export function scanFences(lines) {
  const mask = new Array(lines.length).fill(false)
  const issues = []
  const push = (line, kind, detail) => issues.push({ line: line + 1, kind, detail })

  let open = null
  let sawBacktick = false
  let sawTilde = false

  for (let i = 0; i < lines.length; i++) {
    const m = FENCE_LINE.exec(lines[i])
    if (m === null) {
      if (open !== null) mask[i] = true
      continue
    }
    const indent = m[1].length
    const marker = m[2]
    const char = marker[0]
    const len = marker.length
    const info = m[3]
    if (char === '`') sawBacktick = true
    else sawTilde = true

    if (open === null) {
      open = { char, len, indent, line: i }
      mask[i] = true
      if (len >= 4) push(i, 'long-run', `opening fence uses ${len} × ${char}`)
      if (indent > 0) push(i, 'indented', `opening fence is indented by ${indent}`)
      continue
    }

    mask[i] = true
    if (char === open.char && info.trim() === '') {
      if (len !== open.len) push(i, 'mixed-length', `opened with ${open.len} × ${open.char}, closed with ${len}`)
      if (indent !== open.indent) push(i, 'indented', `closing fence indent ${indent} ≠ opening indent ${open.indent}`)
      open = null
      continue
    }
    // 围栏行出现在围栏内部：另一种字符（可能是嵌套/混用），或同字符但带 info string
    if (char !== open.char) push(i, 'mixed-char', `${char}-fence line inside a ${open.char}-fence`)
  }

  if (open !== null) push(open.line, 'unclosed', `fence opened here is never closed before EOF`)
  if (sawBacktick && sawTilde) {
    const first = lines.findIndex((l) => FENCE_LINE.test(l))
    push(Math.max(first, 0), 'mixed-char', 'the file uses both ` and ~ fences')
  }

  return { mask, issues }
}

/** 围栏外的 ATX 标题切出的小节。 */
function splitSections(lines, mask) {
  const heads = []
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue
    const h = HEADING.exec(lines[i])
    if (h !== null) heads.push({ idx: i, level: h[1].length, title: h[2] })
  }
  return heads.map((h, k) => {
    let end = lines.length
    for (let j = k + 1; j < heads.length; j++) {
      if (heads[j].level <= h.level) {
        end = heads[j].idx
        break
      }
    }
    return { level: h.level, title: h.title, startLine: h.idx + 1, endLine: end }
  })
}

/**
 * 纯函数：文本 → 解析结果。不读盘、不看 git —— 只回答「这一档**自己**声明了什么」。
 * `fenceIssues` 非空 ⇒ 结构说不清 ⇒ 调用方必须按失败处理（不许按空结果放行）。
 */
export function parseEvidenceText(text) {
  const lines = text.split(/\r?\n/)
  const { mask, issues } = scanFences(lines)
  const sections = splitSections(lines, mask)
  const audits = sections.filter((s) => AUDIT_SECTION_TITLE.test(s.title))

  const declarations = []
  const auditedBy = []
  const scanned = []
  for (const sec of audits) {
    for (let i = sec.startLine; i < sec.endLine; i++) {
      if (mask[i]) continue // 围栏内一律不采信
      const line = lines[i]
      const cls = CLASS_LINE.exec(line)
      if (cls !== null) {
        declarations.push({ kind: cls[1], path: cls[2].replace(/[，,；;（(]+$/, ''), line: i + 1 })
        continue
      }
      const ab = AUDITED_BY_LINE.exec(line)
      if (ab !== null) auditedBy.push({ raw: ab[1], line: i + 1 })
    }
    scanned.push({ title: sec.title, startLine: sec.startLine, endLine: sec.endLine })
  }

  return {
    lines,
    fenceMask: mask,
    fenceLineCount: mask.filter(Boolean).length,
    fenceIssues: issues,
    fenceAmbiguous: issues.length > 0,
    unfencedText: lines.filter((_, i) => !mask[i]).join('\n'),
    sections,
    auditSections: scanned,
    hasAuditSection: audits.length > 0,
    declarations,
    auditedBy,
  }
}

/** 输入路径 → 同上结果（读不出就抛，调用方负责把「读不出」判成失败而不是未适用）。 */
export function parseEvidenceFile(filePath) {
  const text = readFileSync(filePath, 'utf8')
  return { ...parseEvidenceText(text), file: filePath, text }
}

/**
 * 末行口径（**本文件是唯一实现**）：去掉文末空行后的最后一行，并回答它落在围栏内还是围栏外，
 * 以及这一档的围栏结构是否说得清。围栏内的 `RESULT: PASS` 是被引用的输出，不是判定；
 * `issues` 非空时该档的末行同样**不可采信**（解析器说不清，就不许放行）。
 */
export function verdictTail(text) {
  const lines = text.split(/\r?\n/)
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  if (lines.length === 0) return { lastLine: '', fenced: false, issues: [] }
  const { mask, issues } = scanFences(lines)
  return { lastLine: lines[lines.length - 1], fenced: mask[lines.length - 1] === true, issues }
}
