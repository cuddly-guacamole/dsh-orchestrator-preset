// ============================================================================
// patch-contract.test.mjs — cordis.patch.yml 的**架构契约**测试（不是字节快照）
// ============================================================================
//
// 为什么需要它：`gen-cordis-patch.mjs --check` 只能抓一类漂移 ——
// 「声明改了但产物没重新生成」。它**抓不到**「生成器自己产出了结构上错误的东西」：
// --check 的判据是 render() 的输出与文件逐字节相等，两边来自同一条代码路径，
// 生成器写错了，两边一起错，--check 仍然 exit 0。
// ⇒ 本文件改抓**架构约束**：形状、行 id 集合、与官方 preset 的关系、行边界、
//   以及「本项目的机械强制清单」里那几条**值级别**的不变量（官方行的 config 逐字、
//   lane 的 maxDepth、group 的 isolate）。这三条曾经**零断言覆盖**：改声明再重新生成，
//   `--check` 与本文件一起绿。每一条的来源都写在断言的注释里。
//   这些约束即使生成器整体改错也必须成立。
//
// 依赖：**零第三方包**（只用 node: 内置模块 + node:test）。理由见 package.json 的 `files`
//   白名单 —— `tools/` 不进 npm 产物，作者工具链刻意不引第三方（gen-cordis-patch.mjs
//   同样只用 node:）。加 vitest/jest 会与这条自定的设计冲突。
//   ⚠️ 但「零第三方依赖」**不等于**「零宿主前提」。这个套件必须在**装好 DSH 的机器**上跑，
//   而且有两条宿主前提；缺任一条都 **loud 停**，不 skip（skip 只会让假门再多一层）：
//   ① `import './preset-declaration.mjs'` 会在**模块顶层**执行 `resolveShellSource()`
//      （`preset-declaration.mjs:358`），它按来源链取 shell 工具的生效值：
//      `$DSH_FROZEN_ASSEMBLED` → `$DSH_SHELL_ROWS` / `$DSH_HOME/profiles/web/cordis.yml`
//      → 兜底 spawn `dsh --profile web --dump-config`。链全落空 ⇒ 抛错 ⇒ 本文件 import 即死。
//      ⇒ 前提 = **一个可用的 DSH 安装 + 一个 `web` profile**（desktop 的 `cordis.yml` 是
//      4 行空 root，按设计不能当来源，见 `preset-declaration.mjs:187`）。
//   ② 权威骨架 `SKELETON` 解析到**已安装的**
//      `@deepseek-ai/dsh-web-app/presets/standard.patch.yml`（优先级 `--skeleton` >
//      `$DSH_SKELETON` > `<DSH home>` > 仓内 vendor，`gen-cordis-patch.mjs:101-129`）。
//      **本仓没有 vendor 的 `presets/` 目录**，第 ④ 条候选路径
//      （`gen-cordis-patch.mjs:69-75`）在克隆下来的仓里不存在 ⇒ 在未装 DSH 的机器上必然取不到。
//   ⚠️ 换 DSH 版本的**已知后果**：更新的 standard preset 若**不再带** DESIGN §2.3 那 10 个
//      被删行中的任何一个，§4 的「清单过期」那条断言会失败。那是**正确**的失败 —— 该更新的是
//      删除清单，不是让测试让步。
//
// 运行：node --test tools/    或    npm test
//
// 断言的对象是**已提交的 cordis.patch.yml**（消费者真正拿到的那份），
// 而**期望值全部从 tools/preset-declaration.mjs 推导**（单一事实源），
// 官方行的期望值则**从已安装的骨架文件现场读**（骨架才是权威，见 §5 的注释）。
// 这里不复制任何一行 patch 的内容 —— 复制了就退化成快照。
// ============================================================================

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import * as d from './preset-declaration.mjs'
import {
  OUT_PATH, SKELETON, SKELETON_RESOLVED, extractPlanModeSection, render, groupEntry, countRows, countFileEntries,
  // ↓ 「产物里哪几行不参与逐字节比较」这条事实的**唯一 home** 在生成器那边：门与测试共用
  //   同一个实现。两处各写一份遮蔽规则 = 两个 home = 迟早分叉 = 又一层「绿色掩盖红色」。
  MACHINE_DERIVED_LINE, compareMachineIndependent, provenanceLineOf,
} from './gen-cordis-patch.mjs'

// 「改坏一行」用的探针串：必须**真实存在**于产物，否则替换落空、断言恒真。
// 它随产物形状变化 —— 这正是它存在的理由，也是它必须被自检的理由。
// 0.2.1-rc.2 起 lane 行的 config 是**普通映射**（不再是合成的 `!!js` 表达式），
// 所以探针换成新形态里一条真实的、唯一的标量行：某条 lane 的 `agentPreset` 值。
// 上面那条 `includes` 断言就是这条探针的**自检**：形状再变时它会先红，
// 而不是让「改坏一行」的检查静默失效（那是比失败更糟的绿色）。
const TAMPER_PROBE = "agentPreset: 'orch-lane-scout'"

/** 仓根 = 产物所在目录（`OUT_PATH` = `<repo>/cordis.patch.yml`）。 */
const REPO_ROOT = dirname(OUT_PATH)

// ── 取值槽：与生成器同一套解析（--skeleton > $DSH_SKELETON > DSH home > 仓内 vendor）──
let section
let committed
let skeletonText
before(() => {
  // ⛔ 取不到权威骨架 ⇒ **loud 停**，不 skip：skip 会让本文件在没有依据的机器上
  //    静悄悄「通过」，那正是 --check 之外又一层假门。与生成器的 exit 2 同一语义。
  assert.notEqual(SKELETON, null,
    `权威骨架取不到 ⇒ 停（与 gen-cordis-patch.mjs 的 exit 2 同一语义）：\n  ${SKELETON_RESOLVED.tried.join('\n  ')}`)
  section = extractPlanModeSection(SKELETON)
  committed = readFileSync(OUT_PATH, 'utf8')
  skeletonText = readFileSync(SKELETON, 'utf8')
})

// ── 最小结构解析：只取本文件需要的三件事（`- id:` 的缩进 / 同块的 `name:` / `toolFilter` 子键）──
// ⚠️ 不是 YAML 解析器。它只依赖 render() 固定下来的缩进 0/4/6/8/10/12/14；
//    缩进一变，这里会失败（而不是悄悄给出错误的结构）—— 那正是我们要的。
const idLine = /^(\s*)- id: (.+)$/
const nameLine = /^(\s*)name: (.+)$/

function parseRows(text) {
  const lines = text.split('\n')
  const rows = []
  for (let i = 0; i < lines.length; i += 1) {
    const m = idLine.exec(lines[i])
    if (m === null) continue
    const indent = m[1].length
    // 同块的第一个 `name:`（缩进 = id 的缩进 + 2）
    let name = null
    for (let j = i + 1; j < lines.length; j += 1) {
      if (idLine.test(lines[j])) break
      const n = nameLine.exec(lines[j])
      if (n !== null && n[1].length === indent + 2) { name = n[2].trim().replace(/^'|'$/g, ''); break }
    }
    rows.push({ id: m[2].trim(), indent, name, startLine: i + 1 })
  }
  return rows
}

const rows = () => parseRows(committed)
const idsAt = (indent) => rows().filter((r) => r.indent === indent).map((r) => r.id)

// ── `!!js` 取值（0.2.1-alpha.3 迁移新增）─────────────────────────────────────────
// lane 行的 `agentPreset` / `allowedAgentPresets` / `toolFilter` 现在是 `!!js` **表达式**
// （按宿主分档），不再是字面量 ⇒ 断言不能只看文本形状，要看**求值结果**。
// 这里刻意**不引第三方 YAML 库**（本文件自定「零第三方包」），也**不调宿主**（保留「无宿主也能跑」）：
// 只把 `!!js ` 后面的表达式文本抠出来，在**两个固定世界**里各求值一次。
//
// 两个世界用 `baseUrl` 区分，与声明侧的判据同源：
//   · `LEGACY_BASE` 解析不到 `@deepseek-ai/dsh-tool-subagent` ⇒ 门为真 ⇒ **旧形态**
//   · `NEW_BASE` 指向本仓自己的 `package.json` —— **重要**：不能指向已安装的宿主，
//     否则这条测试的读数会随「本机装的是哪版 dsh」而变，在 alpha.2 机器上假红。
//     用本仓 `package.json` 时，`@deepseek-ai/dsh-tool-subagent` 解析**必然失败**
//     （本包不依赖它）⇒ 门为真 —— 那样两个世界就一样了，测不出分档。
// ⇒ 所以 `NEW_BASE` 指向一个**只含 dsh-tool-subagent 的翻砂目录**（见下方 stub），
//   由本文件在临时目录里造出来，内容固定 ⇒ 读数确定、可复现、与宿主安装无关。
const LEGACY_BASE = 'probe-nonexistent-root/package.json'
const evaluator = new Function('ctx', 'expr', 'with (ctx) { return eval(expr) }')
const evalJs = (exprText, baseUrl) => evaluator({ baseUrl, get: () => undefined, loader: { entries: () => [] } }, exprText)
/** 从一行里抠出 `!!js ` 之后的表达式文本。 */
const jsExprOf = (line) => {
  const i = line.indexOf('!!js ')
  return i === -1 ? null : line.slice(i + 5).trim()
}

/**
 * ⛔ **把一行 lane 求值成「宿主真正收到的 config 对象」，然后断言它的 key set。**
 *
 * 为什么必须有这个 helper（一次生产事故换来的）：旧断言只看**单个 `!!js` 表达式的返回值**
 * （`assert.equal(evalJs(...), undefined)` 之类），而 `undefined` 读起来就像「键不存在」。
 * **那不是宿主看到的东西。** 宿主链路是 `interpolate` → `valueMap`
 * （`cordis-plugin-loader/lib/index.js:243`，实现为 `Object.fromEntries(Object.entries(o).map(...))`）
 * ⇒ **值为 `undefined` 的键仍然在对象上**，而 `dsh-tool-subagent:355` 是按
 * `Object.hasOwn(config, field)` 判的 ⇒ 描述「表达式返回 undefined」的断言
 * **无法观察到 key 是否存在**，于是全绿地放过了一个会被宿主硬拒的产物。
 *
 * ⇒ 本 helper 求值**整张 config 映射**（它现在是一个返回对象的 `!!js` 表达式），
 *   断言对象上的**键**。看不见 key set 的测试保护不了 key-presence 契约。
 */
const composedConfigOf = (blockOrLines, baseUrl) => {
  // 接受行数组或整块文本（行数组是产物里的常见形态，避免调用方到处 join）
  const text = Array.isArray(blockOrLines) ? blockOrLines.join('\n') : String(blockOrLines)
  const line = text.split('\n').find((l) => /^\s*config: !!js /.test(l))
  assert.ok(line, 'lane 行的 config 不是单个 !!js 表达式（形态分档会退化成键固定）')
  return evalJs(jsExprOf(line), baseUrl)
}

/**
 * 读一条 lane 行的 config —— 它现在是**普通映射**（0.2.1-rc.2 起不再用 `!!js` 构造键集）。
 *
 * ⚠️ 这个 helper 取代了 `composedConfigOf` 在 lane 行上的用途。`composedConfigOf` 断言
 *    「config 是一整条 `!!js` 表达式」，那条断言在形态删除后必然失败 —— 但它想保护的
 *    「断言对象上的**键**，而不是某个表达式的返回值」在这里仍然成立，而且更直接：
 *    普通映射的键就是宿主收到的键，中间没有求值这一步。
 *
 * 只解析本产物固定的缩进（lane 行的 config 子键在 `config:` 下一级），不引 YAML 库。
 */
const plainConfigOf = (blockLines) => {
  const lines = Array.isArray(blockLines) ? blockLines : String(blockLines).split(/\r?\n/)
  const ci = lines.findIndex((l) => /^\s*config:\s*$/.test(l))
  if (ci < 0) return null
  const baseIndent = /^\s*/.exec(lines[ci])[0].length
  const out = {}
  let pendingKey = null            // a key whose value is a block sequence
  let pendingIndent = -1
  for (let i = ci + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === '') continue
    const indent = /^\s*/.exec(l)[0].length
    if (indent <= baseIndent) break                 // back out of the config mapping
    // A list item under the key we just opened (e.g. allowedAgentPresets).
    const item = /^\s*-\s*(.*)$/.exec(l)
    if (item !== null && pendingKey !== null && indent > pendingIndent) {
      out[pendingKey].push(item[1].trim().replace(/^'|'$/g, ''))
      continue
    }
    const m = /^\s*([A-Za-z_][\w-]*):\s*(.*)$/.exec(l)
    if (m === null) continue
    const value = m[2].trim().replace(/^'|'$/g, '')
    if (value === '') { out[m[1]] = []; pendingKey = m[1]; pendingIndent = indent }
    else { out[m[1]] = value; pendingKey = null; pendingIndent = -1 }
  }
  return out
}

/**
 * 造两个**固定的**桩世界，让本文件的读数与「本机装的是哪版 dsh」无关。
 *
 * `newHost`：一个可解析的 `@deepseek-ai/dsh-tool-subagent`，其 `lib/index.js` 里
 *   `Config` 字面量**不含** `persona:` ⇒ 门判为「新形态」。
 * `oldHost`：同样的桩，但 `Config` 字面量**含** `persona:` ⇒ 门判为「旧形态」。
 *
 * ⚠️ 为什么不直接指向真宿主：那样这条测试的读数会随本机 dsh 版本漂移 ——
 *    在 alpha.2 的机器上，「新形态」那组断言会全红，而那些断言**本身是对的**。
 *    测试要考的是**产物在两个世界里的行为**，不是**本机装了什么**。
 */
function makeHostStub(kind, version, declaresPersona) {
  const root = join(tmpdir(), `orch-contract-${kind}-${process.pid}`)
  const pkgDir = join(root, 'node_modules', '@deepseek-ai', 'dsh-tool-subagent')
  mkdirSync(join(pkgDir, 'lib'), { recursive: true })
  // ⛔ The gate now reads the PACKAGE VERSION, so the stub must carry a real one.
  // That is the discriminating fact: alpha.3 / alpha.4 / alpha.5 are structurally
  // identical to the supported host (same Config keys, agentPreset +
  // allowedAgentPresets, no persona) and differ ONLY in the version string. A
  // shape-only stub cannot tell them apart — which is exactly why the old
  // persona-shape probe let alpha.3 through.
  writeFileSync(join(pkgDir, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh-tool-subagent', version, main: 'lib/index.js' }))
  // `declaresPersona` reproduces the OLD contract (0.2.0-rc.2 / alpha.1 / alpha.2).
  // It is the second, OR-ed half of the gate: a host that still declares persona: is
  // unsupported even when its version cannot be read.
  const body = declaresPersona
    ? 'provider: z.string(),\n\tpersona: z.string(),\n\ttoolFilter: z.any()'
    : 'provider: z.string(),\n\tagentPreset: z.string(),\n\tallowedAgentPresets: z.array(z.string())'
  writeFileSync(join(pkgDir, 'lib', 'index.js'), `const Config = z.object({\n\t${body}\n});\n`)
  // `persona` 表达式按**包名**解析本包的 `personas/*.md` ⇒ 桩里也要提供那份包，
  // 否则求值会 `MODULE_NOT_FOUND`。这里把它做成指向真实 personas 目录的**转发**：
  // 内容仍取自本仓（测试要考的是产物有没有连对文件，不是桩里放了什么）。
  const bundleDir = join(root, 'node_modules', '@quill507', 'dsh-orchestrator-preset')
  mkdirSync(bundleDir, { recursive: true })
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({
    name: '@quill507/dsh-orchestrator-preset',
    version: '0.0.0-stub',
    exports: { './personas/*': './personas/*', './package.json': './package.json' },
  }))
  mkdirSync(join(bundleDir, 'personas'), { recursive: true })
  const realPersonas = join(dirname(fileURLToPath(import.meta.url)), '..', 'personas')
  for (const f of readdirSync(realPersonas)) {
    writeFileSync(join(bundleDir, 'personas', f), readFileSync(join(realPersonas, f)))
  }
  return join(root, 'package.json')
}
// ── 带版本的桩：受支持的两版 / 旧契约 / 结构与受支持版本相同的 alpha.5 / 读不到版本 ──
// ⚠️ 这里替换了原来那两根「新形态 / 旧形态」桩。旧桩只区分 Config 形状，而 alpha.3/4/5
//    与受支持的 0.2.1-rc.2 形状相同 ⇒ 旧桩**根本分不开**它们，门也就只关掉了老宿主。
//    现在每根桩都带真实版本号，门读的就是那个版本。
// · SUPPORTED ：0.2.1-rc.2（支持集的第一项），结构是新契约 ⇒ 门 false ⇒ 三族行**挂载**
// · NEWER     ：0.2.1-rc.3（支持集的第二项，结构同上）⇒ 门**也必须** false ⇒ 挂载。
//               ⚠️ 这一根是「支持集是集合、不是单值」的唯一证据：删掉它，门退回单值相等
//               仍然全绿，而那正是本轮修掉的东西。
// · RC2       ：0.2.0-rc.2，结构是旧契约（声明 persona:）⇒ 门 true ⇒ 全关
// · ALPHA5    ：0.2.1-alpha.5，结构**与受支持版本完全相同**、只有版本不同 ⇒ 门 true ⇒ 全关
//               （这正是旧形状探针漏掉的那一档，也是这条断言存在的理由）
// · UNRESOLVABLE：版本读不到 + 旧契约 ⇒ 门仍必须 true（fail-closed 方向）
const SUPPORTED = d.SUPPORTED_HOST_VERSIONS
const NEW_BASE = makeHostStub('supported', SUPPORTED[0], false)
const NEWER_BASE = makeHostStub('newer', SUPPORTED[SUPPORTED.length - 1], false)
const OLD_BASE = makeHostStub('rc2', '0.2.0-rc.2', true)
const ALPHA5_BASE = makeHostStub('alpha5', '0.2.1-alpha.5', false)
const UNRESOLVABLE_BASE = makeHostStub('unresolvable', 'not-a-version-' + process.pid, true)

/**
 * 第三根桩：`@deepseek-ai/dsh-tool-schedule` **可解析**的宿主。
 * 用来测 `schedule_*` 那条条件尾巴的**正方向** —— 没有它，就只能断言「名字不在名单里」，
 * 而「尾巴被整条删掉」这种回归会让边界静默失效却全绿。
 */
function makeScheduleStub() {
  const root = join(tmpdir(), `orch-contract-sched-${process.pid}`)
  const dir = join(root, 'node_modules', '@deepseek-ai', 'dsh-tool-schedule')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh-tool-schedule', version: '0.0.0-stub', main: 'index.js' }))
  writeFileSync(join(dir, 'index.js'), 'export default {}\n')
  // ⚠️ **这个桩必须是「旧形态宿主 + 本包 personas」的超集**：lane 行的 config 现在是一整张
  //    运行时构造的映射 ⇒ 求值它会**同时**走到 persona 的 `readFileSync(…scout.md…)` 与宿主门的解析。
  //    少了任一半，整个 config 求值就 `MODULE_NOT_FOUND`，而报错点看起来与 schedule 无关（实测踩到过）。
  //    ⇒ 复用 `makeHostStub` 的目录骨架，避免两份桩各自演化。
  cpSync(join(dirname(makeHostStub('oldHost')), 'node_modules'),
         join(root, 'node_modules'), { recursive: true, force: true })
  return join(root, 'package.json')
}
const SCHEDULE_BASE = makeScheduleStub()

// ── 行块读取：`- id:` 行到下一条缩进 ≤ 它的 `- id:` 行（或文件尾）─────────────
// ⚠️ 同样只依赖 render() 固定下来的缩进；不依赖任何 YAML 库（见文件头「零第三方包」）。
/** 文本里 id 指定的**那一整块**的行；id 不存在返回 null。 */
function blockOf(text, id) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => idLine.exec(l) !== null && idLine.exec(l)[2].trim() === id)
  if (start === -1) return null
  const indent = idLine.exec(lines[start])[1].length
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = idLine.exec(lines[i])
    if (m !== null && m[1].length <= indent) return lines.slice(start, i)
  }
  return lines.slice(start)
}

/**
 * `blockOf()` 的字符串版本。`blockOf()` 返回**行数组**，断言里想用 `includes()` / 正则
 * 匹配就得先 join —— 直接对数组调 `assert.match` 会拿到 `TypeError` 或恒假的匹配。
 * 找不到该 id 时返回 `null`（与 `blockOf` 一致），调用方负责断言非 null。
 */
const blockText = (id) => { const b = blockOf(committed, id); return b === null ? null : b.join('\n') }

const unquote = (s) => s.trim().replace(/^'(.*)'$/s, '$1').replace(/''/g, "'")

/** 块里 `key:` 之下、缩进更深的那几行（空行算块内）；key 不存在返回 null。 */
function subBlock(block, key) {
  const at = block.findIndex((l) => new RegExp(`^(\\s*)${key}:(\\s|$)`).test(l))
  if (at === -1) return null
  const base = /^ */.exec(block[at])[0].length
  const out = []
  for (let i = at + 1; i < block.length; i += 1) {
    if (block[i].trim() === '' || /^ */.exec(block[i])[0].length > base) out.push(block[i])
    else break
  }
  return out
}

/** 块里 `key: <非空标量>` 的第一个字面值（去引号）；找不到返回 undefined。 */
function scalarOf(block, key) {
  for (const line of block) {
    const m = new RegExp(`^(\\s*)${key}: (.+)$`).exec(line)
    if (m !== null) return unquote(m[2])
  }
  return undefined
}

/**
 * 块里 `key:`（默认 `config`）下的**直接**子项 `key: value` 标量映射。
 * 只取同一缩进的标量：更深的（嵌套映射如 `toolFilter:`）与列表项（`- id:`）都不取。
 * 键不存在返回 null；键存在但没有标量子项返回 `{}`。
 */
function scalarMap(block, key = 'config') {
  const sub = subBlock(block, key)
  if (sub === null) return null
  const base = /^ */.exec(sub[0])[0].length
  const out = {}
  for (const line of sub) {
    const m = /^(\s*)([A-Za-z][\w-]*): (.+)$/.exec(line)
    if (m === null || m[1].length !== base) continue
    out[m[2]] = unquote(m[3])
  }
  return out
}

/** group 行的直接子行 id（渲染里挂在 `config:` 之下，缩进 = group 行缩进 + 4）。 */
function childrenOf(text, groupId) {
  const all = parseRows(text)
  const at = all.findIndex((r) => r.id === groupId)
  if (at === -1) return null
  const base = all[at].indent
  const out = []
  for (let i = at + 1; i < all.length; i += 1) {
    if (all[i].indent <= base) break
    out.push(all[i].id)
  }
  return out
}

// ── 期望值：**全部**由 tools/preset-declaration.mjs 推导 ──────────────────────
/**
 * `plugins[]` 顶层应当出现的 row id，按声明顺序（= d.topRows + d.groups）。
 * ⚠️ group 的**子行**在渲染里挂在 `config:` 之下（缩进 14），不属于这一层。
 */
const expectedPluginsIds = () => [
  ...d.topRows.map((r) => r.id),
  ...d.groups.map((g) => g.id),
  // 每条 lane 的 Agent Preset 行（新宿主专用）。它们与顶层 row 同层（缩进 10）——
  // lane 行的 `agentPreset` 指向这些 id，所以必须在**同一个** `- insert:` 里可见。
  ...d.lanePresetRows.map((r) => r.id),
]
/** 每个 group 的子行 id，按 group 顺序。id 由 groupEntry()（生成器自己的铸 id 规则）铸出。 */
const expectedGroupChildIds = () => d.groups.flatMap((g) => groupEntry(g, d, section).children.map((c) => c.id))
/**
 * 顶层 `- insert:` 直接挂载的行：**只有 3 条** —— preset 行本身 + 两个 bundle 级扩展行。
 * ⚠️ `persona` / `routing-sections` / `lane-composition` 这些虽然在 DESIGN §2.3 里被称作「顶层 row」，
 *    在渲染结果里它们位于 `preset.config.plugins[]` 之下（缩进 10），不属于这一层。
 *    命名空间与渲染层级在这里不一致 —— 测试按**渲染层级**断言。
 */
const expectedInsertIds = () => [`preset-${d.presetId}`, d.providerRowId, d.prefixRowId]

/** 官方骨架（dsh-web-app/presets/standard.patch.yml）里的全部 row id。 */
function officialIds() {
  return new Set(parseRows(skeletonText).map((r) => r.id))
}

/** lane 的行 id（由 toolName 铸出，与 laneRow() 同一规则）。 */
const laneRowId = (lane) => `tool-subagent-${lane.tool.replace(/^subagent_/, '').replace(/_/g, '-')}`

// ── lane-gate 取值：`official` 是一份**字面名单**，不是表达式 ────────────────────────
// lane 行的 `toolFilter` 早已被删除（宿主 `apply()` 对它硬拒）；收窄整体搬进了每条 lane
// 自己的 Agent Preset 行里的 `lane-tool-gate` 插件。但**值的形式变了**：
//   · 旧形态是一条 `!!js` 表达式（静态名单 concat 按机器算的 MCP 闭包）；
//   · 现在是一份**字面数组** `official` —— 允许名单不需要按机器求值（理由见
//     `preset-declaration.mjs` 的 `LANE_OFFICIAL` 段与 `gen-cordis-patch.mjs` 的同名段）。
// ⇒ 下面的 helper 从**产物文本**里读出那份数组。它**不需要**两个世界各求值一次，因为
//   已经没有表达式可求 —— 但「读产物而不是读声明」这一点保持不变：要测的是**产物**里的
//   名单，声明自己算出来的东西不能当证据（那是 x === x）。
const gateOfficialOf = (presetRowId) => {
  const block = blockText(presetRowId)
  if (block === null) return null
  const lines = block.split('\n')
  const at = lines.findIndex((l) => /^\s*official:\s*$/.test(l))
  if (at === -1) return null
  const indent = /^ */.exec(lines[at])[0].length
  const out = []
  for (let i = at + 1; i < lines.length; i += 1) {
    const m = /^( +)- (.+)$/.exec(lines[i])
    if (m === null || m[1].length <= indent) break
    out.push(unquote(m[2]))
  }
  return out
}
/** 一条 lane 的 preset 行 id（声明侧派生，测试不另写一份命名规则）。 */
const presetRowIdOf = (lane) => `preset-${lane.presetId}`

/**
 * 某条 lane preset 的 `plugins[]` 里**实际挂载**了哪些插件行 id（从产物文本读）。
 *
 * 为什么需要它：`official` 是允许名单，它不注册任何东西。判断「该 lane 到底有没有这个工具」
 * 必须看 `plugins[]` 里挂没挂对应的官方工具行 —— 那是两件不同的事实，本文件两件都断。
 * 只认 `plugins:` 之下、缩进**恰好比它深两级**的 `- id:` 行，避免跨进嵌套插件的 config。
 */
const pluginIdsOf = (presetRowId) => {
  const block = blockText(presetRowId)
  if (block === null) return []
  const lines = block.split('\n')
  const at = lines.findIndex((l) => /^ +plugins:\s*$/.test(l))
  if (at === -1) return []
  const indent = /^ */.exec(lines[at])[0].length
  const out = []
  for (let i = at + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cur = /^ */.exec(lines[i])[0].length
    if (cur <= indent) break
    const m = /^( +)- id: '([\w-]+)'$/.exec(lines[i])
    if (m !== null && m[1].length === indent + 2) out.push(m[2])
  }
  return out
}


/**
 * DESIGN.md §2.3「删除项」表里，**官方骨架至今仍有**的 row id。
 * ⚠️ 这份清单**不是**「官方 id 不得出现在产物里」——那种断言在本项目里是错的：
 * §2.1 说 DSH 没有 preset 继承，官方行**必须**逐行重新声明，所以 `tool-fs` / `plan-mode` /
 * `compaction-basic` 这些官方 id 出现在产物里是**设计要求**，不是碰撞。
 * 真正的约束是反过来的：本 preset 主动删掉的那几行**不许复活**（DESIGN.md §2.3 + §15 R16:
 * 「不挂载 ⇒ 不存在」比「存在但 deny」更彻底）。
 *
 * ⚠️ **`tool-ralph` 从这里移到了下面那份清单**（host 0.2.1-alpha.2 实测）：上游自己把这一行
 * 从 `standard.patch.yml` 删了（rc.2/alpha.1 是 162 行，alpha.2 是 137 行），于是本断言
 * 「官方骨架里必须有它」不再成立 —— 报错文案本身就是结论：**该更新的是这份清单，不是让测试让步**。
 */
const DELETED_BY_DESIGN_2_3 = [
  'command-goal', 'tool-goal',
  'present',
  'tool-plugin-manager',
  'workflow-ptc', 'tool-workflow',
  'tool-subagent',
]

/**
 * 曾经由 §2.3 主动删除、**如今连官方骨架也不再提供**的 row id（host 0.2.1-alpha.2 起）。
 *
 * 它们与上表是**两种不同的理由**，所以分成两份清单，判据也反过来：
 * 上表要的是「骨架**有**、产物**无**」；这份要的是「两边**都无**」。合成一份会让
 * 「上游删了」和「本包删了」看起来像同一件事 —— 而它们的可证伪性方向正好相反。
 *
 * ⚠️ 这份清单**只在宿主 ≥ 0.2.1-alpha.2 上成立**。在 rc.2 / alpha.1 上这三行**仍在**骨架里，
 * 所以本断言会失败 —— 那是**正确**的失败：支持矩阵一旦回退到旧版，这份清单就该跟着回退。
 * ⇒ 本包的支持声明（README「Host version gate」）与本文件是**同一件事的两处记录**，改一处要改两处。
 */
const GONE_UPSTREAM_TOO = [
  'tool-ralph',
  'tool-subagent-codex', 'tool-subagent-claude-code',
]

/**
 * §5 的清单：**带非空 config 的官方保留行**。
 * ⚠️ 这**不是**工具名闭集断言（§3.3.4 :495 的⛔ 段：第 6 轮用户裁决删掉了那个机制，
 *    `LEGAL_TOOL_NAMES` 降级为参考清单）。它只对这**几个**行的 **config 值**做逐字比对，
 *    期望值在**测试运行时从已安装的骨架文件现场读**（骨架是权威），不写死字面量。
 * ⚠️ `persona` **故意不在**此列：它是 §2.3 表里第 1 行的**替换**行 —— 本包用
 *    `plan-aware-persona.mjs` 顶掉 `@deepseek-ai/dsh-persona`，`prefix` 由那个模块按 plan
 *    投影自己提供（§2.3「`persona` 行替换的硬约束」），config 形状与官方行本就不该相同。
 *    要求它逐字一致会与那条替换决定直接冲突。
 */
const OFFICIAL_ROWS_WITH_CONFIG = ['agent-instructions', 'tool-fs-search', 'tool-todo', 'tool-web', 'tool-result-pruner']

// ============================================================================
// 1. 形状：顶层只有 `insert`
// ============================================================================
test('顶层指令只有 insert —— 不含 replace / suppress / keep', () => {
  // 顶层 = 缩进 0 的非注释行。YAML 文档根是一个序列，只有一个映射键。
  const topLevel = committed.split('\n')
    .filter((l) => l.length > 0 && !l.startsWith('#') && !/^\s/.test(l))
  assert.equal(topLevel.length, 1, `顶层应当恰好一条指令，实际 ${topLevel.length} 条：${JSON.stringify(topLevel)}`)
  assert.equal(/^- ([A-Za-z][\w-]*):/.exec(topLevel[0])[1], 'insert')
  for (const banned of ['replace', 'suppress', 'keep']) {
    assert.equal(new RegExp(`^\\s*-?\\s*${banned}:`, 'm').test(committed), false, `产物里出现了被禁的顶层指令 ${banned}:`)
  }
})

// ============================================================================
// 2. 行 id 集合与顺序 = 声明清单推导出的集合（核心断言）
// ============================================================================
test('plugins[] 的 row id 集合与顺序 === 声明清单推导值', () => {
  assert.deepEqual(idsAt(10), expectedPluginsIds(),
    'plugins[] 的 row id 与 tools/preset-declaration.mjs 不一致 —— 声明改了但没重新生成，或生成器与声明分叉')
  assert.deepEqual(idsAt(14), expectedGroupChildIds(),
    'group 子行的 id 与声明不一致 —— 声明改了但没重新生成，或生成器与声明分叉')
})

test('顶层 - insert: 直接挂载 3 条：preset 行 + 两个 bundle 级挂载行', () => {
  assert.deepEqual(idsAt(4), expectedInsertIds())
  const presetRows = rows().filter((r) => r.indent === 4 && r.name === '@deepseek-ai/dsh-agent-preset')
  assert.equal(presetRows.length, 1, '应当恰好一个 agent-preset 行（本包自己的 preset 声明）')
  assert.equal(presetRows[0].id, `preset-${d.presetId}`)
  // ⚠️ 另有 9 条 lane 的 Agent Preset 行，但它们挂在 `plugins[]` 之下（缩进 10），不是这一层。
  //    这一条区分很重要：`- insert:` 顶层只允许这 3 条，多一条就说明层级被改错了。
})

// ============================================================================
// 3. 计数口径自洽（生成器刻意把口径分开打印：`rows-detail` / `plugins-entries` / `file-id-lines`
//    三行，见其文件头 23–27 行与 CLI stdout；三者的定义见 ADR-1 的「计数口径」表）
// ============================================================================
test('计数口径自洽：声明 row 数 / plugins[] 条目数 / 文件内 `- id:` 行数', () => {
  const all = rows()
  // 声明口径（DESIGN §2.4 的算式：topRows + groups + delegation 的行数）与**产物口径**的差，
  // 必须**恰好**是「被算式折进 group 条目里」的那几条：planning 1 + compaction 3。
  // ⚠️ 这条比较的两条腿来自**不同来源**（声明 vs 从产物文本数出来的行）——它能在
  //    「生成器把 group 子行挂错层级 / 少渲染」时失败。旧版本把 countRows() 与它自己
  //    函数体的一份字面拷贝比较，那只能在两份拷贝被分别编辑时失败，对真实回归是瞎的。
  // ⚠️ `countRows(d)` 已含 9 条 lane preset 行（生成器的 `rows-detail` 口径），而这里比较的是
  //    「plugins[] 里的 row」⇒ 两边都要在**同一个口径**上：减掉 preset 行。
  const declaredRows = countRows(d) - d.lanePresetRows.length
  // ⚠️ `idsAt(10)` 现在**同时**含原顶层 row 与 9 条 lane preset 行（两者同层），
  //    而 `countFileEntries()` 的口径是「topRows + groups + group 子行」⇒ 必须先把
  //    lane preset 行减掉，否则这条比较会把「新加了一类行」误报成「group 渲染形状变了」。
  const renderedPlugins = idsAt(10).length + idsAt(14).length - d.lanePresetRows.length
  const foldedIntoGroups = d.groups.filter((g) => g.id !== 'delegation').reduce((n, g) => n + g.rows.length, 0)
  assert.equal(renderedPlugins - declaredRows, foldedIntoGroups,
    `声明口径 ${declaredRows} 与产物口径 ${renderedPlugins} 的差不等于 ${foldedIntoGroups} —— group 子行的渲染形状变了`)
  // 那 foldedIntoGroups 条在产物里**确实**挂在各自 group 的 config 之下（不是别的形状）
  for (const g of d.groups.filter((x) => x.id !== 'delegation')) {
    assert.deepEqual(childrenOf(committed, g.id), g.rows.map((r) => r.id),
      `产物里 ${g.id} 组的子行与声明不一致`)
  }
  // plugins[] 条目数 = 顶层 row + group + 全部 group 子行（即「文件里 plugins[] 下的所有 `- id:` 行」）
  assert.equal(renderedPlugins, countFileEntries(d))
  // 文件内 `- id:` 行数 = plugins[] 条目 + preset 行 + 两个 bundle 级挂载行
  //                      + 9 条 lane preset 行
  //                      + 每条 lane preset 的**嵌套** `plugins[]` 条目（persona + lane-gate）
  // ⚠️ 最后一项是 0.2.1-alpha.3 迁移新增的：lane preset 的 `plugins[]` 里每条都有自己的 `- id:`，
  //    所以「文件里 `- id:` 行数」这个口径**不再**等于「顶层可见行数」。不把它算进来，
  //    这条断言就会在形状正确时报假红 —— 而假红会诱使人去改产物。
  const nestedPluginIds = d.lanePresetRows.reduce((n, r) => n + r.config.plugins.length, 0)
  assert.equal(all.length, countFileEntries(d) + 3 + d.lanePresetRows.length + nestedPluginIds)
  // 每个 lane 行的 id 与 toolName 一一对应（§3.3.2 约束 5：具名 lane 的 toolName 必须互不相同）
  const toolNames = [...committed.matchAll(/^ *toolName: (subagent_\w+)$/gm)].map((m) => m[1])
  assert.equal(new Set(toolNames).size, toolNames.length, 'lane 的 toolName 必须互不相同（§3.3.2 约束 5）')
  for (const lane of d.LANES) {
    assert.equal(idsAt(14).includes(laneRowId(lane)), true,
      `声明里的 lane ${lane.tool} 在产物里找不到对应行`)
  }
})

// ============================================================================
// 4. 与官方 preset 的关系：主动删掉的行不许复活
// ============================================================================
test('DESIGN §2.3 标记删除的官方 row 不在产物里；上游也已删掉的那几个两边都无', () => {
  const official = officialIds()
  for (const id of DELETED_BY_DESIGN_2_3) {
    assert.equal(official.has(id), true, `${id} 已不在权威骨架里 —— 这份删除清单过期了，先核对 DESIGN §2.3 与骨架`)
    assert.equal(rows().some((r) => r.id === id), false, `${id} 是 DESIGN §2.3 明确删除的行，不该出现在 cordis.patch.yml`)
  }
  for (const id of GONE_UPSTREAM_TOO) {
    assert.equal(official.has(id), false,
      `${id} 又在权威骨架里了 —— 上游把它加了回来，先核对本包的支持矩阵（README「Host version gate」）再决定这份清单的去留`)
    assert.equal(rows().some((r) => r.id === id), false, `${id} 不该出现在 cordis.patch.yml`)
  }
})

// ============================================================================
// 5. 官方保留行的 config 值与骨架逐字一致（值级别；此前零覆盖）
// ============================================================================
test('官方保留行的 config 与已安装的权威骨架逐字一致（声明改了再重新生成也拦得住）', () => {
  for (const id of OFFICIAL_ROWS_WITH_CONFIG) {
    const fromSkeleton = scalarMap(blockOf(skeletonText, id))
    const fromArtifact = scalarMap(blockOf(committed, id))
    assert.notEqual(fromSkeleton, null, `骨架里找不到 ${id} 行 —— 清单过期了，先核对已安装的 standard.patch.yml`)
    assert.notEqual(fromArtifact, null, `产物里找不到 ${id} 行`)
    assert.notEqual(Object.keys(fromSkeleton).length, 0, `骨架里 ${id} 的 config 已是空的 —— 这份清单过期了`)
    assert.deepEqual(fromArtifact, fromSkeleton,
      `${id} 的 config 与权威骨架不一致：${JSON.stringify(fromArtifact)} ≠ ${JSON.stringify(fromSkeleton)}`)
  }
})

// ============================================================================
// 6. 本地铸出的 id：分两组断言，名字与范围各自诚实
// ============================================================================
test('两个 bundle 级挂载行走 orch- 命名空间，挂本包自己的入口，且与官方 row id 不相交', () => {
  const official = officialIds()
  const local = [d.providerRowId, d.prefixRowId]
  // ⚠️ 范围只有**这两个**行：它们是顶层 `- insert:` 下的 bundle 级挂载点。
  //    preset 内那 3 个本包自写行（`persona` / `routing-sections` / `lane-composition`）
  //    **不在** orch- 命名空间里，由下一条断言单独管 —— 旧版本把两者合在一处，
  //    断言名字宣称覆盖了「本地挂载行」全集，实际只查了 2 行。
  // ⚠️ 顺序有意义：先查撞名（对 id 取值**无前提**，任何撞名都能让它失败），
  //    再查前缀。两条断言各自可证伪 —— 把 providerRowId 改成 'persona' 命中第一条，
  //    改成 'my-pack' 命中第二条。
  for (const id of local) {
    assert.equal(official.has(id), false, `本地 id ${id} 与官方骨架的 row id 撞名`)
  }
  for (const id of local) {
    assert.match(id, /^orch-[a-z0-9-]+$/, `本地挂载行的 id 必须在 orch- 命名空间：${id}`)
  }
  // 反向：产物里每个 orch- 行都必须挂本包自己的入口，不得借官方行占坑
  for (const r of rows().filter((x) => x.id.startsWith('orch-'))) {
    assert.equal(r.name.startsWith(`${d.bundlePkg}/`), true, `orch-* 行 ${r.id} 的 name 不是本包 specifier：${r.name}`)
  }
  // 两个挂载行与 preset 行同层（在 plugins[] 之外），不是 preset 的子插件
  assert.equal(local.every((id) => idsAt(4).includes(id)), true, '两个 orch-* 挂载行必须与 preset 行同层')
})

test('preset 内的本包自写挂载行是这 4 条、都挂本包 specifier；与官方 id 撞名的恰好只有 persona', () => {
  const official = officialIds()
  // 期望值写成字面量：这条断言保护的是「本地行**刻意**用通用 id」这个决定本身。
  // 改名（哪怕改成更整齐的 orch-* 名字）会让它失败 —— 那是提示人先改这条记录，不是静默放过。
  // ⚠️ 第 4 条 `harness-sections`（T7-T9，2026-10-22）是**同一个决定的新成员**，不是例外：
  //    它同样刻意用通用 id（不是 `orch-harness-sections`），所以必须一并写进这条字面量。
  //    加它的时候**没有**放宽判据 —— 下一条「与官方 id 撞名的恰好只有 persona」照样逐个核对，
  //    新行只要与骨架撞名就会在这里失败。
  const localInPreset = rows().filter((r) => r.indent === 10 && r.name.startsWith(`${d.bundlePkg}/`))
  assert.deepEqual(localInPreset.map((r) => r.id), ['persona', 'routing-sections', 'harness-sections', 'lane-composition'],
    'preset 内挂本包 specifier 的行不是这 4 条 —— 核对 declaration 的 topRows 与 ADR「keep lane-composition」')
  // 挂载行指向的**子路径**必须既存在于仓里、又真的被发布（`files` 白名单）。
  // ⚠️ 这条不是「再确认一次 name 的形状」：它抓的是「行挂上了一个不存在的 / 不发布的文件」——
  //    那种行在 `--check` 与行 id 集合断言下**全绿**，直到装了这个 preset 的人才在 mount 期发现。
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  for (const r of localInPreset) {
    const subpath = r.name.slice(`${d.bundlePkg}/`.length)
    assert.equal(existsSync(join(REPO_ROOT, subpath)), true, `${r.id} 指向的 ${subpath} 在仓里不存在`)
    assert.equal(pkg.files.includes(subpath), true,
      `${r.id} 指向的 ${subpath} 不在 package.json 的 files 白名单里 ⇒ 装上这个包的人拿不到它`)
    assert.equal(Object.values(pkg.exports).includes(`./${subpath}`), true,
      `${r.id} 指向的 ${subpath} 不在 package.json 的 exports 里 ⇒ createRequire(...).resolve() 会失败`)
  }
  // 撞名**是**设计要求，且**只有** `persona` 一个（§2.3 表第 1 行：用 plan-aware-persona 替换
  // 官方 `@deepseek-ai/dsh-persona` 行）。另两个用通用 id 但官方骨架里没有 ⇒ 不撞。
  // ⚠️ 上一条断言的「不相交」不适用于 persona：替换就是撞名。
  assert.deepEqual(localInPreset.map((r) => r.id).filter((id) => official.has(id)), ['persona'],
    '与官方 id 撞名的本包行不是恰好 persona 一个 —— 核对 DESIGN §2.3 的替换决定')
})

// ============================================================================
// 6b. persona 行不得再引用 `{{cwd}}`（值级别；这条是 0.2.1-alpha.2 回归的守卫）
// ============================================================================
test('persona 行不带 suffix、promptProfile 取值合法，且产物里没有任何 {{cwd}} 引用', () => {
  // 这条断言保护一个**装配期硬失败**，不是风格偏好。`{{cwd}}` 在 host 0.2.1-alpha.2 上
  // 不再是已注册的提示词变量（`dsh-agent-loop` 只注册 provider / model），而
  // `dsh-system-prompt` 的 `interpolate()` 对未知变量是 throw ⇒ 每次装配都抛，
  // **在任何模型请求之前**。旧版（rc.2 / alpha.1）认得它，所以「在旧版上绿」不构成证据 ——
  // 这正是它能潜伏到宿主升级才爆的原因。
  //
  // 判据写成「产物里一个 {{cwd}} 都没有」而不是「persona 行没有 suffix」：前者连
  // 将来有人在 lane persona、section 文本或 toolFilter 里重新引入它也会拦住，而后者只查一处。
  // 它可证伪：把 suffix 加回 topRows 再重新生成，本断言必失败。
  assert.equal(committed.includes('{{cwd}}'), false,
    'cordis.patch.yml 里出现了 {{cwd}} —— 该变量在 host 0.2.1-alpha.2 上已不存在，装配期会抛 '
    + 'unknown prompt variable（见 tools/preset-declaration.mjs 的 topRows 注释）')
  // 反向也查一遍：persona 行的 config **不得含 `suffix`**，且 `promptProfile` 取值合法。
  // ⚠️ 这一段在 T1–T6（提示词裁剪）之后**换了主语**，不是迁就实现：旧版拿「persona 行的
  //    config 恰好是空的」当**间接探针**，守的是「渲染器把空 config 省略成裸一行」。那个
  //    探针随 `promptProfile` 落进 persona 行而失效，但它守的事实没变 ⇒ 拆成两条**直接**
  //    断言（下面 a / b），两条都仍然可证伪。同类先例见本文件 `:644-647` 的「换了主语」注释。
  //
  // (a) `suffix` 才是这条断言真正要防的东西：一旦把它加回 topRows，产物里就会出现 suffix
  //     段，而它的正文正是 `{{cwd}}` 这类提示词变量的来源（装配期 throw）。
  //     可证伪：给 topRows 的 persona 行加 `config.suffix`，重新生成 ⇒ 本断言必失败。
  const personaBlock = blockOf(committed, 'persona')
  assert.notEqual(personaBlock, null, '产物里找不到 persona 行')
  const personaConfig = scalarMap(personaBlock)
  assert.notEqual(personaConfig, null, 'persona 行没有 config —— promptProfile 开关丢了')
  assert.equal(Object.hasOwn(personaConfig, 'suffix'), false,
    'persona 行的 config 里出现了 suffix —— 该字段在 host 0.2.1-alpha.2 上装配期会抛 '
    + 'unknown prompt variable（见 tools/preset-declaration.mjs 的 topRows 注释）')
  // 正向也钉住：config 就是那一个开关，两个取值之一。
  // 可证伪：把值改成任意第三个字符串，本断言必失败。
  assert.equal(['minimal', 'full'].includes(personaConfig.promptProfile), true,
    `persona 行的 config.promptProfile 不是合法取值：${JSON.stringify(personaConfig)}`)
  // (b) 「空 config 被省略成裸一行」这件事换 `tool-fs` 继续守 —— 它是一条既没有 config
  //     也没有 disabled 的裸挂载行。渲染器若开始输出 `config: {}`，这条会失败，而那正是
  //     该被看见的形状变化。
  //     可证伪：给声明里的 tool-fs 加一个空 `config: {}`，重新生成 ⇒ 本断言必失败。
  const toolFsBlock = blockOf(committed, 'tool-fs')
  assert.notEqual(toolFsBlock, null, '产物里找不到 tool-fs 行 —— 空 config 的探针失效了，换一条仍然裸挂载的行')
  // ⚠️ 用 blockOf() 而不是「id 行之后固定 4 行」：blockOf 按缩进界定块边界，
  //    固定窗口在裸挂载行上会跨进下一条 row 的 config（persona 行当初能用固定窗口，
  //    只是因为它的 config 恰好紧跟在 name 之后）。
  assert.equal(toolFsBlock.some((l) => /^\s+config:/.test(l)), false,
    'tool-fs 行带上了 config —— 空 config 应当被省略成裸一行（渲染器开始输出 config: {} 了）')
})

// ============================================================================
// 7. 每条 lane 都声明了一份 `official`，且**与它自己挂载的官方工具行一致**
//    ⚠️ 这一条在 restrict 迁移后换了**判据的形式**，但守的是同一件事：以前是
//       「gate 的 deny 是一份非空名单」，现在是「lane 的允许集非空、且真的被挂上」。
//       旧判据在新形态下必然失败（产物里已经没有 `deny:`），而如果只是删掉它，
//       「lane 完全没有收窄」这件事就**没有任何断言**看着了 —— 那是假绿。
//
//    为什么必须两条一起断（声明非空 + 与 plugins[] 一致）：
//      · `official` 只是**允许**名单，不注册任何东西。一个被允许却没挂载的名字 =
//        不存在的工具 ⇒ lane 拿不到，而产物看起来完全正常。
//      · 反过来，挂载了却不在 `official` 里的工具会被 gate 立刻剥掉 ⇒ 白花注册成本。
//      ⇒ 两半同源（都由 `LANE_OFFICIAL` 派生）是声明侧的责任，**这条断言是它的探针**。
// ============================================================================
test('每条 lane 的 preset 里 official 非空，且与它 plugins[] 里的官方工具行一致', () => {
  // 由 `official` 反推「该挂哪些工具行」——这是本文件对派生规则的**独立复述**，
  // 故意不 import 声明侧的 `laneToolRows`：两边同源的话，改了规则两边一起错，探针就是瞎的。
  const expectedRows = (official) => {
    const has = (n) => official.includes(n)
    const rows = []
    if (has('read')) rows.push('tool-fs')
    if (has('glob') || has('grep')) rows.push('tool-fs-search')
    if (has('web_fetch') || has('web_search')) rows.push('tool-web')
    if (has('todo_write')) rows.push('tool-todo')
    if (has('skill')) rows.push('tool-skill')
    for (const n of ['bash', 'pwsh']) if (has(n)) rows.push('tool-' + n)
    return rows
  }
  for (const lane of d.LANES) {
    const presetId = presetRowIdOf(lane)
    const official = gateOfficialOf(presetId)
    assert.notEqual(official, null, `${presetId}: 产物里没有 lane-gate 的 official 名单`)
    assert.equal(Array.isArray(official), true, `${presetId}: official 不是数组`)
    assert.equal(official.length > 0, true,
      `${presetId}: official 是空名单 ⇒ 该 lane 什么都没有，连 read 都没有`)
    // 名单本身不得有重复项（重复说明有人手工拼接了两份来源）
    assert.equal(new Set(official).size, official.length, `${presetId}: official 有重复项`)
    // 关键那条：产物里**实际挂载**的官方工具行，必须恰好是 official 反推出来的那些
    const declared = new Set(expectedRows(official))
    const mounted = pluginIdsOf(presetId)
      .filter((id) => id.startsWith('tool-'))
    const missing = [...declared].filter((id) => !mounted.includes(id))
    const extra = mounted.filter((id) => !declared.has(id))
    assert.deepEqual(missing, [],
      `${presetId}: official 声明了这些工具需要的行却没挂 —— ${missing.join(', ')} ⇒ 名字被允许但工具不存在`)
    assert.deepEqual(extra, [],
      `${presetId}: 挂了这些官方工具行但 official 没点名 —— ${extra.join(', ')} ⇒ gate 会把它们剥掉，白挂一场`)
  }
})

// ============================================================================
// 7a. 往下的 gate 不再有静态 deny：三份名单与 gate 的 deny 形态都已退休
//     这条是**反证**（断言"不存在"），因为迁移后最容易犯的错是留下一半：
//     声明侧删了名单、产物里却还带着旧表达式，或反过来。两边都必须干净。
// ============================================================================
test('gate 里不再出现静态 deny 名，声明侧也不再导出那三份名单', () => {
  for (const gone of ['READONLY_DENY', 'WRIGHT_DENY', 'FORGE_DENY', 'LANE_ADDRESSING_DENY',
    'SCHEDULE_TOOL_NAMES', 'MCP_CLOSURE_EXPR', 'laneGateDeny']) {
    assert.equal(d[gone], undefined,
      `声明侧仍导出 ${gone} —— 迁移只做了一半：新形态里这些名字没有任何消费者`)
  }
  // 产物侧：不允许残留 `deny:` 键（无论是字面量还是 `!!js` 表达式）
  const denyLines = committed.split('\n').filter((l) => /^\s*deny:/.test(l))
  assert.deepEqual(denyLines, [],
    `产物里仍有 deny: 行（${denyLines.length} 处）—— lane-gate 的 config 现在是 official，不是 deny`)
  // 产物侧：不允许残留旧表达式常量名（它们会以文本形式出现在 `!!js` 里）
  const stale = committed.split('\n').filter((l) => /MCP_CLOSURE|laneGateDeny|READONLY_DENY/.test(l))
  assert.deepEqual(stale, [],
    `产物里仍有旧常量的痕迹（${stale.length} 行）—— 那些表达式已经没有任何意义`)
})

// ============================================================================
// 7b. 两族行由**同一个**宿主门驱动（成对，不得分叉）
//     这一条锁的是本轮的核心不变量。判据现在只剩一个语义：LANE_FORM_SUPPORTED_EXPR
//     为真 = 宿主是旧契约（Config 里还有 persona:）= **不受支持** ⇒ 两族行都必须 disabled。
//     两处判据若分叉，会出现「lane 行关了而 preset 行还挂着」（lane 指向一个没挂载的
//     preset ⇒ 派发期失败），或反过来（preset 挂上了却没有任何 lane 用它）。
//     ⚠️ 旧版在这里断言的是「两种形态各自的键集」（旧宿主 persona+toolFilter / 新宿主
//        agentPreset 那一对）。第二种形态已被删除，那些断言随之删除 —— 但它们保护的
//        「成对、不得分叉」被完整保留，只是从「键集成对」换成了「开关成对」。
// ============================================================================
test('7b. lane 行与 lane preset 行由**同一个**宿主门驱动（成对，不得分叉）', () => {
  // 两族行都必须带 disabled 门。缺门 = 在不受支持的宿主上照样挂载。
  for (const preset of d.lanePresetRows) {
    const block = blockText(preset.id)
    assert.notEqual(block, null, `产物里找不到 lane preset 行 ${preset.id}`)
    assert.match(block, /disabled: !!js/, `${preset.id}: 缺宿主门 disabled（不受支持的宿主上会尝试装载一个不存在的服务）`)
  }
  const presetDisabled = (id) => {
    const line = blockText(id).split('\n').find((l) => /^\s*disabled: !!js /.test(l))
    assert.notEqual(line, undefined, `${id}: 没有 disabled 门`)
    return jsExprOf(line)
  }
  const laneDisabled = (id) => {
    const line = blockText(id).split('\n').find((l) => /^\s*disabled: !!js /.test(l))
    assert.notEqual(line, undefined, `${id}: 没有 disabled 门`)
    return jsExprOf(line)
  }

  for (const lane of d.LANES) {
    const laneId = laneRowId(lane)
    const presetId = presetRowIdOf(lane)
    const laneBlock = blockText(laneId)
    assert.notEqual(laneBlock, null, `产物里找不到 lane 行 ${laneId}`)

    // ── 键集：唯一形态，且**不含**宿主硬拒的两个键 ──────────────────────────
    const cfg = plainConfigOf(laneBlock)
    assert.equal(cfg.agentPreset, lane.presetId,
      `${laneId}: agentPreset 应为 ${lane.presetId}，实测 ${JSON.stringify(cfg.agentPreset)}`)
    assert.deepEqual(cfg.allowedAgentPresets, [lane.presetId],
      `${laneId}: allowedAgentPresets 必须恰好含自己的 id（宿主 :209 要求包含关系）`)
    assert.deepEqual(Object.keys(cfg).sort(),
      ['agentPreset', 'allowedAgentPresets', 'maxDepth', 'provider', 'toolName'],
      `${laneId}: config 键集不是恰好这 5 个 —— 多一个键就可能被宿主按未知键/硬拒处理`)
    // ⛔ 宿主 `apply()` 对这两个键**按 key 存在性**硬拒（`Object.hasOwn`），
    //    所以「值为 undefined」不算躲过 —— 必须**键根本不在**。
    assert.equal(Object.hasOwn(cfg, 'persona'), false,
      `${laneId}: config 仍有 persona 键 ⇒ 宿主 :355 硬拒 ⇒ 该 lane 无法激活`)
    assert.equal(Object.hasOwn(cfg, 'toolFilter'), false,
      `${laneId}: config 仍有 toolFilter 键 ⇒ 宿主 :355 硬拒 ⇒ 该 lane 无法激活`)
    // 换一个世界再求一次：键集是**产物属性**，不该随宿主变。
    assert.deepEqual(Object.keys(plainConfigOf(laneBlock)).sort(),
      ['agentPreset', 'allowedAgentPresets', 'maxDepth', 'provider', 'toolName'],
      `${laneId}: config 键集随宿主变化 ⇒ 说明又回到「按宿主构造键集」了，而那种形态已删除`)

    // ── 极性：两个世界里两族行必须**一致** ────────────────────────────────
    // 新契约（桩里不含 persona:）⇒ 受支持 ⇒ 两族都启用（false）。
    assert.equal(evalJs(laneDisabled(laneId), NEW_BASE), false,
      `${laneId}: 受支持的宿主上被禁用了（极性反了）⇒ 该 lane 整个消失`)
    assert.equal(evalJs(presetDisabled(presetId), NEW_BASE), false,
      `${presetId}: 受支持的宿主上被禁用了（极性反了）⇒ 9 条 lane 拿不到 persona 与工具收窄`)
    // 旧契约（桩里含 persona:）⇒ 不受支持 ⇒ 两族都禁用（true）。
    assert.equal(evalJs(laneDisabled(laneId), OLD_BASE), true,
      `${laneId}: 不受支持的宿主上没有禁用 ⇒ 会带着 agentPreset 硬挂，失败方式随宿主而异`)
    assert.equal(evalJs(presetDisabled(presetId), OLD_BASE), true,
      `${presetId}: 不受支持的宿主上没有禁用 ⇒ 会尝试装载 agent-preset 行`)

    // ── 成对性：两族行必须是**同一段**表达式，逐字符相同 ──────────────────
    // 这是「不会分叉」的机械保证：只要有人给其中一族单独改门，这条立刻红。
    assert.equal(laneDisabled(laneId), presetDisabled(presetId),
      `${laneId} 与 ${presetId} 的宿主门表达式不是同一段 —— 两族行已经分叉`)

    // 反向：产物里必须真有一条同 id 的 preset 行（否则 lane 指向一个不存在的 preset）
    assert.notEqual(blockText(presetId), null,
      `${laneId} 指向 ${lane.presetId}，但产物里没有 ${presetId} 行`)
  }
})

// ============================================================================
// 8. 9 个 lane 的 maxDepth = 1（值级别；此前零覆盖）
// ============================================================================
test('9 个 lane 行的 maxDepth 全部 = 1 —— 递归预算用字段表达，不用纪律表达', () => {
  // 依据：§3.3.3 lane 表（:437-445）的 maxDepth 列 9 行全是 `1`；§7.3「机械化 vs 散文纪律」
  // 的分界表（:1204）把「只读 lane 真的不能递归」的机械手段写成 `maxDepth: 1`；§15 R11（:1754）
  // 记着「所有 lane 的 maxDepth 收紧到 1」以及被否的旧值（metis/hephaestus/sisyphus = 3）。
  // §3.3.3 :448-452 还专门说明 forge 的 `1` 意味着它是叶子，且「toolFilter 与 maxDepth 是
  // 两道独立的机械门」—— 既然是机械门，就不能只靠人读表。
  for (const lane of d.LANES) {
    const block = blockOf(committed, laneRowId(lane))
    assert.notEqual(block, null, `产物里找不到 lane 行 ${laneRowId(lane)}`)
    // ⚠️ `maxDepth` 现在是 config 普通映射里的一行（0.2.1-rc.2 起不再由 `!!js` 表达式构造键集），
    //    所以直接读那一行。仍走**取值**而不是「文本里出现过 maxDepth」：要的是值 = 1，
    //    不是「这个键有人写过」。
    const line = block.find((l) => /^\s*maxDepth:/.test(l))
    assert.notEqual(line, undefined, `${laneRowId(lane)}: config 里没有 maxDepth 行`)
    assert.equal(line.trim(), 'maxDepth: 1',
      `lane ${lane.tool} 的 maxDepth 不是 1 —— 依据 DESIGN §3.3.3 lane 表（:437-445）/ §7.3 :1204 / §15 R11 :1754`)
  }
})

// ============================================================================
// 9. 3 个 group 的 isolate：planning / compaction 随骨架；delegation 必须**没有**
// ============================================================================
test('planning/compaction 的 isolate 与骨架逐字一致；delegation 组不带 isolate', () => {
  // 保留的两个 group：isolate 是它们「必须带」（§3.3.2 其他硬约束表：任何 provide service
  // 的 row 必须在带 isolate 的 group 内）⇒ 值必须与已安装的骨架一致。
  for (const id of ['planning', 'compaction']) {
    const fromSkeleton = scalarMap(blockOf(skeletonText, id), 'isolate')
    const fromArtifact = scalarMap(blockOf(committed, id), 'isolate')
    assert.notEqual(fromSkeleton, null, `骨架里 ${id} 组没有 isolate 段`)
    assert.notEqual(fromArtifact, null, `产物里 ${id} 组没有 isolate 段`)
    assert.deepEqual(fromArtifact, fromSkeleton,
      `${id} 组的 isolate 与权威骨架不一致：${JSON.stringify(fromArtifact)} ≠ ${JSON.stringify(fromSkeleton)}`)
  }
  // delegation：**没有** isolate —— §14 D21（:1708）= 删，§2.3 的推导（:255-257）是
  // 「删掉 workflow 两行后组内不再有任何 provide service 的 row，isolate 只增加一层
  // 不必要的 realm 边界」，权威骨架里那行 `workflowEngine: true`（:83-84）正是随
  // workflow-ptc 一起被删掉的。此处必须断言**缺失**：把 delegation 改回带 isolate 是
  // 一处会被 mount 侧察觉、但没有任何测试拦得住的漂移。
  assert.deepEqual(scalarMap(blockOf(skeletonText, 'delegation'), 'isolate'), { workflowEngine: 'true' },
    '权威骨架的 delegation 组不再带 isolate —— 本项目的「删」这条派生决定该重新审视了')
  assert.equal(scalarMap(blockOf(committed, 'delegation'), 'isolate'), null,
    'delegation 组带了 isolate —— §14 D21（:1708）= 删：组内已无 provide service 的 row')
})

// ============================================================================
// 10. lane 寻址的 3 个工具名：对每个 lane 都必须被挡住
// ============================================================================
const LANE_ADDRESSING_TOOLS = ['subagent_children', 'subagent_send', 'subagent_interrupt']

test('lane 寻址的 3 个工具名**不在任何 lane 的 official 里**（允许名单必须不含它们）', () => {
  // 依据：ADR「keep-lane-composition」的决定第 4 条。这三个名字由本包自己的插件**全局**注册
  // （`lane-composition.mjs:1-30`），对 lane 而言是从 Lead 那一层**继承**来的 ⇒ 落在
  // `restrictableNames` 内 ⇒ 只要**不授予**就一定会被 gate 剥掉。
  //
  // ⚠️ **断言方向在 restrict 迁移后换成了「不在 official 里」**，这比旧版更强：
  //    · 旧版（guard 形态）要求「这 3 个名字**在 deny 名单里**」—— 那是一种**枚举式**保证，
  //      漏列一个就静默失效，产物看起来完全正常（名单在、只是短了）。
  //    · 现在要求「**不在**允许名单里」—— 那是**默认拒绝**：新增一个 lane 寻址工具时，
  //      只要没被显式加进某个 official，它就自动进不了任何 lane。漏列不再可能。
  //    ⇒ 这条断言比它替换掉的那条更难被绕过，而不是更松。
  for (const lane of d.LANES) {
    const official = gateOfficialOf(presetRowIdOf(lane))
    assert.notEqual(official, null, `${presetRowIdOf(lane)}: 产物里没有 official 名单`)
    for (const name of LANE_ADDRESSING_TOOLS) {
      assert.equal(official.includes(name), false,
        `${presetRowIdOf(lane)}: official 含 ${name} ⇒ 该 lane 能寻址别的 lane（权限放大）`)
    }
    // 同理：fork 能力不得授予任何 lane（lane 用「派人」而不是「复制自己」）。
    assert.equal(official.includes('subagent_fork'), false,
      `${presetRowIdOf(lane)}: official 含 subagent_fork ⇒ 该 lane 能 fork 出不受 maxDepth 约束的子代`)
  }
  // 反向：产物里**不得**再出现 lane 行的 toolFilter（宿主会硬拒该键）。
  for (const lane of d.LANES) {
    const block = blockText(laneRowId(lane))
    assert.notEqual(block, null, `产物里找不到 lane 行 ${laneRowId(lane)}`)
    assert.equal(/^\s*(toolFilter|persona):/m.test(block), false,
      `${laneRowId(lane)}: 仍有 toolFilter/persona 键 ⇒ 宿主 :355 按 Object.hasOwn 硬拒`)
  }
})
// ============================================================================
// 10b. tool-schedule：只给 Lead —— 行挂在 Lead 的 plugins[]，且四个名字不在任何 lane 的 official 里
// ============================================================================
const SCHEDULE_TOOLS = ['schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update']

test('tool-schedule 行是裸一行（无 disabled），且四个名字不在任何 lane 的 official 里', () => {
  // 依据：用户 2026-10-10 裁决「选项1，只给主代理，不给子agent」。每条断言都能单独失败。
  //
  // ⚠️ **这一条在 T1 之后换了承重点**。旧版断言「本行带宿主门 disabled」与「lane 的 deny
  //    按同一判据**条件**带上那 4 个名字」——两者都依赖「支持集含 0.2.0-rc.2，而 rc.2 没有
  //    这个包」这个前提。支持集收缩到单版本后前提消失：唯一受支持的宿主 `0.2.1-rc.2`
  //    自己依赖 `@deepseek-ai/dsh-tool-schedule` ⇒ 这个包在每台受支持机器上都可解析 ⇒
  //    那 4 个名字是**无条件**的，`disabled` 门与条件尾巴一起退休。
  //    旧断言若原样保留，会在一个已经不存在的世界里要求一个已被删除的字段。
  const block = blockOf(committed, 'tool-schedule')
  assert.notEqual(block, null,
    '产物里没有 tool-schedule 行 —— 该行是 2026-10-10 用户裁决的落点（放开提醒能力，只给 Lead）')
  assert.equal(scalarOf(block, 'name'), '@deepseek-ai/dsh-tool-schedule',
    'tool-schedule 行挂的不是 @deepseek-ai/dsh-tool-schedule')
  // 裸一行：没有 disabled（受支持的宿主一定装得上这个包），也没有 config。
  const disabledLine = block.find((l) => /^\s*disabled:/.test(l))
  assert.equal(disabledLine, undefined,
    'tool-schedule 行仍带 disabled —— 唯一受支持的宿主自己依赖这个包，门已无对象')
  const configLine = block.find((l) => /^\s*config:/.test(l))
  assert.equal(configLine, undefined,
    'tool-schedule 行带了 config —— 官方骨架那一行是裸的，本行应当同形')

  // 四个名字**不在任何 lane 的 official 里** —— 这是裁决在新形态下的唯一执行点。
  // ⚠️ 旧版查的是「在三条静态 deny 名单里」（裁决的记录）+「在九条 gate deny 里」（生效点）。
  //    静态名单已随迁移删除，gate 的 deny 也换成了 official ⇒ 两个承重点合并成一个，
  //    但**保证更强**：不允许 = 默认拒绝，「漏列」这件事不再可能发生。
  for (const lane of d.LANES) {
    const official = gateOfficialOf(presetRowIdOf(lane))
    assert.notEqual(official, null, `${presetRowIdOf(lane)}: 产物里没有 official 名单`)
    for (const name of SCHEDULE_TOOLS) {
      assert.equal(official.includes(name), false,
        `${presetRowIdOf(lane)}: official 含 ${name} ⇒ 该 lane 拿到提醒工具（裁决是只给 Lead）`)
    }
  }
  // 正向也钉住：`tool-schedule` 行**确实挂在 Lead 的 plugins[] 里**，所以那四个名字对 Lead
  // 是真实存在的工具 —— 少了这一条，「九条 lane 都没有 + Lead 也没有」会被误判成
  // 「裁决执行得好」，而实际是提醒能力整个丢了。
  assert.equal(idsAt(10).includes('tool-schedule'), true,
    'tool-schedule 行不在 Lead 的 plugins[] 里 —— 提醒能力整个丢了，不是「只给 Lead」')

  // fork 控制行：**不再**带任何 toolFilter / persona（宿主 apply() 对两者都硬拒）。
  const forkBlock = blockOf(committed, d.forkControlRowId)
  assert.notEqual(forkBlock, null, `产物里找不到 fork 控制行 ${d.forkControlRowId}`)
  const forkText = forkBlock.join('\n')
  assert.equal(/^\s*(toolFilter|persona):/m.test(forkText), false,
    'fork 控制行仍带 toolFilter/persona ⇒ 宿主 :355 按 Object.hasOwn 硬拒 ⇒ 该行无法激活')
  // ⛔ fail-closed：fork 控制行**必须**带宿主门。少了它，一台不受支持的宿主上 lane 行与
  //    preset 行虽然全关，`subagent_fork` 却仍然注册 ⇒ Lead 照样能派发，派进一个没有
  //    任何 lane preset 的组合里。那正是 `unsupported` 模拟机器存在的理由。
  const forkDisabled = forkBlock.find((l) => /^\s*disabled: !!js /.test(l))
  assert.notEqual(forkDisabled, undefined,
    'fork 控制行没有宿主门 disabled ⇒ 不受支持的宿主上它仍然挂载，Lead 还能经 subagent_fork 派发')
  // 极性与 lane 行 / preset 行一致：旧契约宿主（桩里含 persona:）= 不受支持 = 禁用。
  assert.equal(evalJs(jsExprOf(forkDisabled), NEW_BASE), false,
    'fork 控制行在受支持的宿主上被禁用了（极性反了）⇒ fork 能力整个消失')
  assert.equal(evalJs(jsExprOf(forkDisabled), OLD_BASE), true,
    'fork 控制行在不受支持的宿主上没有被禁用 ⇒ 那台机器上仍留着一扇能派发的门')
})

// ============================================================================
// 10c. lane coverage: the DESIGN roster, asserted as a literal
//      ⛔ The expected set is a LITERAL here, not derived from `d.LANES` and not
//      derived from the artifact's own preset rows. Both of those make the
//      assertion self-derived: drop a lane from the declaration (or from the
//      artifact) and it disappears from BOTH sides, so the sets still match and
//      every gate stays green. That is exactly the attack this closes.
//      The roster below is the capability set DESIGN §3.3.3 names.
//      Asserted in three places, both directions, with the symmetric difference
//      in the message: the declaration's LANES, the artifact's rendered lane
//      rows, and the artifact's rendered preset rows.
// ============================================================================
const ROSTER_LANES = ['scout', 'archivist', 'seer', 'reader', 'analyst', 'auditor', 'wright', 'forge', 'planner']
const ROSTER_LANE_IDS = ROSTER_LANES.map((l) => `tool-subagent-${l}`).sort()
const ROSTER_PRESET_IDS = ROSTER_LANES.map((l) => `preset-orch-lane-${l}`).sort()

test('lane roster === the literal 9 (declaration AND artifact, both directions)', () => {
  const diff = (want, got) => ({
    missing: want.filter((id) => !got.includes(id)),
    unexpected: got.filter((id) => !want.includes(id)),
  })
  const report = (label, want, got) => {
    const d = diff(want, got)
    assert.deepEqual(d.missing, [],
      `${label} 缺这些 id：${d.missing.join(', ')} —— 该 lane 整个消失（这份名册是设计里的字面值，不从被测对象推导）`)
    assert.deepEqual(d.unexpected, [],
      `${label} 多出未登记的 id：${d.unexpected.join(', ')}`)
  }

  // ── (1) the DECLARATION must name exactly the roster ────────────────────
  const declaredLanes = d.LANES.map(laneRowId).slice().sort()
  const declaredPresets = d.LANES.map((l) => `preset-${l.presetId}`).slice().sort()
  report('声明的 LANES', ROSTER_LANE_IDS, declaredLanes)
  report('声明的 lanePresetRows', ROSTER_PRESET_IDS, declaredPresets)
  // A count check as well, so "the literal is wrong" is caught too.
  assert.equal(ROSTER_LANE_IDS.length, 9, 'ROSTER_LANE_IDS 不是 9 条 —— 字面名册本身写错了')

  // ── (2) the ARTIFACT must render exactly the roster ─────────────────────
  const actualIds = rows().map((r) => r.id)
  // A lane row is a tool-subagent row declaring maxDepth (the control rows and the
  // fork row do not). Taken from the artifact SHAPE so an extra lane shows up.
  const actualLanes = rows()
    .filter((r) => r.id.startsWith('tool-subagent-'))
    .filter((r) => /^\s*maxDepth:/m.test(blockText(r.id) || ''))
    .map((r) => r.id).sort()
  const actualPresets = actualIds.filter((id) => id.startsWith('preset-orch-lane-')).slice().sort()
  report('产物的 lane 行', ROSTER_LANE_IDS, actualLanes)
  report('产物的 preset 行', ROSTER_PRESET_IDS, actualPresets)
  assert.equal(actualLanes.length > 0 && actualPresets.length > 0, true,
    '产物里一条 lane 行或 preset 行都没有 ⇒ 那是坏产物，不是干净产物')
})

// ============================================================================
// 10d. 九条 lane 的 `official`：**逐条**与一张字面表核对（不读声明自己的数组）
//      ⚠️ 期望值**不能**从声明取（那是 x === x）。下面这张表是本轮规格的**独立复述**：
//        · scout / seer / analyst / auditor = read, read_image, glob, grep
//        · archivist = 同上 + web_search, web_fetch
//        · reader    = read, read_image（**唯一**的窄口）
//        · wright / forge = read, read_image, glob, grep, write, edit, skill, todo_write + shell
//        · planner   = read, read_image, glob, grep, skill
//      ⇒ 九条 lane 的集合去重后是 **5 个互异集合**（四条只读侦查 lane 按规格**应当**相同），
//        不是 9 个。这条注释就是为了让「互不相同」这个说法不被误读成 pairwise-distinct：
//        那样写会与规格直接矛盾。真正的判别力在下面逐条比对与集合关系的断言里。
// ============================================================================
const OFFICIAL_EXPECTED = {
  scout: ['read', 'read_image', 'glob', 'grep'],
  archivist: ['read', 'read_image', 'glob', 'grep', 'web_fetch', 'web_search'],
  seer: ['read', 'read_image', 'glob', 'grep'],
  reader: ['read', 'read_image'],
  analyst: ['read', 'read_image', 'glob', 'grep'],
  auditor: ['read', 'read_image', 'glob', 'grep'],
  wright: ['read', 'read_image', 'glob', 'grep', 'write', 'edit', 'skill', 'todo_write', 'bash', 'pwsh'],
  forge: ['read', 'read_image', 'glob', 'grep', 'write', 'edit', 'skill', 'todo_write', 'bash', 'pwsh'],
  planner: ['read', 'read_image', 'glob', 'grep', 'skill'],
}

test('九条 lane 的官方集逐条核对：与字面表一致（不多、不少、不重）', () => {
  const laneName = (lane) => lane.tool.replace(/^subagent_/, '')
  // 名册双向：表里九条，声明也九条，且键集相同 —— 少一条会让下面的循环静默跳过它。
  assert.deepEqual(Object.keys(OFFICIAL_EXPECTED).sort(), d.LANES.map(laneName).sort(),
    '字面表的 lane 名与声明的 LANES 不一致 —— 加/删 lane 时这张表要一起改')
  for (const lane of d.LANES) {
    const name = laneName(lane)
    const expected = [...OFFICIAL_EXPECTED[name]].sort()
    const declared = [...lane.official].sort()
    assert.deepEqual(declared, expected,
      `${name} 的 official 与规格不符：${JSON.stringify(declared)} ≠ ${JSON.stringify(expected)}`)
    // 产物里的名单也必须等于声明 —— 「声明对了但没进产物」是同一条缺陷的另一半。
    const shipped = [...gateOfficialOf(presetRowIdOf(lane))].sort()
    assert.deepEqual(shipped, expected,
      `${presetRowIdOf(lane)} 产物里的 official 与规格不符：${JSON.stringify(shipped)}`)
  }
})

test('官方集的**关系**：reader 是只读侦查集的真子集；writer 两 lane 同集；去重后 5 个', () => {
  const setOf = (name) => new Set(OFFICIAL_EXPECTED[name])
  const subset = (a, b) => [...a].every((x) => b.has(x))
  // reader 只能更窄，绝不能更宽 —— 它是「只给两把读的钥匙」的那条 lane。
  const reader = setOf('reader'), scout = setOf('scout')
  assert.equal(subset(reader, scout), true, 'reader 的 official 不是 scout 的子集 —— reader 比只读侦查面更宽')
  assert.equal(reader.size < scout.size, true, 'reader 的 official 与 scout 等大 —— 那 reader 就没有「更窄」可言')
  // wright 与 forge 是两条可写 lane，同一份能力面（差别在 persona 与派发权限，不在工具）。
  assert.deepEqual([...setOf('wright')].sort(), [...setOf('forge')].sort(),
    'wright 与 forge 的 official 不同 —— 两条可写 lane 的工具面应当一致')
  // shell 必须在可写 lane 的 official 里**两个名字都在**：只写一个 = 另一个平台上没有 shell。
  for (const n of ['wright', 'forge']) {
    for (const sh of ['bash', 'pwsh']) {
      assert.equal(setOf(n).has(sh), true, `${n} 的 official 缺 ${sh} ⇒ 该平台上这条 lane 没有 shell`)
    }
  }
  // 去重后恰好 5 个互异集合（4 条侦查 lane 同集 + reader + archivist + writer 对 + planner）。
  const distinct = new Set(Object.values(OFFICIAL_EXPECTED).map((a) => [...a].sort().join('|')))
  assert.equal(distinct.size, 5,
    `互异官方集不是 5 个（实得 ${distinct.size}）—— 有人给某条 lane 单独改了工具面，规格要一起改`)
})

test('没有任何官方集授予写面之外的危险名字（寻址 / fork / schedule / 写工具的交叉核对）', () => {
  // 写面只属于 wright / forge。任何一个**别的** lane 出现 write/edit 就是权限放大。
  for (const [name, list] of Object.entries(OFFICIAL_EXPECTED)) {
    const writable = name === 'wright' || name === 'forge'
    if (!writable) {
      for (const n of ['write', 'edit', 'bash', 'pwsh', 'todo_write']) {
        assert.equal(list.includes(n), false, `${name} 的官方集含 ${n} ⇒ 只读/规划 lane 拿到了写面`)
      }
    }
    for (const n of [...LANE_ADDRESSING_TOOLS, 'subagent_fork', ...SCHEDULE_TOOLS]) {
      assert.equal(list.includes(n), false, `${name} 的官方集含 ${n} ⇒ 越界的派发/提醒能力`)
    }
  }
})

// ============================================================================
// 7c. 宿主门按**版本**判，不是按 Config 形状判
//     alpha.3 / alpha.4 / alpha.5 与受支持的 0.2.1-rc.2 **结构完全相同**（同样的
//     Config 键集、agentPreset/allowedAgentPresets、没有 persona）⇒ 形状探针**分不开**它们，
//     只会把 0.2.0-rc.2/alpha.1/alpha.2 关掉，而把 alpha.3/4/5 放进来。这条断言锁的正是
//     「版本是唯一能区分它们的事实」。
// ============================================================================
test('宿主门：支持集里的两版都启用，rc.2 与 alpha.5 禁用（形状相同也必须分开）', () => {
  const gateOf = (block) => {
    const line = block.split('\n').find((l) => /^\s*disabled: !!js /.test(l))
    assert.notEqual(line, undefined, '该行没有 disabled 门')
    return jsExprOf(line)
  }
  const laneBlock = blockText(laneRowId(d.LANES[0]))
  const presetBlock = blockText(d.lanePresetRows[0].id)
  assert.notEqual(laneBlock, null, '产物里找不到第一条 lane 行')
  assert.notEqual(presetBlock, null, '产物里找不到第一条 preset 行')

  for (const [label, block] of [['lane 行', laneBlock], ['preset 行', presetBlock]]) {
    const gate = gateOf(block)
    // 支持集里的每一版 ⇒ false（挂载）。**逐版**断言，不只看第一项：
    // 门若退回单值相等，只有「第二项」这一档会红，其余档仍然全绿。
    for (const [version, base] of [[SUPPORTED[0], NEW_BASE], [SUPPORTED[SUPPORTED.length - 1], NEWER_BASE]]) {
      assert.equal(evalJs(gate, base), false,
        `${label}：受支持的 ${version} 上被禁用了（极性反了，或门退回单值相等）⇒ 整个 preset 不挂`)
    }
    // 旧契约 ⇒ true（禁用）
    assert.equal(evalJs(gate, OLD_BASE), true,
      `${label}：0.2.0-rc.2（声明 persona:）上没有被禁用`)
    // ⛔ 关键一档：结构与受支持版本相同、**只有版本不同** ⇒ 必须 true。
    //    旧形状探针在这里返回 false，于是 alpha.3/4/5 会挂载 —— 那正是被修掉的行为。
    assert.equal(evalJs(gate, ALPHA5_BASE), true,
      `${label}：0.2.1-alpha.5 上没有被禁用 —— 它与受支持版本结构相同，只有版本能区分；形状探针会漏掉它`)
    // 版本读不到 + 旧契约 ⇒ 仍必须 true（fail-closed）
    assert.equal(evalJs(gate, UNRESOLVABLE_BASE), true,
      `${label}：版本读不到的旧契约宿主上没有被禁用 ⇒ fail-closed 方向反了`)
  }
  // 门里必须**逐字**出现支持集的每一个版本（否则它不是在按版本判，或只判了其中一版）
  for (const version of SUPPORTED) {
    assert.equal(gateOf(laneBlock).includes(version), true,
      `宿主门表达式里没有受支持版本 ${version} ⇒ 它没有在按版本集合判`)
  }
  // 反向：最新一版必须在表达式里，且窗口是**成员判断**（`includes`），不是 semver 比较 ——
  // 一次 semver 比较会顺手放行 rc.2 与 rc.3 之间未实测的中间态。
  assert.equal(gateOf(laneBlock).includes('includes(version)'), true,
    '宿主门的版本判断不是成员判断（缺 includes(version)）⇒ 支持集被写成了区间')
})
// ============================================================================
// 11. 可再生成性：render() 的输出必须复现已提交的产物
// ============================================================================
test('render() 的输出与已提交的 cordis.patch.yml 在**机器无关判据**下逐字节相同', (t) => {
  const rendered = render(d, section, d.SHELL_SOURCE)

  // 判据来自生成器（`compareMachineIndependent`），不是本文件私写的一份遮蔽 ——
  // `--check` 门与本断言必须用**同一个**实现，否则两边会分叉，那又是一层「绿色掩盖红色」。
  const verdict = compareMachineIndependent(committed, rendered)

  // 规则本身是**窄**的：产物里恰好一行按机器派生，被排除的就是它；其余每一行都参与比较。
  assert.equal(committed.split('\n').filter((l) => MACHINE_DERIVED_LINE.test(l)).length, 1,
    '产物里按机器派生的行不是恰好 1 行 —— 排除规则（生成器里的 MACHINE_DERIVED_LINE）与产物实际形状对不上了')
  assert.equal(provenanceLineOf(committed) !== null && provenanceLineOf(rendered) !== null, true,
    '产物或本机 render() 里没有 provenance 行 —— 那就没有任何机器派生的东西需要排除，门应当是纯逐字节比较')

  // 宿主漂移信号：逐字段打印，**不参与判定**。它不表示产物有缺陷。
  for (const w of verdict.warnings) t.diagnostic(w)
  t.diagnostic(`机器无关判据：排除 ${committed.split('\n').filter((l) => MACHINE_DERIVED_LINE.test(l)).length} 行（provenance 行），其余逐字节比较`)

  assert.equal(verdict.ok, true,
    `render() 的输出与已提交的 cordis.patch.yml 不一致（机器无关判据）—— 重新生成后再提交：\n${verdict.difference}`)
  // 门与测试用的必须是同一条规则：把产物里那一行单独换掉，比较结果**不得**改变；
  // 把一行真实内容改坏，必须被发现。两条各锁一半，合起来才是「同源且不漏」。
  assert.equal(compareMachineIndependent(committed.replace(MACHINE_DERIVED_LINE, '# Shell source: tampered'), rendered).ok, true,
    '改掉 provenance 行竟然让比较失败 ⇒ 门用的不是机器无关判据')
  // ⚠️ 被改坏的那串**必须在产物里真实存在**，否则 `.replace()` 替换不到任何东西，这条断言
  //    就变成恒真 —— 又一次「绿色掩盖红色」。所以先证明探针存在，再改坏它。
  //    探针本身的来历（换过两次，每次都是产物形状变了）：
  //      · 最早是 `maxDepth: 1` —— 那时 lane 行逐键渲染，`maxDepth` 是产物里一行；
  //      · 后来 lane 的 config 改成**整张映射由一个 `!!js` 表达式构造**（两形态时期），
  //        `maxDepth` 落到表达式内部写成 `c["maxDepth"] = 1` ⇒ 旧探针**找不到**了；
  //      · 现在 config 又回到**普通映射**（0.2.1-rc.2 起只有一种形态），`maxDepth: 1`
  //        确实又是一行 —— 但探针不必再动它：`agentPreset` 那一行更唯一、更贴近被测语义，
  //        所以保持在 `agentPreset: 'orch-lane-scout'`（见上方 TAMPER_PROBE 的定义）。
  //    ⇒ 形状每变一次，`includes` 那条自检就会先红，而不是让「改坏一行」静默失效。
  assert.equal(committed.includes(TAMPER_PROBE), true,
    `探针串在产物里不存在（${TAMPER_PROBE}）⇒ 下面的替换会落空、断言恒真`)
  assert.equal(compareMachineIndependent(committed.replace(TAMPER_PROBE, "agentPreset: 'orch-lane-TAMPERED'"), rendered).ok, false,
    '把一行真实内容改坏竟然没被发现 ⇒ 门漏了机器无关判据之外的差异')
})

test('render() 是纯函数（同输入两次渲染字节相同）', () => {
  const a = render(d, section, d.SHELL_SOURCE)
  const b = render(d, section, d.SHELL_SOURCE)
  assert.equal(a, b)
})
