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
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import * as d from './preset-declaration.mjs'
import {
  OUT_PATH, SKELETON, SKELETON_RESOLVED, extractPlanModeSection, render, groupEntry, countRows, countFileEntries,
  // ↓ 「产物里哪几行不参与逐字节比较」这条事实的**唯一 home** 在生成器那边：门与测试共用
  //   同一个实现。两处各写一份遮蔽规则 = 两个 home = 迟早分叉 = 又一层「绿色掩盖红色」。
  MACHINE_DERIVED_LINE, compareMachineIndependent, provenanceLineOf,
} from './gen-cordis-patch.mjs'

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
const expectedPluginsIds = () => [...d.topRows.map((r) => r.id), ...d.groups.map((g) => g.id)]
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

/**
 * DESIGN.md §2.3「删除项」表逐行抄下来的 10 个官方 row id。
 * ⚠️ 这份清单**不是**「官方 id 不得出现在产物里」——那种断言在本项目里是错的：
 * §2.1 说 DSH 没有 preset 继承，官方行**必须**逐行重新声明，所以 `tool-fs` / `plan-mode` /
 * `compaction-basic` 这些官方 id 出现在产物里是**设计要求**，不是碰撞。
 * 真正的约束是反过来的：本 preset 主动删掉的那几行**不许复活**（DESIGN.md §2.3 + §15 R16:
 * 「不挂载 ⇒ 不存在」比「存在但 deny」更彻底）。
 */
const DELETED_BY_DESIGN_2_3 = [
  'command-goal', 'tool-goal',
  'present',
  'tool-plugin-manager',
  'tool-ralph',
  'tool-subagent-codex', 'tool-subagent-claude-code',
  'workflow-ptc', 'tool-workflow',
  'tool-subagent',
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
  assert.equal(presetRows.length, 1, '应当恰好一个 agent-preset 行')
  assert.equal(presetRows[0].id, `preset-${d.presetId}`)
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
  const declaredRows = countRows(d)
  const renderedPlugins = idsAt(10).length + idsAt(14).length
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
  assert.equal(all.length, countFileEntries(d) + 3)
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
test('DESIGN §2.3 标记删除的 10 个官方 row 不在产物里', () => {
  const official = officialIds()
  for (const id of DELETED_BY_DESIGN_2_3) {
    assert.equal(official.has(id), true, `${id} 已不在权威骨架里 —— 这份删除清单过期了，先核对 DESIGN §2.3 与骨架`)
    assert.equal(rows().some((r) => r.id === id), false, `${id} 是 DESIGN §2.3 明确删除的行，不该出现在 cordis.patch.yml`)
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

test('preset 内的本包自写挂载行是这 3 条、都挂本包 specifier；与官方 id 撞名的恰好只有 persona', () => {
  const official = officialIds()
  // 期望值写成字面量：这条断言保护的是「本地行**刻意**用通用 id」这个决定本身。
  // 改名（哪怕改成更整齐的 orch-* 名字）会让它失败 —— 那是提示人先改这条记录，不是静默放过。
  const localInPreset = rows().filter((r) => r.indent === 10 && r.name.startsWith(`${d.bundlePkg}/`))
  assert.deepEqual(localInPreset.map((r) => r.id), ['persona', 'routing-sections', 'lane-composition'],
    'preset 内挂本包 specifier 的行不是这 3 条 —— 核对 declaration 的 topRows 与 ADR「keep lane-composition」')
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
// 7. 每个 lane 行恰好一个 toolFilter：allow 与 deny 二选一
// ============================================================================
test('每个 lane 行恰好有 toolFilter.allow 或 toolFilter deny 之一；只有 reader 用 allow', () => {
  const lines = committed.split('\n')
  // lane 行 = 由 LANES 铸出的那 9 个（fork 是 delegation 控制行，没有 toolFilter，不在此列）
  const laneIds = d.LANES.map(laneRowId)
  const laneRows = parseRows(committed).filter((r) => r.indent === 14 && laneIds.includes(r.id))
  assert.equal(laneRows.length, d.LANES.length, '产物里的 lane 行数与声明不符')
  const allowLanes = []
  for (const r of laneRows) {
    const end = lines.findIndex((l, i) => i >= r.startLine && idLine.test(l))
    const body = lines.slice(r.startLine, end === -1 ? lines.length : end)
    const hasAllow = body.some((l) => /^ +allow:/.test(l))
    const hasDeny = body.some((l) => /^ +deny:/.test(l))
    // ⚠️ 「不能同时给」是**本项目的房规**，不是宿主的约束。宿主只校验
    //    「配了 toolFilter 就不能 allow/deny 皆空」（`dsh-tool-subagent/lib/index.js:370`
    //    在两者皆 undefined 时抛）—— allow 与 deny 同时给**不**被宿主拒绝，DESIGN §3.3.2
    //    约束 3（:414）也只写「不能同时为空」。旧版本把这条注释成 §3.3.2 约束 3，是误引。
    //    房规的依据在 §3.3.3 共同约定（:433）「只读 lane 用 deny；reader 用 allow 白名单」：
    //    一个 filter 同时给两份名单时，读哪个、怎么合并由宿主决定，本项目不依赖那个语义。
    assert.equal(hasAllow && hasDeny, false, `${r.id}: allow 与 deny 同时给（本项目房规，见 §3.3.3 共同约定 :433）`)
    assert.equal(hasAllow || hasDeny, true, `${r.id}: toolFilter 配了却既无 allow 也无 deny ⇒ mount 期抛错（§3.3.2 约束 3 :414，宿主 lib/index.js:370）`)
    if (hasAllow) allowLanes.push(r.id)
  }
  // §3.3.3 共同约定（:433）：只读 lane 用 deny；reader 用 allow 白名单（它必须看不到任何别的工具）
  assert.deepEqual(allowLanes, ['tool-subagent-reader'])
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
    assert.equal(scalarOf(block, 'maxDepth'), '1',
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

test('lane 寻址的 3 个工具名在每个 lane 的工具面里都不出现（deny 面必须列全，allow 面必须不含）', () => {
  // 依据：ADR「keep-lane-composition」的决定第 4 条。这三个名字由本包自己的插件**全局**注册
  // （`lane-composition.mjs:1-30`），对 lane 而言是从 Lead 那一层**继承**来的 ⇒ 落在
  // `restrictableNames` 内 ⇒ deny 合法且生效（`preset-declaration.mjs:122-125`）。
  // ⇒ 漏 deny 的后果**不是** loud 失败，是 lane 获得了寻址其它 lane 的能力：边界静默失效。
  //   这是「不挂载 ⇒ 不存在」（§2.3 / §15 R16）那条纪律在**寻址面**上的等价要求。
  // ⚠️ 判据**从产物形状取**（该行有没有 `deny` 键），不从声明取 —— 否则「把 reader 从 allow
  //    改成 deny」这种声明侧编辑会跟着分支走，断言变成空转。
  const lines = committed.split('\n')
  for (const lane of d.LANES) {
    const r = rows().find((x) => x.indent === 14 && x.id === laneRowId(lane))
    assert.notEqual(r, undefined, `产物里找不到 lane 行 ${laneRowId(lane)}`)
    const end = lines.findIndex((l, i) => i >= r.startLine && idLine.test(l))
    const body = lines.slice(r.startLine, end === -1 ? lines.length : end)
    const usesDeny = body.some((l) => /^ +deny:/.test(l))
    for (const name of LANE_ADDRESSING_TOOLS) {
      if (usesDeny) {
        assert.equal(body.some((l) => l.includes(`'${name}'`)), true,
          `lane ${lane.tool} 的 deny 名单里没有 ${name} ⇒ 它能寻址别的 lane（ADR keep-lane-composition 决定 4）`)
      } else {
        assert.equal(body.some((l) => l.includes(name)), false,
          `lane ${lane.tool} 用 allow 白名单，白名单里出现了 ${name} ⇒ 越界（ADR keep-lane-composition 决定 4）`)
      }
    }
  }
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
  assert.equal(compareMachineIndependent(committed.replace('maxDepth: 1', 'maxDepth: 9'), rendered).ok, false,
    '把一行真实内容改坏竟然没被发现 ⇒ 门漏了机器无关判据之外的差异')
})

test('render() 是纯函数（同输入两次渲染字节相同）', () => {
  const a = render(d, section, d.SHELL_SOURCE)
  const b = render(d, section, d.SHELL_SOURCE)
  assert.equal(a, b)
})
