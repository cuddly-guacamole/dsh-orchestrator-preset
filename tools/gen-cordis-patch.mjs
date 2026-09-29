// ============================================================================
// gen-cordis-patch.mjs — 由声明清单渲染 $BUNDLE/cordis.patch.yml（含 --check 门禁）
// ============================================================================
//
// 单一事实源：tools/preset-declaration.mjs（28 个 row 的声明）。
// 权威缩进参照：dsh-web-app/presets/standard.patch.yml（146 行，六级缩进 0/4/6/8/10/14）；
//   **不得**用 profiles/*/cordis.yml（它是派生件，每级 2 空格且 `>` 折叠已破坏多行文本）。
//
// 用法：
//   node tools/gen-cordis-patch.mjs            # 写 $BUNDLE/cordis.patch.yml
//   node tools/gen-cordis-patch.mjs --check    # 不写；逐字节比较，不一致 ⇒ stale + exit 1
//   node tools/gen-cordis-patch.mjs --help
// 输出（stdout）：wrote <path> (29 rows) / ok <path> (29 rows) / stale <path>
// exit：0 = 成功（写成功或 --check 一致）· 1 = --check 不一致 · 2 = 用法错误 / 输入非法
// 无第三方依赖（只用 node: 内置模块）。
//
// ⛔ 本生成器**不做**任何工具名闭集断言（该机制已按用户裁决删除，见 DESIGN.md §3.3.4 的 ⛔ 段）。
//    ⇒ deny / allow 里出现 LEGAL_TOOL_NAMES 之外的名字（典型：4 个 mcp_* 名）**必须放行并正常渲染**。
//    LEGAL_TOOL_NAMES 仅作为**参考清单**打印规模，不参与任何判定。
//
// 行数口径（⚠️ 两套数字，别混）：`(29 rows)` = DESIGN §2.4 的口径
//   （14 顶层 + 3 group + 3 delegation 控制 + 9 lane；= `topRows + groups + delegation.rows`），
//   这是计划 `:1216`/`:1220`/`:1228` 与 T08 `:1388` / T09 `:1512` 六处一致使用的数。
//   而渲染出的 `- id:` 行数是 **34**（多出的 4 = planning 1 + compaction 3 个子行 —— 它们**确实渲染**，
//   只是被 DESIGN 的算式折进其 group 条目里）⇒ 生成器把两个数都打印出来，不做数字粉饰。
//
// ⚠️ import 本模块**无副作用**（CLI 只在「直接执行」时运行）⇒ `import()` 只得到导出（供 T08/T09 复用）。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE_DIR = dirname(HERE)
export const OUT_PATH = join(BUNDLE_DIR, 'cordis.patch.yml')
const DECL_URL = pathToFileURL(join(HERE, 'preset-declaration.mjs')).href

// ── T13（C 路线实现）`SKELETON` 兜底顺序（**已删除硬编码兜底字面量**）────────────
//   ① `--skeleton <path>`（CLI，最高优先）—— **显式指定 ⇒ 不存在即硬错**，**不回落**到 ②③④
//   ② `DSH_SKELETON` 环境变量 —— 同 ①：**显式指定 ⇒ 不存在即硬错**，**不回落**到 ③④
//   ③ **DSH home 推导** `node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml`；
//      home 取值规则 = `$DSH_HOME`（去空白；空串视同未设置）→ 未设置则回落 **`~/.dsh`**
//      ⇒ 与宿主 `@deepseek-ai/dsh-home-paths` 的 `resolveDshHome()` **同一套优先级**（见下 `dshHome()`）。
//   ④ **仓内 vendor 骨架** `presets/standard.patch.yml` —— **相对脚本自身位置**解析：
//        仓内布局是 `bundle/tools/gen-cordis-patch.mjs` + 仓根 `presets/` ⇒ `../../presets/…`；
//        同时兼容「bundle 直接在仓根」的 `../presets/…`。
// ⚠️ 活机 bundle（`~/.dsh/plugins/<id>-bundle/tools/`）下 ④ 的**这两个相对路径都不存在** ——
//    那里靠 ②/③ 兜住；`--check` 仍应 exit 0。若 ①②③④ 全部取不到 ⇒ **loud 停、exit 2**，
//    **不引入默认值兜底、不编造**（§2.2 G5）。⚠️ 注意 ③ 的回落 home **不是默认值兜底**：
//    回落出来的路径仍要 `existsSync` 命中才采用，取不到照样停。
// ⚠️ 为什么不直接依赖宿主 `@deepseek-ai/dsh-home-paths` 的 `resolveDshHome()`？两条**契约**理由：
//    (1) 文件头「无第三方依赖（只用 node: 内置模块）」是本工具的既有契约；
//    (2) 仓内布局未安装该包时，静态 import 会在**模块加载期**抛 `ERR_MODULE_NOT_FOUND` 而直接崩，
//        根本走不到 `main()` 的 exit 2 —— 那才会真的**削弱** fail-closed。
//    ⚠️ 勿把「同步加载不了」当理由：Node ≥ 22.12 的 `require(esm)` 已能同步加载该包
//    （实测 v22.23.1 上 `createRequire(...)('@deepseek-ai/dsh-home-paths')` **成功**），
//    但那把工具的 Node 版本下限抬到 22.12，更早的 Node 上同一行会抛 `ERR_REQUIRE_ESM`。
//    ⇒ 若仓主要求「单一事实源」优先、愿意改掉无第三方依赖契约并抬高 Node 下限，
//      把 `dshHome()` 换成 `createRequire(import.meta.url)('@deepseek-ai/dsh-home-paths').resolveDshHome()`
//      即可，**不要**同时保留两份规则。
//    ⚠️ **已接受并拥有的漂移风险**：宿主若改动 `resolveDshHome` 的优先级，本镜像会**静默**分叉且无人拦截。
// ⚠️ 告警不在 import 期打印（保持「import 本模块无副作用」的不变量），由 main() 打印。
export const PARAMETERIZATION_WARNINGS = []
const envTrim = (v) => (typeof v === 'string' ? v.trim() : '')

/** 仓内 vendor 骨架的候选路径（相对脚本自身，逐个 existsSync 试）。 */
export function vendorSkeletonCandidates() {
  return [
    join(BUNDLE_DIR, '..', '..', 'presets', 'standard.patch.yml'),
    join(BUNDLE_DIR, '..', 'presets', 'standard.patch.yml'),
  ]
}

/** 权威骨架在某个 DSH home 下的相对位置（仓内 `node_modules/@deepseek-ai/dsh-web-app/…`）。 */
export function skeletonUnderHome(home) {
  return join(home, 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml')
}

/**
 * 取 DSH home —— 与宿主 `@deepseek-ai/dsh-home-paths` 的 `resolveDshHome()` **取值优先级一致**：
 * `$DSH_HOME`（去空白；空串/纯空白视同未设置）→ 未设置则回落 `~/.dsh`。此处不引入该包，理由见上。
 * ⚠️ 这**不是**默认值兜底：返回的 home 后面仍要走 `existsSync`，取不到照样进「全部失败 ⇒ exit 2」。
 * ⚠️ 与宿主仍有两处**既有**差异（本修复未扩大也未缩小，属另一张单，别混在本改动里）：
 *    宿主会对 `$DSH_HOME` 做 `~` 展开与分隔符归一，本函数只去尾部斜杠 ⇒
 *    `DSH_HOME='~'` 在两边的结果不同（宿主给 home，本函数给字面 `~` → 后面 existsSync 落空 ⇒ exit 2）。
 * @returns {{ path: string, via: 'DSH_HOME'|'default-home', label: string }}
 */
export function dshHome() {
  const fromEnv = envTrim(process.env.DSH_HOME)
  if (fromEnv) return { path: fromEnv.replace(/[\\/]+$/, ''), via: 'DSH_HOME', label: 'DSH_HOME' }
  return { path: join(homedir(), '.dsh'), via: 'default-home', label: '默认 home(~/.dsh)' }
}

/** 返回解析结果，取不到**不抛错**：
 *  - `{ path, tried, via }` —— 命中；
 *  - `{ path: null, tried, via: null, fatal }` —— **显式指定（①/②）但该路径不存在**：硬错，**不回落**；
 *  - `{ path: null, tried, via: null }` —— 链上全部取不到（③④ 都落空）：同样是硬停。 */
export function resolveSkeleton(cliPath = null) {
  const tried = []
  // ⚠️ ①/② 是**显式指定**：用户点名了要哪个骨架，不存在就必须点名报错并停 ——
  //    继续往下走会把**另一个**骨架当成他指定的那个用掉，那正是「不得编造」（§2.2 G5）。
  if (cliPath) {
    if (existsSync(cliPath)) { tried.push(`--skeleton ${cliPath}：存在`); return { path: cliPath, tried, via: '--skeleton' } }
    tried.push(`--skeleton ${cliPath}：不存在`)
    return { path: null, tried, via: null, fatal: `--skeleton 指定的骨架不存在 ⇒ 停：${cliPath}` }
  }
  tried.push('--skeleton：未给')
  const env = envTrim(process.env.DSH_SKELETON)
  if (env) {
    if (existsSync(env)) { tried.push(`DSH_SKELETON ${env}：存在`); return { path: env, tried, via: 'DSH_SKELETON' } }
    tried.push(`DSH_SKELETON ${env}：不存在`)
    return { path: null, tried, via: null, fatal: `DSH_SKELETON 指定的骨架不存在 ⇒ 停：${env}` }
  }
  tried.push('DSH_SKELETON：未设置')
  // ③ DSH home 推导：`$DSH_HOME` 未设置时**回落 `~/.dsh`**（与宿主 `resolveDshHome()` 同规则）
  const home = dshHome()
  if (home.via === 'default-home') tried.push(`DSH_HOME：未设置 ⇒ 回落默认 home ${home.path}`)
  const homeCandidate = skeletonUnderHome(home.path)
  if (existsSync(homeCandidate)) { tried.push(`${home.label} 推导 ${homeCandidate}：存在`); return { path: homeCandidate, tried, via: home.via } }
  tried.push(`${home.label} 推导 ${homeCandidate}：不存在`)
  for (const candidate of vendorSkeletonCandidates()) {
    if (existsSync(candidate)) { tried.push(`vendor ${candidate}：存在`); return { path: candidate, tried, via: 'vendor' } }
    tried.push(`vendor ${candidate}：不存在`)
  }
  return { path: null, tried, via: null }
}

/** 不带 CLI 参数时的解析结果（供 `import` 侧使用；取值 = ②→③→④）。 */
export const SKELETON_RESOLVED = resolveSkeleton(null)
export const SKELETON = SKELETON_RESOLVED.path
const PRESET_ROW_ID = 'preset-dsh-orchestrator-preset'

// ── 取值槽：plan-mode 的 section 文本 ────────────────────────────────────────
// T06 契约把 `PLAN_MODE_SECTION` 留作**有意的实现期取值槽**（= `''`），由本生成器在渲染时填入。
// 取法 = 「缩进判定 + 非空门」：只有**缩进大于** `section: |` 键的行属于块内容；**块内空行属于值**
// （⚠️ 独立裁决 A：段间 5 个空行必须保留 —— 删掉等于把多行结构粘掉，计划 `:1326`/`:1327` 的逐字对照门会拦）。
// ⚠️ 非空门必须保留（改判据为「至少一个非空行」）—— 取不到内容时若静默渲染，会往产物里写一个空 section。
export function extractPlanModeSection(path = SKELETON) {
  const lines = readFileSync(path, 'utf8').split('\n')
  const out = []
  let base = -1
  let started = false
  for (const line of lines) {
    const indent = /^ */.exec(line)[0].length
    if (!started) {
      if (/section: \|$/.test(line)) { started = true; base = indent }
      continue
    }
    // ⚠️ 先判「空行」再判缩进：空行的 indent = 0，若先判 `indent > base` 会走到 break，块内空行会丢
    if (line.trim() === '') { out.push(''); continue }
    if (indent > base) { out.push(line.slice(base + 2)); continue }
    break                                       // 缩进回到 ≤ 键缩进 ⇒ 块结束
  }
  // YAML 的 `|`（clip）**不含尾部空行** ⇒ 块尾若吞进了空行必须去掉，否则会多出一个 `\n`
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  if (!out.some((l) => l !== '')) {
    throw new Error(`PLAN_MODE_SECTION EMPTY ⇒ 停（${path} 里取不到 section 块内容）`)
  }
  return out
}

// ── YAML 渲染原语 ───────────────────────────────────────────────────────────
const q = (s) => `'${String(s).replace(/'/g, "''")}'`          // 字符串值：单引号 + '' 转义
const RAW = (text) => ({ __raw: text })                        // 整行原样（如 `!!js ...` / `cordis:group`）
const BLOCK = (lines) => ({ __block: lines })                  // 块标量（内容行缩进 = 键缩进 + 2）
// 这三个键的字符串值**裸写**（与权威骨架 standard.patch.yml:92-102 及旧 bundle 一致）。
// 理由（可机械核对）：T08 自检 `grep -o "toolName: subagent_[a-z]*"` 期望 **10** 命中
//   （9 lane + fork）⇒ 若写成 `toolName: 'subagent_fork'` 则该断言恒 0（又一个假通过面）。
const BARE_STRING_KEYS = new Set(['provider', 'toolName', 'backgroundMode'])

function pushValue(lines, indent, key, value) {
  const pad = ' '.repeat(indent)
  if (value === null || value === undefined) throw new Error(`配置值缺失：${key}`)
  if (typeof value === 'object' && '__raw' in value) { lines.push(`${pad}${key}: ${value.__raw}`); return }
  if (typeof value === 'object' && '__block' in value) {
    lines.push(`${pad}${key}: |`)
    // ⚠️ 空行必须渲染成**真 0 字节行**（不能带 `indent + 2` 个尾随空格，否则与骨架不是逐字节相同）
    for (const l of value.__block) lines.push(l === '' ? '' : ' '.repeat(indent + 2) + l)
    return
  }
  if (typeof value === 'boolean' || typeof value === 'number') { lines.push(`${pad}${key}: ${value}`); return }
  if (typeof value === 'string') {
    lines.push(`${pad}${key}: ${BARE_STRING_KEYS.has(key) ? value : q(value)}`)
    return
  }
  if (Array.isArray(value)) {                                   // 列表项**裸写**（加引号会让抽取正则恒空）
    lines.push(`${pad}${key}:`)
    for (const item of value) lines.push(`${' '.repeat(indent + 2)}- ${item}`)
    return
  }
  lines.push(`${pad}${key}:`)                                   // 嵌套映射
  for (const [k, v] of Object.entries(value)) pushValue(lines, indent + 2, k, v)
}

function pushDisabled(lines, indent, value) {
  if (value === true) { lines.push(`${' '.repeat(indent)}disabled: true`); return }
  if (typeof value === 'string') { lines.push(`${' '.repeat(indent)}disabled: !!js ${value}`); return }
  throw new Error(`disabled 只支持 true 或 JS 表达式字符串，收到 ${JSON.stringify(value)}`)
}

function pushRow(lines, row, indent) {
  const k = indent + 2
  lines.push(`${' '.repeat(indent)}- id: ${row.id}`)
  // `name` 通常是字符串（单引号）；group 的 `name: cordis:group` 用 RAW 保持与权威骨架逐字一致
  lines.push(`${' '.repeat(k)}name: ${typeof row.name === 'object' ? row.name.__raw : q(row.name)}`)
  if (row.disabled !== undefined) pushDisabled(lines, k, row.disabled)
  if (row.group !== undefined) lines.push(`${' '.repeat(k)}group: ${row.group}`)
  if (row.isolate !== undefined) pushValue(lines, k, 'isolate', row.isolate)
  if (row.children !== undefined) {                  // group 的子行列表挂在 `config:` 下
    lines.push(`${' '.repeat(k)}config:`)
    for (const child of row.children) pushRow(lines, child, k + 2)
  }
  if (row.config !== undefined) {
    lines.push(`${' '.repeat(k)}config:`)
    for (const [ck, cv] of Object.entries(row.config)) pushValue(lines, k + 2, ck, cv)
  }
}

const personaExpr = (bundlePkg, file) =>
  `!!js process.getBuiltinModule('node:fs').readFileSync(process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('${bundlePkg}/personas/${file}'), 'utf8')`

export function laneRow(lane, d) {
  const common = d.LANE_COMMON          // ⚠️ 必须复用声明里的那对值，不得另写一份
  const filter = lane.deny !== undefined ? { deny: lane.deny } : { allow: lane.allow }
  return {
    id: `tool-subagent-${lane.tool.replace(/^subagent_/, '').replace(/_/g, '-')}`,
    name: '@deepseek-ai/dsh-tool-subagent',
    config: {
      // provider / toolName / backgroundMode 的字符串值由 BARE_STRING_KEYS 规则**裸写**（见上）
      provider: common.provider,
      toolName: lane.tool,
      backgroundMode: common.backgroundMode,
      maxDepth: lane.maxDepth,
      persona: RAW(personaExpr(d.bundlePkg, lane.persona)),
      toolFilter: filter,
    },
  }
}

// 取值槽：`plan-mode.config.section` 在声明里是 `''` ⇒ 渲染时填入从权威骨架取来的 6 行原文
const withSection = (row, section) =>
  row.config?.section !== undefined ? { ...row, config: { ...row.config, section: BLOCK(section) } } : row

export function groupEntry(group, d, section) {
  const entry = { id: group.id, name: RAW('cordis:group'), group: true }
  if (group.isolate !== undefined) entry.isolate = group.isolate
  entry.children = group.rows.map((r) => withSection(r.tool !== undefined ? laneRow(r, d) : r, section))
  return entry
}

export const countRows = (d) =>
  d.topRows.length + d.groups.length + d.groups.find((g) => g.id === 'delegation').rows.length

export const countFileEntries = (d) =>
  d.topRows.length + d.groups.length + d.groups.reduce((n, g) => n + g.rows.length, 0)

export function render(d, section, shellSource) {
  const lines = [
    '# Generated by tools/gen-cordis-patch.mjs — DO NOT EDIT BY HAND.',
    '# Source of truth: tools/preset-declaration.mjs',
    '# Regenerate: node tools/gen-cordis-patch.mjs',
    // T07（C1）：本行是**产物里唯一**记录 shell 来源的地方 ⇒ 绝对路径与 32 位裸 md5
    // 一律不进产物（否则一份产物就把发布面钉死在某台机器上）。
    // 只保留：来源种类 / 是否回退 / bash 与 pwsh 的生效值与来源行号 / 12 位规范化摘要。
    `# Shell source: kind=${shellSource.kind} fallback=${shellSource.fallback} bash=${shellSource.bash} pwsh=${shellSource.pwsh} normalized-digest=${shellSource.normalizedDigest} (absolute path and raw md5 intentionally omitted; digest is path-normalized)`,
    '#',
    "# This file's `plugins[]` rows are declared in full because DSH agent presets",
    '# have no inheritance or composition mechanism (see DESIGN.md §2.1).',
    '# Rows marked [official] below are configuration derived from DeepSeek Harness',
    '# (MIT License, Copyright (c) 2026 DeepSeek); see LICENSE for the attribution.',
    '- insert:',
    `    - id: ${PRESET_ROW_ID}`,
    "      name: '@deepseek-ai/dsh-agent-preset'",
    '      config:',
    `        id: ${q(d.presetId)}`,
    `        name: ${q(d.presetName)}`,
    '        description: |-',
    `          ${d.description}`,
    '        plugins:',
  ]
  for (const row of d.topRows) pushRow(lines, withSection(row, section), 10)
  for (const g of d.groups) pushRow(lines, groupEntry(g, d, section), 10)
  // bundle 级 provider 行：与 preset 行**同层**，属顶层 `- insert:`，不嵌进 preset.config.plugins[]。
  // 它挂载本包自己的 skill provider，让四个 orch-* 技能随包自带，不再拷进用户全局目录。
  lines.push(`    - id: ${d.providerRowId}`)
  lines.push(`      name: '${d.providerEntry}'`)
  // aegis 前缀行：同一层的第二个挂载点。路由表按 aegis-* 点名二十个技能，而上游
  // 按裸名注册；这一行是两者之间那座桥，带一个默认开的设置开关。
  lines.push(`    - id: ${d.prefixRowId}`)
  lines.push(`      name: '${d.prefixEntry}'`)
  lines.push('      config:')
  lines.push(`        prefixAegisSkills: ${d.prefixAegisSkills}`)
  return lines.join('\n') + '\n'
}

// ── shell 来源交叉核对（协调者裁决 1 步骤 2：`dsh --profile web --dump-config`）──
function crossCheckShell(d) {
  let live
  try { live = d.readShellRowsFromDumpConfig('web') }
  catch (e) { return { ok: false, line: `SHELL-SOURCE-CROSSCHECK: unavailable (${e.message.split('\n')[0]})` } }
  const same = live.rows.bash.disabled === d.HOST_SHELL_ROWS.bash.disabled
    && live.rows.pwsh.disabled === d.HOST_SHELL_ROWS.pwsh.disabled
  if (same) {
    return { ok: true, line: `SHELL-SOURCE-CROSSCHECK: dump-config agrees (md5=${live.md5}; bash=${live.rows.bash.disabled}@${live.rows.bash.line}; pwsh=${live.rows.pwsh.disabled}@${live.rows.pwsh.line})` }
  }
  // 不一致 ⇒ loud 标记，并**以 live dump 为准**给出 shell 名（本 preset 的 patch 不渲染 shell 名，
  // 故只影响参考清单口径；打印两侧原始值以免静默漂移）。
  return {
    ok: false,
    line: `SHELL-SOURCE-DRIFT frozen(bash=${d.HOST_SHELL_ROWS.bash.disabled},pwsh=${d.HOST_SHELL_ROWS.pwsh.disabled}) `
      + `vs dump-config(bash=${live.rows.bash.disabled},pwsh=${live.rows.pwsh.disabled}) ⇒ live dump 为准 `
      + `⇒ shellNames=${JSON.stringify(d.shellNamesFor(process.platform, live.rows))}`,
  }
}

const USAGE = [
  'usage: node tools/gen-cordis-patch.mjs [--check] [--skeleton <path>] [--no-crosscheck] [--help]',
  '',
  '  (no flag)        render $BUNDLE/cordis.patch.yml and write it',
  '  --check          render and compare with the existing file (no write); mismatch => stale + exit 1',
  '  --skeleton <p>   authoritative indentation reference (plan-mode section source).',
  '                   Resolution order: --skeleton > $DSH_SKELETON >',
  '                   <DSH home>/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml >',
  '                   vendored ../../presets/standard.patch.yml (relative to this script).',
  '                   <DSH home> = $DSH_HOME when set, else ~/.dsh (host resolveDshHome() rule).',
  '                   Explicit --skeleton or $DSH_SKELETON that does not exist => loud stop, exit 2',
  '                   (never falls through to the other candidates).',
  '                   All four unavailable => loud stop, exit 2 (no default fallback).',
  '  --no-crosscheck  skip the `dsh --profile web --dump-config` cross-check. Default: cross-check ON.',
  '                   Skipping never changes the rendered product — the cross-check only prints.',
  '                   It is also non-fatal by design: unavailable DSH => "unavailable", still exit 0.',
  '  --help           print this usage',
  '',
  'env:  DSH_SKELETON / DSH_SHELL_ROWS / DSH_FROZEN_ASSEMBLED / DSH_BIN / DSH_HOME',
  'exit: 0 ok · 1 --check mismatch · 2 usage error / invalid input / skeleton unresolvable',
].join('\n')

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0 }
  // T13：显式解析三个开关；未识别的参数才 exit 2
  const unknown = []
  let skeletonCli = null
  let crosscheck = true
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--check') continue
    if (a === '--no-crosscheck') { crosscheck = false; continue }
    if (a === '--skeleton') {
      if (i + 1 >= argv.length) { console.error(`--skeleton needs a path argument\n\n${USAGE}`); return 2 }
      skeletonCli = argv[i += 1]
      continue
    }
    unknown.push(a)
  }
  if (unknown.length > 0) { console.error(`unknown argument: ${unknown.join(' ')}\n\n${USAGE}`); return 2 }
  const check = argv.includes('--check')

  let d
  try { d = await import(DECL_URL) } catch (e) { console.error(`declaration load failed ⇒ 停：${e.message}`); return 2 }
  // T06：参数化告警在这里才打印（import 期不得有副作用）
  for (const w of [...PARAMETERIZATION_WARNINGS, ...(d.PARAMETERIZATION_WARNINGS ?? [])]) {
    console.error(`⚠ 参数化告警：${w}`)
  }
  // T13：骨架解析（CLI 优先）；显式指定却不存在 ⇒ 硬错停；链上全落空 ⇒ 也停。两者都 exit 2
  const skeleton = resolveSkeleton(skeletonCli)
  for (const t of skeleton.tried) console.error(`  骨架候选 ${t}`)
  if (skeleton.fatal) {
    console.error(`${skeleton.fatal}\n  显式指定的骨架不存在 ⇒ **不得回落**到其余候选（回落 = 拿另一个骨架冒充它）：\n  ${skeleton.tried.join('\n  ')}`)
    return 2
  }
  if (skeleton.path === null) {
    console.error(`skeleton 来源链全部失败 ⇒ 停（不得编造、不得用默认值兜底）：\n  ${skeleton.tried.join('\n  ')}`)
    return 2
  }
  console.error(`⚠ 取值槽：SKELETON=${skeleton.path} (via ${skeleton.via})`)
  console.error(`⚠ 取值槽：DSH_BIN=${d.DSH_BIN ?? '未解析（crosscheck 将不可用，但不致命）'}`)
  console.error(`⚠ 取值槽：SHELL_SOURCE_CHAIN=${JSON.stringify(d.SHELL_SOURCE_CHAIN)}`)
  let section
  try { section = extractPlanModeSection(skeleton.path) } catch (e) { console.error(e.message); return 2 }

  let content
  try { content = render(d, section, d.SHELL_SOURCE) } catch (e) { console.error(`render failed ⇒ 停：${e.message}`); return 2 }

  const rows = countRows(d)
  const entries = countFileEntries(d)
  // ⚠️ 口径不再歧义（独立裁决的次要项）：`entries` 是 **`plugins[]` 内的条目数**；
  //    文件级 `- id:` 行数**从渲染结果实测**（含 preset row @4），不写死常数。
  const fileIdLines = content.split('\n').filter((l) => /^\s*- id:/.test(l)).length
  const detail = [
    `rows-detail: ${rows} = ${d.topRows.length} top-level + ${d.groups.length} group + ${d.groups.find((g) => g.id === 'delegation').rows.length} delegation (3 control + ${d.LANES.length} lane)`,
    `plugins-entries: ${entries} \`plugins[]\` entries (the ${entries - rows} extra vs the ${rows} declared rows = planning 1 + compaction 3 children; they DO render)`,
    `file-id-lines: ${fileIdLines} \`- id:\` lines in the rendered file (measured from content; includes the preset row @4, which is outside \`plugins[]\`)`,
    `reference-list: LEGAL_TOOL_NAMES size ${d.LEGAL_TOOL_NAMES.size} — REFERENCE ONLY, not a gate (deny/allow names are NOT validated here)`,
    `SHELL-SOURCE: ${d.SHELL_SOURCE.source} md5=${d.SHELL_SOURCE.md5}`,
    `SHELL-SOURCE-FALLBACK: ${d.SHELL_SOURCE.fallback}`,
    // T13：crosscheck 默认**开**；`--no-crosscheck` 只跳过这一行打印，**不改渲染**。
    // crossCheckShell 自身在 DSH 不可用时 catch 掉并报 `unavailable` ⇒ **不致命**。
    crosscheck ? crossCheckShell(d).line : 'SHELL-SOURCE-CROSSCHECK: skipped (--no-crosscheck)',
  ]

  if (check) {
    let existing = null
    try { existing = readFileSync(OUT_PATH, 'utf8') } catch { existing = null }
    if (existing === content) { console.log(`ok ${OUT_PATH} (${rows} rows)`); for (const l of detail) console.log(l); return 0 }
    console.log(`stale ${OUT_PATH}${existing === null ? ' (artifact absent)' : ''}`)
    for (const l of detail) console.log(l)
    return 1
  }

  writeFileSync(OUT_PATH, content)
  console.log(`wrote ${OUT_PATH} (${rows} rows)`)
  for (const l of detail) console.log(l)
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url
if (invokedDirectly) {
  main().then((code) => process.exit(code)).catch((e) => { console.error(`fatal: ${e.stack ?? e}`); process.exit(2) })
}
