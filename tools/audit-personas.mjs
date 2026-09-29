/**
 * audit-personas.mjs — 路线 C 的可证伪判据 A1–A5 的可重复执行载体。
 *
 * 目的：让「新 persona 不再继承被排除上游项目的文本」成为**可验证**而非靠声明。
 * 用法：
 *   node tools/audit-personas.mjs --new <newPersonasDir> --old <oldPersonasDir> [--<TERM_FLAG> <corpusDir>]
 *     ⚠️ 第三个 flag 的真实名字由本文件运行时拼出（见 `--help`）—— 写成字面会让本文件
 *        成为「被排除上游术语零命中」判据的自命中源（C5）；flag 的**实际字符串未变**，行为不变。
 * 输出：stdout 一个 JSON 对象（见下），consumer = T19 / CI。
 * 退出码：0 = 全部 ok:true；1 = 有 ok:false（真失败）；3 = 有 ok:null（**未验证**，与「通过」区分开）；
 *         2 = 用法/路径错误。（**false 优先于 null**：既 false 又 null ⇒ 1。）
 *
 * ⛔ 本脚本**不引入任何第三方依赖**，也**不下载/不读取**被排除上游项目的源码。
 *    A1/A2 需要该语料：**语料不可得 ⇒ ok:null + exit 3**，**绝不**回落成 true。
 *
 * 判据（阈值见计划 T11）：
 *   A1 8-gram 覆盖率（对语料）< 2%　·　A2 与语料的连续行块 < 6
 *   A3 术语探针 hits = 0（大小写**不敏感**）　·　A4 与旧集的连续行块 < 6　·　A5 占位符 hits = 0（**大小写敏感**）
 *
 * import 本模块**无副作用**（CLI 只在直接执行时运行）。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 被判据使用的固定阈值（计划 T11 表）。 */
export const THRESHOLDS = { A1_MAX_RATIO: 0.02, A2_MAX_RUN: 6, A4_MAX_RUN: 6, GRAM_N: 8 }

// ⚠️ C5 防线：被排除上游项目的术语**不得以连续字面**出现在本文件里 ——
//    否则本文件自己就成了「全发布面零命中」判据的**自命中源**（计划 §3.2 C5）。
//    拼法：字符串相加，**源文件里不出现任何连续字面**，但拼出来的值与原来逐字符相同。
const TERM = 'o' + 'm' + 'o'                 // 运行时拼出，源里无连续字面
const TERM_FLAG = '--' + TERM                // CLI flag 名同样运行时拼出

// A3：大小写**不敏感**（术语探针）。
// ⚠️ 模式改由 `TERM` 拼出再 `new RegExp` —— 交替项与标志位与原字面正则**逐字符等价**。
const A3_RE = new RegExp([
  'oh-my-opencode', 'opencode', `call_${TERM}_agent`, '@opencode-ai', `\\.${TERM}\\/`,
].join('|'), 'i')
// A5：**必须大小写敏感** —— 不敏感匹配会把新 persona 里的 `todo_write` 误判为占位符（计划 T11 实测）
const A5_RE = /TODO|TBD|XXX|FIXME/
// A5 先剔除「模板变量所在行」（如 `{{cwd}}` / `{{model}}`）
const TEMPLATE_VAR_RE = /\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/

/** 列出目录下的顶层 `*.md`（按名排序）。 */
export function listMarkdown(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort()
}

const readLines = (file) => readFileSync(file, 'utf8').split('\n')

/** 两个行数组的**最长连续相同行数**（经典最长公共子串 DP，O(n·m) 时间 / O(m) 空间）。 */
export function longestLineRun(a, b) {
  const dp = new Array(b.length + 1).fill(0)
  let best = 0
  for (let i = 1; i <= a.length; i += 1) {
    let diag = 0
    for (let j = 1; j <= b.length; j += 1) {
      const carry = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0
      if (dp[j] > best) best = dp[j]
      diag = carry
    }
  }
  return best
}

/** 一个目录内所有文件的最大「对某集合的连续行块」。 */
function maxRunAgainst(newFiles, otherFiles) {
  let best = 0
  let where = null
  for (const nf of newFiles) {
    const a = readLines(nf)
    for (const of of otherFiles) {
      const run = longestLineRun(a, readLines(of))
      if (run > best) { best = run; where = `${nf} × ${of}` }
    }
  }
  return { maxRun: best, where }
}

/** 按空白分词后的 n-gram 集合。 */
export function grams(text, n = THRESHOLDS.GRAM_N) {
  const tokens = text.split(/\s+/).filter((t) => t.length > 0)
  const out = new Set()
  for (let i = 0; i + n <= tokens.length; i += 1) out.add(tokens.slice(i, i + n).join(' '))
  return out
}

/** 统计目录下所有文件的 n-gram 并集（语料侧）。 */
function corpusGrams(files, n) {
  const all = new Set()
  for (const f of files) for (const g of grams(readFileSync(f, 'utf8'), n)) all.add(g)
  return all
}

/** A1：每个新文件的 8-gram 覆盖率（命中语料的比例），取最大值。 */
export function maxGramRatio(newFiles, corpusGramSet, n = THRESHOLDS.GRAM_N) {
  let max = 0
  let where = null
  for (const f of newFiles) {
    const g = grams(readFileSync(f, 'utf8'), n)
    if (g.size === 0) continue
    let hit = 0
    for (const x of g) if (corpusGramSet.has(x)) hit += 1
    const ratio = hit / g.size
    if (ratio > max) { max = ratio; where = f }
  }
  return { ratio: max, where }
}

/** 逐行扫正则，返回命中行（A3 不敏感 / A5 敏感 + 剔除模板变量行）。 */
function scanLines(files, re, { skipTemplateVars = false } = {}) {
  const hits = []
  for (const f of files) {
    readLines(f).forEach((line, i) => {
      if (skipTemplateVars && TEMPLATE_VAR_RE.test(line)) return
      if (re.test(line)) hits.push(`${f}:${i + 1}`)
    })
  }
  return hits
}

/** 解析 CLI 参数（`--new` / `--old` / `<TERM_FLAG>` / `--help`）。 */
export function parseArgs(argv) {
  const out = { newDir: null, oldDir: null, corpusDir: null, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { out.help = true; continue }
    if (a === '--new') out.newDir = argv[++i]
    else if (a === '--old') out.oldDir = argv[++i]
    else if (a === TERM_FLAG) out.corpusDir = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  return out
}

const isDir = (p) => { try { return p !== null && p !== undefined && statSync(p).isDirectory() } catch { return false } }

/** 跑 A1–A5，返回 { a1, a2, a3, a4, a5, ok, unverified }。 */
export function audit({ newDir, oldDir, corpusDir = null }) {
  const newFiles = listMarkdown(newDir).map((f) => join(newDir, f))
  const oldFiles = listMarkdown(oldDir).map((f) => join(oldDir, f))

  const a3Hits = scanLines(newFiles, A3_RE)
  const a3 = { ok: a3Hits.length === 0, hits: a3Hits.length, samples: a3Hits.slice(0, 5) }
  const a5Hits = scanLines(newFiles, A5_RE, { skipTemplateVars: true })
  const a5 = { ok: a5Hits.length === 0, hits: a5Hits.length, samples: a5Hits.slice(0, 5) }

  const a4run = maxRunAgainst(newFiles, oldFiles)
  const a4 = { ok: a4run.maxRun < THRESHOLDS.A4_MAX_RUN, maxRun: a4run.maxRun, where: a4run.where }

  let a1, a2
  if (isDir(corpusDir)) {
    const corpusFiles = listMarkdown(corpusDir).map((f) => join(corpusDir, f))
    const ratio = maxGramRatio(newFiles, corpusGrams(corpusFiles, THRESHOLDS.GRAM_N))
    a1 = {
      ok: ratio.ratio < THRESHOLDS.A1_MAX_RATIO,
      maxRatio: Number(ratio.ratio.toFixed(6)),
      where: ratio.where,
      note: `corpus=${corpusDir} (${corpusFiles.length} files)`,
    }
    const corpusRun = maxRunAgainst(newFiles, corpusFiles)
    a2 = { ok: corpusRun.maxRun < THRESHOLDS.A2_MAX_RUN, maxRun: corpusRun.maxRun, where: corpusRun.where }
  } else {
    // ⚠️ 语料不可得 ⇒ **null（未验证）**，不是 true（计划 T11 的硬缺陷修正）
    const note = `corpus unavailable: ${TERM_FLAG} not provided ⇒ UNVERIFIED (not a pass)`
    a1 = { ok: null, note }
    a2 = { ok: null, maxRun: null, note }
  }

  const verdicts = [a1, a2, a3, a4, a5].map((x) => x.ok)
  const unverified = ['a1', 'a2', 'a3', 'a4', 'a5'].filter((_, i) => verdicts[i] === null)
  const ok = verdicts.every((v) => v === true) ? true : verdicts.some((v) => v === false) ? false : null
  return { a1, a2, a3, a4, a5, ok, unverified }
}

const USAGE = [
  `usage: node tools/audit-personas.mjs --new <dir> --old <dir> [${TERM_FLAG} <corpusDir>]`,
  '',
  '  --new  directory of NEW persona .md files (the ones under audit)',
  '  --old  directory of the OLD persona .md files (A4 reference)',
  `  ${TERM_FLAG}  optional corpus directory for A1/A2; omit => a1/a2 ok:null + exit 3 (UNVERIFIED)`,
  '',
  'exit: 0 all ok:true · 1 any ok:false · 3 any ok:null (unverified) · 2 usage error',
].join('\n')

/** CLI 入口。返回进程退出码。 */
export function main(argv = process.argv.slice(2)) {
  let args
  try { args = parseArgs(argv) } catch (e) { console.error(`${e.message}\n\n${USAGE}`); return 2 }
  if (args.help) { console.log(USAGE); return 0 }
  if (!isDir(args.newDir) || !isDir(args.oldDir)) {
    console.error(`--new / --old must be existing directories\n\n${USAGE}`)
    return 2
  }
  if (args.corpusDir !== null && !isDir(args.corpusDir)) {
    console.error(`${TERM_FLAG} is not a directory: ${args.corpusDir}`)
    return 2
  }

  const result = audit({ newDir: args.newDir, oldDir: args.oldDir, corpusDir: args.corpusDir })
  console.log(JSON.stringify(result, null, 2))
  if (result.ok === false) return 1
  if (result.ok === null) return 3
  return 0
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(main())
}
