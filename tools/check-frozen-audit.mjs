#!/usr/bin/env node
/**
 * check-frozen-audit.mjs — `frozen` 审查门的机械判据（SKILL §七 里可判对错的那一半）。
 *
 * 用法：
 *   node tools/check-frozen-audit.mjs <证据档> [--repo <dir>] [--base <rev>]
 *     --repo  仓库根，默认 `git rev-parse --show-toplevel`（跑在仓外时退化为 cwd）
 *     --base  比较基线，默认 `HEAD`；传 `HEAD~1` 即可覆盖「已提交」的改动
 *
 * 判据（三件事，缺一不可）：
 *   ① **适用性不看证据档自述**：`git status --porcelain` ∪ `git diff --name-only <base>` 与三个
 *      frozen glob 求交，交集非空 ⇒ 适用；再并上「路径审计小节里声明的 frozen 路径」（仓外/未跟踪的
 *      自称也算数）。⇒ **删掉路径审计小节不再能绕过门**（实测反例：删掉那一节 ⇒ 旧脚本 exit 3）。
 *   ② **指针只认路径审计小节内、围栏之外**的 `AUDITED-BY:`（解析全部走 `lib/evidence-parse.mjs`，
 *      围栏块整块剔除）⇒ **引用输出里的指针不再被当声明采信**（实测反例：围栏块内指针 ⇒ 旧脚本 exit 0）。
 *   ③ 每个指针须满足：目标**存在**且是文件；**非本档**；**末行（围栏外）恰为** `RESULT: PASS`。
 *   ④ **解析歧义即失败**：围栏结构说不清（闭集五种，见 `lib/evidence-parse.mjs`）⇒ 1。
 *      语义一句：**解析器说不清，就不许放行**。这是 tripwire，不是证明 —— 它只会更严，不会更松。
 *
 * 退出码（写死，`--help` 与 SKILL §七 同文）：
 *   0 = **适用且指针有效**
 *   1 = **适用但指针缺失 / 无效 / 解析歧义 / 或无法确定适用性**（git 读不出、参数错、证据档读不出同理）
 *   3 = **不适用** —— ⚠️ **3 不得读作放行**：它只说「这次没触及 frozen」，必须另有判据支撑完成。
 * `false 优先于 null`：不适用但有坏指针或解析歧义 ⇒ 1，不是 3。
 *
 * 输出：stdout 一个 JSON 对象；给人看的报错形状走 stderr，`frozen <path>: <auditor evidence file>`。
 * ⛔ 无第三方依赖；import 本模块无副作用（CLI 只在直接执行时运行）。
 */

import { readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEvidenceFile, verdictTail } from './lib/evidence-parse.mjs'

/** 三个 frozen glob。`re` 是归一化路径上的后缀匹配，与 `glob` 一一对应。 */
const FROZEN_GLOBS = [
  { glob: 'personas/*.md', re: /(^|\/)personas\/[^/]+\.md$/ },
  { glob: 'cordis.patch.yml', re: /(^|\/)cordis\.patch\.yml$/ },
  { glob: 'skills/orch-evidence-protocol/SKILL.md', re: /(^|\/)skills\/orch-evidence-protocol\/SKILL\.md$/ },
]

const PASS_LINE = 'RESULT: PASS'

const USAGE = `usage: node tools/check-frozen-audit.mjs <evidence-file> [--repo <dir>] [--base <rev>]

  exit 0 = applicable and the AUDITED-BY pointer is valid
  exit 1 = applicable but the pointer is missing / invalid / fence structure is ambiguous / applicability cannot be determined
  exit 3 = NOT APPLICABLE — 3 must not be read as a pass; it only says no frozen path was touched

  applicability is derived from git (status + diff against --base), NOT from the evidence file's own text:
    git status --porcelain  ∪  git diff --name-only <base>
  intersected with: ${FROZEN_GLOBS.map((g) => g.glob).join(' · ')}
  the pointer only counts inside the path-audit section and outside fenced code blocks.
  ambiguous fence structure (unclosed / 4+ markers / mixed length / mixed char / indented) ⇒ 1:
  this is a tripwire, not a proof — when the parser cannot tell, nothing is allowed through.`

/** 归一化路径：`\\`→`/`，折叠重复分隔符。 */
function normalize(p) {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
}

/** 命中的 frozen glob 名，未命中返回 null。 */
function frozenGlobFor(rawPath) {
  const norm = normalize(rawPath)
  for (const g of FROZEN_GLOBS) if (g.re.test(norm)) return g.glob
  return null
}

/** git 侧改动集：status ∪ diff(base)。返回 { statusOk, diffOk, files, error }。 */
function gitChangedFiles({ repo, base }) {
  const files = new Set()
  const errors = []
  let statusOk = false
  let diffOk = false
  try {
    const out = execFileSync('git', ['-C', repo, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    statusOk = true
    for (const raw of out.split('\n')) {
      if (raw.trim() === '') continue
      let p = raw.slice(3)
      const arrow = p.indexOf(' -> ')
      if (arrow >= 0) p = p.slice(arrow + 4)
      p = p.replace(/^"(.*)"$/, '$1')
      files.add(normalize(p))
    }
  } catch (e) {
    errors.push('git status: ' + (e.code ?? e.message))
  }
  try {
    const out = execFileSync('git', ['-C', repo, 'diff', '--name-only', base], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    diffOk = true
    for (const line of out.split('\n')) if (line.trim() !== '') files.add(normalize(line.trim()))
  } catch (e) {
    errors.push(`git diff --name-only ${base}: ` + (e.code ?? String(e.message).split('\n')[0]))
  }
  return { statusOk, diffOk, files, errors }
}

/** git 仓根：--repo 优先；否则 show-toplevel；再不行退 cwd。 */
function resolveRepo(explicit) {
  if (explicit !== undefined) return { repo: path.resolve(explicit), source: '--repo' }
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    if (top !== '') return { repo: top, source: 'git rev-parse --show-toplevel' }
  } catch {
    /* 落到 cwd */
  }
  return { repo: process.cwd(), source: 'cwd（git 不可用）' }
}

/**
 * 纯函数核心：给定证据档路径与 git 侧输入，返回判定对象（不自己读 git，便于单测）。
 */
export function evaluateFrozenAudit({ evidenceFile, parsed, git, base }) {
  const baseDir = path.dirname(path.resolve(evidenceFile))

  const declaredFrozen = []
  const seenDeclared = new Set()
  for (const d of parsed.declarations) {
    const glob = frozenGlobFor(d.path)
    if (glob !== null && !seenDeclared.has(d.path)) {
      seenDeclared.add(d.path)
      declaredFrozen.push({ path: d.path, glob, source: 'evidence-file', line: d.line })
    }
  }

  const gitFrozen = []
  if (git.ok) {
    for (const p of git.files) {
      const glob = frozenGlobFor(p)
      if (glob !== null) gitFrozen.push({ path: p, glob, source: 'git' })
    }
  }

  const auditedBy = parsed.auditedBy.map((a) => {
    const resolved = path.isAbsolute(a.raw) ? path.resolve(a.raw) : path.resolve(baseDir, a.raw)
    const entry = { raw: a.raw, line: a.line, resolved, exists: false, isFile: false, isSelf: false, lastLine: null, tailFenced: null, ok: false, why: null }
    if (path.resolve(resolved).toLowerCase() === path.resolve(evidenceFile).toLowerCase()) {
      entry.isSelf = true
      entry.why = 'points at this evidence file itself'
      return entry
    }
    try {
      const st = statSync(resolved)
      entry.exists = true
      entry.isFile = st.isFile()
    } catch {
      entry.exists = false
    }
    if (!entry.exists) {
      entry.why = 'no such file'
      return entry
    }
    if (!entry.isFile) {
      entry.why = 'not a regular file'
      return entry
    }
    let pointed
    try {
      pointed = readFileSync(resolved, 'utf8')
    } catch {
      entry.why = 'unreadable'
      return entry
    }
    const tail = verdictTail(pointed)
    entry.lastLine = tail.lastLine
    entry.tailFenced = tail.fenced
    if (tail.issues.length > 0) {
      entry.why = 'ambiguous fence structure in the pointed file (' + tail.issues.map((x) => `${x.kind}@${x.line}`).join(', ') + ')'
      return entry
    }
    if (tail.fenced) {
      entry.why = 'last line sits inside a fenced block, so it is a quoted output, not a verdict'
      return entry
    }
    if (tail.lastLine !== PASS_LINE) {
      entry.why = 'last line is not exactly ' + PASS_LINE
      return entry
    }
    entry.ok = true
    return entry
  })

  const badPointer = auditedBy.filter((a) => !a.ok)
  const applicable = gitFrozen.length > 0 || declaredFrozen.length > 0
  const determined = git.ok

  const summary = {
    evidenceFile: path.resolve(evidenceFile),
    base,
    repo: git.repo,
    repoSource: git.repoSource,
    gitQueries: { statusOk: git.statusOk, diffOk: git.diffOk, errors: git.errors },
    parsed: {
      hasAuditSection: parsed.hasAuditSection,
      auditSections: parsed.auditSections,
      declarationCount: parsed.declarations.length,
      auditedByCount: parsed.auditedBy.length,
      fenceLineCount: parsed.fenceLineCount,
    },
    frozenGlobs: FROZEN_GLOBS.map((g) => g.glob),
    frozenPaths: [...gitFrozen, ...declaredFrozen],
    fenceIssues: parsed.fenceIssues,
    auditedBy,
  }

  // 解析歧义优先：结构说不清 ⇒ 这一档的任何"声明"都不可信 ⇒ 1（不许按空结果放行，也不许判 3）
  if (parsed.fenceIssues.length > 0) {
    return {
      ...summary,
      ok: false,
      applicable: null,
      reason: 'parse ambiguity in the evidence file: ' + parsed.fenceIssues.map((x) => `${x.kind}@${x.line} (${x.detail})`).join('; '),
    }
  }
  if (badPointer.length > 0) {
    return { ...summary, ok: false, applicable, reason: 'an AUDITED-BY pointer fails one of: exists, not-this-file, last-line-is-RESULT-PASS-outside-fences' }
  }
  if (!determined && !applicable) {
    return { ...summary, ok: false, applicable: null, reason: 'cannot determine applicability: git could not be read and the evidence file declares no frozen path' }
  }
  if (!applicable) {
    return { ...summary, ok: null, reason: 'no frozen path changed (git status ∪ git diff) and none declared — not applicable; 3 must not be read as a pass' }
  }
  if (auditedBy.length === 0) {
    return { ...summary, ok: false, applicable, reason: 'frozen change(s) present but the path-audit section carries no AUDITED-BY line outside fenced blocks' }
  }
  return { ...summary, ok: true, applicable, reason: 'every frozen path is covered by a valid AUDITED-BY pointer' }
}

function parseArgs(argv) {
  const out = { target: undefined, repo: undefined, base: 'HEAD', help: false, errors: [] }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--repo') {
      if (i + 1 >= argv.length) out.errors.push('--repo needs a value')
      else out.repo = argv[++i]
    } else if (a === '--base') {
      if (i + 1 >= argv.length) out.errors.push('--base needs a value')
      else out.base = argv[++i]
    } else rest.push(a)
  }
  out.target = rest[0]
  return out
}

function main(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(USAGE)
    return 0
  }
  if (args.errors.length > 0) {
    console.error(`check-frozen-audit: ${args.errors.join('; ')}\n\n${USAGE}`)
    return 1
  }
  if (args.target === undefined || args.target === '') {
    console.error(`check-frozen-audit: missing <evidence-file>\n\n${USAGE}`)
    return 1
  }

  let parsed
  try {
    parsed = parseEvidenceFile(args.target)
  } catch (e) {
    console.error(`check-frozen-audit: cannot read the evidence file ${args.target} (${e.code ?? e.message})`)
    return 1
  }

  const { repo, source } = resolveRepo(args.repo)
  const gitRaw = gitChangedFiles({ repo, base: args.base })
  const git = { ...gitRaw, ok: gitRaw.statusOk || gitRaw.diffOk, repo, repoSource: source }

  const result = evaluateFrozenAudit({ evidenceFile: args.target, parsed, git, base: args.base })
  console.log(JSON.stringify(result, null, 2))

  if (result.ok === true) return 0
  if (result.ok === null) {
    // 不适用：不要刷报错形状（那会被读成「有 frozen 路径失败」），只把「3 不是放行」说清楚
    console.error('check-frozen-audit: NOT APPLICABLE — 3 must not be read as a pass')
    return 3
  }
  if (Array.isArray(result.fenceIssues) && result.fenceIssues.length > 0) {
    // tripwire：解析说不清 ⇒ 这一档什么都不许过。逐条列出歧义位置，别让人去猜。
    for (const x of result.fenceIssues) console.error(`frozen <ambiguous>: line ${x.line} ${x.kind} (${x.detail})`)
    console.error('check-frozen-audit: PARSE AMBIGUITY — the parser cannot tell, so nothing is allowed through (exit 1; this is a tripwire, not a proof)')
    return 1
  }
  const pointers = result.auditedBy.filter((a) => !a.ok)
  if (result.frozenPaths.length === 0) {
    for (const bad of pointers) console.error(`frozen ${bad.raw}: ${bad.resolved} (${bad.why})`)
    return 1
  }
  for (const fp of result.frozenPaths) {
    if (result.auditedBy.length === 0) {
      console.error(`frozen ${fp.path}: <auditor evidence file> (no AUDITED-BY line in the path-audit section of ${path.basename(args.target)})`)
      continue
    }
    for (const bad of pointers) console.error(`frozen ${fp.path}: ${bad.resolved} (${bad.why})`)
  }
  return 1
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(main(process.argv.slice(2)))
}
