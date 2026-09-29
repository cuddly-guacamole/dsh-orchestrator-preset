// ============================================================================
// preset-declaration.mjs — 新 preset 的 28 个 row 的唯一来源（声明清单）
// ============================================================================
//
// 定位：把「28 个 row」从散文描述变成机器可读的单一来源，让 cordis.patch.yml 可再生成
//       （DESIGN.md §14 D9「引入生成器」的对价；计划 T06 的产物）。
//
// 消费者：
//   - tools/gen-cordis-patch.mjs   —— T07 的生成器，把本文件渲染成 cordis.patch.yml
//   - T08 / T10 的静态自检         —— import 本文件做「产物 ↔ 参考清单」交叉核对
//   - T24 的探针插件               —— import { LEGAL_TOOL_NAMES }
//
// 值的权威来源：DESIGN.md §2.3（12 顶层 row + 3 group）· §3.3.3（9 lane 表）
//               · §3.3.4（deny / allow 最终名单 + MCP 处置）；计划 T06 为该结构的逐条载体。
//
// ⚠️ 本模块**带 I/O**（计划 T06 第 1097–1102 行明写）：import 时读**装配产物**顶层
//    `tool-bash` / `tool-pwsh` 的**生效** disabled 字面量，用于派生 PLATFORM_SHELL。
//    - **来源链（协调者裁决 1 修订版 —— 2026-09-25 改）**：① 首选 T02 冻结的真实装配产物
//      `$A/profile-web/cordis.yml`（确定性、无宿主依赖）② 交叉核对 `dsh --profile web --dump-config`
//      （只读组装；由**生成器**执行并打印，import 时**不**起子进程）③ 来源①缺失 ⇒ 单独用 live dump
//      ④ 两者都不可得 ⇒ **loud 停（抛错 ⇒ 进程非 0 退出）**，不得编造、不得默认值兜底。
//    - ⚠️ `profiles/*/cordis.yml` 是**派生件**（启动时被重置为 4 行空 root，**组装结果不回写它**；
//      R-1 演练实测）⇒ 它**不是**合法来源，只作为链上第 2 步（正常必然取不到内容）。
//    - 失败语义：读不到文件 / 找不到那两行 / hostRows 缺字段 ⇒ **抛错**（loud 停，不猜值）。
//    - ⇒ **import 本模块即可能抛**（但已不再依赖「宿主是否在运行」）。来源指纹见 `SHELL_SOURCE`。
//    - 计划允许（不强制）把读产物那段拆到独立模块 tools/host-shell-rows.mjs 以保持纯数据；
//      本文件按计划**不拆分**，故把该 I/O 依赖与失败语义写在此处（即计划要求的落点）。
//
// ⚠️ 与计划 T06 契约块的**唯一一处结构性差异（有意，值不变）**：契约块按
//    「topRows → groups → LANES → 常量」的**叙述顺序**书写，但 `groups` 引用了 `LANES`
//    与 `PLAN_MODE_SECTION`，而 ESM 的 `const` 存在 TDZ ⇒ 照抄该顺序会在 import 时抛
//    `ReferenceError: Cannot access 'PLAN_MODE_SECTION' before initialization`（LANES 同理）。
//    ⇒ 本文件把**被引用者前置**（MCP_DENY / 三份 deny / PLATFORM_SHELL / PLAN_MODE_SECTION /
//    LANES），再声明 topRows / groups。**所有值逐字照抄契约块，只调整声明次序。**
//
// ⛔ LEGAL_TOOL_NAMES 是**参考清单（REFERENCE list）**，**⛔ 不是门**：
//    禁止在生成器里用它断言 / 拦截 deny / allow 名单（「生成期闭集断言」机制已按用户裁决删除，
//    见 DESIGN.md §3.3.4 的 ⛔ 段）。它只供人读 + 产物自检。新的兜底 = 「首次派发时 loud 失败」。

// 12 个顶层 row（配置值与 preset-standard 逐字一致）
// 3 个 group · 3 个 delegation 控制行 · 9 个 lane 行

export const presetId = 'dsh-orchestrator-preset'
export const presetName = 'DSH Orchestrator Preset'
export const bundlePkg = '@quill507/dsh-orchestrator-preset'

// ── bundle 级 skill provider 行（与 preset 行同属顶层 `- insert:`）──────────
// 目的：让四个 `orch-*` 技能随 bundle 自带，不再拷进用户全局 `~/.dsh/skills/`。
// 参照实现：本机 aegis/extensions/dsh/index.js（12 行）与 hw-skills/extensions/dsh/index.js（33 行）。
// ⛔ 入口 specifier 必须是**带 scope 的完整形式**：短形式会解析到不存在的目录，
//    bundle 静默 MODULE_NOT_FOUND 加载失败（hw-skills cordis.patch.yml 记录了实测）。
//    本包已有的 12 处自引用用的就是这个形式且今天可用。
export const providerRowId = 'orch-method-pack'
export const providerEntry = `${bundlePkg}/extensions/dsh/index.js`
export const providerName = 'orch-method-pack'

// ── bundle 级 aegis 前缀行（与 provider 行同层）────────────────────────────
// 为什么前缀必须随预设发布：预设的常驻路由表按 `aegis-*` 点名二十个技能，而上游
// aegis 包按**裸名**注册（brainstorming、goal-framing…），因为它不绑定宿主。
// 没有这一步，整张路由表会指向二十个不存在的名字。详见 extensions/dsh/aegis-prefix.js。
// 它**只做命名空间，不碰描述** —— 描述语言是读者偏好，不是路由需求。
// ⛔ 关闭 `prefixAegisSkills` 必须同时改写路由表，两者不能分开。
export const prefixRowId = 'orch-aegis-prefix'
export const prefixEntry = `${bundlePkg}/extensions/dsh/aegis-prefix.js`
export const prefixAegisSkills = true

// description：默认文本（计划 T06 给定；约束：不得含被排除的上游项目文本（DESIGN.md §12.4/§12.5），不得含用户路径）
export const description = 'A thin orchestration preset: aegis method pack for methodology, self-authored lane boundaries for delegation. Declares its full plugins[] because DSH presets have no inheritance.'

// ── MCP loader 名（修 MCP 洞）─────────────────────────────────────────────────
// 4 个 loader 名 = `mcp_<server>`（默认命名，dsh-mcp-loader/src/index.ts:74）。
// 用户在 web profile 里配了 4 个 server（singleToolThreshold: 0 ⇒ 每个都有 loader）：
//   playwright / jlceda / cloudflare-browser / desktop-touch
// ⇒ 4 个 loader 工具：mcp_playwright / mcp_jlceda / mcp_cloudflare-browser / mcp_desktop-touch
//
// 【能不能挡？能。源码依据】dsh-tools/lib/index.js:2895-2910 的 restrict() 把 deny 名
//   校验 against `view(scope).restrictableNames`（= **继承来的**名字集合，含 global 层）。
//   而 mcp-loader 的 loader 工具是 **全局注册**的（dsh-mcp-client/lib/index.js:153 的
//   ctx.tools.register；mcp-loader 同路径）⇒ **在 restrictableNames 内** ⇒ deny 生效。
//
// 【loader 自己的 hiddenTools **挡不住** loader 名】:117 `deny.delete(loaderName)` +
//   :169-171 直接抛错（"rename the loader or drop the rule"）⇒ loader 名被结构性保护。
//   ⇒ 只有 preset 的 toolFilter 能挡它。
//
// ⚠️ **必须全部 10 个 agent 都 deny（不只只读 lane）** —— forge 若成为 holder，它派出的
//    只读孙代会经 ancestryIds 继承该 server 的真实工具名，与只读边界直接冲突。
// ⚠️ **orchestrator 无法被本 preset 收窄**（toolFilter 只是 `tool-subagent` row 的 config 字段，
//    orchestrator 由 preset registry 创建 ⇒ 无该机制）⇒ 记为**已知残余风险，不假装解决**。
// ⚠️ **漂移提醒**：MCP_DENY 是**部署相关**的（随用户的 MCP 配置变化）⇒ 新增 MCP server 后
//    必须同步这 4 处（3 份 deny + DESIGN.md §3.3.4）。
export const MCP_DENY = ['mcp_playwright', 'mcp_jlceda', 'mcp_cloudflare-browser', 'mcp_desktop-touch']

// 只读 lane（**25** 项 = 21 + 4 MCP）—— 控制面 3 名（DESIGN.md §3.3.4 的裁决：只读 lane 不得操纵/杀死他 lane）
//   ⚠️ **+3 项（T16 / lane-composition.mjs）**：`subagent_children` / `subagent_send` / `subagent_interrupt`
//   —— 它们是自写绑定器注册进 **Lead own scope** 的 lane 寻址名；scope 自己的层会被**其下每个 agent 继承**
//   （`dsh-scope:162-171` `chainLayers` + `dsh-tools:2959-2974`）⇒ 不 deny 就会出现在 lane 的工具面里。
//   这 3 名对 lane 是**继承来的** ⇒ 落在 `restrictableNames` 内 ⇒ deny **合法且生效**（不会抛掉整条 filter）。
export const READONLY_DENY = ['write', 'edit', 'todo_write', 'ask_user_question', 'exit_plan_mode',
  'send_message', 'interrupt_agent', 'list_agents',
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  'subagent_fork',
  'subagent_scout', 'subagent_archivist', 'subagent_seer', 'subagent_reader',
  'subagent_analyst', 'subagent_auditor', 'subagent_wright', 'subagent_forge', 'subagent_planner',
  ...MCP_DENY]
// wright（**22** 项 = 18 + 4 MCP）—— 同上，叶子执行者不需要控制面
//   （可写、可用 todo_write / skill）；⚠️ T16 的 3 个 lane 寻址名同样 deny（理由见上）
export const WRIGHT_DENY = ['ask_user_question', 'exit_plan_mode',
  'send_message', 'interrupt_agent', 'list_agents',
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  'subagent_fork',
  'subagent_scout', 'subagent_archivist', 'subagent_seer', 'subagent_reader',
  'subagent_analyst', 'subagent_auditor', 'subagent_wright', 'subagent_forge', 'subagent_planner',
  ...MCP_DENY]
// forge（**17** 项 = 13 + 4 MCP）—— 保留 list_agents + send_message（它要管自己派出的只读孙代）；
//   deny interrupt_agent。**MCP 也 deny**（理由见上）。⚠️ T16 的 3 个 lane 寻址名同样 deny：
//   本轮裁决是「这 3 件不出现在**任何 lane** 的工具面里」（见 T16 目标句）—— lane 用「派人」而不是「寻址」。
export const FORGE_DENY = ['ask_user_question', 'exit_plan_mode', 'interrupt_agent',
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  'subagent_fork',
  'subagent_analyst', 'subagent_auditor', 'subagent_reader', 'subagent_wright', 'subagent_forge', 'subagent_planner',
  ...MCP_DENY]

// ── shell 工具名派生（⚠️ 不能只用 process.platform）──────────────────────────
// 在用户的部署里，**home 级 patch**（$DSH_HOME/cordis.patch.yml）把 host 层的
//   `tool-bash` 覆盖为 `disabled: false`、`tool-pwsh` 覆盖为 `disabled: true`
//   （装配产物 profiles/web/cordis.yml:209-214 证实）⇒ **Windows 下 bash 确实被注册、可 restrict**。
//   若用 process.platform 只给 'pwsh' ⇒ 「deny bash」会断言通过、首次派发才炸。
// ⇒ 正确做法：读装配产物里 tool-bash / tool-pwsh 的**生效** disabled 值。
// ⚠️ shell 项必须**两处都读**：
//   (a) **host 层**：profiles/web/cordis.yml 顶层 `tool-bash` / `tool-pwsh` 的**生效** disabled
//       （本机：tool-bash false / tool-pwsh true）
//   (b) **preset 自己的行**：本 preset 的 plugins[] 里也有 tool-bash / tool-pwsh，其 disabled 是
//       `!!js process.platform === 'win32'` / `!== 'win32'` ⇒ **profile / home patch 够不到
//       preset 的 plugins[]**（装配产物里这两行保留**未求值**的 `!!js`）⇒ 必须由生成器按它自己
//       渲染的平台求值。
//   ⇒ 只读 host 层会**漏掉 pwsh**（它在 Windows 下由 preset 自己的行启用）。
export function shellNamesFor(platform, hostRows) {
  const on = (row) => row.disabled !== true
  // (a) host 层：生效值已在装配产物里（true / false 字面量）。
  //     ⚠️ 取不到 ⇒ 停（照 PLAN_MODE_SECTION 的口径）。读到的两个值连同来源行号写进证据。
  if (hostRows?.bash === undefined || hostRows?.pwsh === undefined) {
    throw new Error('shellNamesFor: hostRows 缺 tool-bash/tool-pwsh 的生效值 ⇒ 停（不要猜）')
  }
  const enabled = new Set()
  if (on(hostRows.bash)) enabled.add('bash')
  if (on(hostRows.pwsh)) enabled.add('pwsh')
  // (b) preset 自己的行：按渲染目标平台求值它自己的两条 `!!js` 表达式
  enabled.add(platform === 'win32' ? 'pwsh' : 'bash')
  return [...enabled].sort()
}

import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

/**
 * 从**任意装配产物文本**（历史 dump 文件 或 `dsh --profile <p> --dump-config` 的 stdout）里
 * 读顶层 `tool-bash` / `tool-pwsh` 两行的**生效** disabled 值。
 * 取不到 ⇒ **抛错**（照 PLAN_MODE_SECTION 的口径：宁可 loud 停，不要静默用一个猜的值）。
 * ⚠️ F7：读 **web** profile 的装配面（desktop 的 `cordis.yml` 是空 root ⇒ 不能当来源）。
 */
export function parseHostShellRows(text, label = '<text>') {
  const lines = text.split('\n')
  const pick = (id) => {
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i] === `- id: ${id}`) {
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
          const m = /^  disabled: (.+)$/.exec(lines[j])
          if (m !== null) return { disabled: m[1].trim() === 'true', line: j + 1 }
          if (/^- id: /.test(lines[j])) break   // 下一个顶层 row ⇒ 该行没有 disabled ⇒ 视为启用
        }
        return { disabled: false, line: i + 1 }
      }
    }
    return undefined
  }
  const bash = pick('tool-bash')
  const pwsh = pick('tool-pwsh')
  if (bash === undefined || pwsh === undefined) {
    throw new Error(
      `readHostShellRowsFromAssembled: 在 ${label} 顶层找不到 tool-bash/tool-pwsh —— ` +
        `装配产物路径变了或该 profile 未装配 ⇒ 停（不要猜值）`,
    )
  }
  return { bash, pwsh }
}

/** 读一个装配产物**文件**（历史 dump）。取不到 / 缺行 ⇒ 抛错。 */
export function readHostShellRowsFromAssembled(assembled) {
  return parseHostShellRows(readFileSync(assembled, 'utf8'), assembled)
}

// ── shell 生效值的**来源链**（协调者裁决 1 修订版）──────────────────────────────
// ⚠️ 为什么改：`profiles/*/cordis.yml` 是**派生件** —— 启动时被重置为 4 行 / 223 B 空 root，
//    **组装结果不回写它**（`Include.write()` 不写它；R-1 演练实测）。
//    ⇒ 它**不是**合法来源；T02 冻结的真实装配产物才是。
// 顺序（每一步都 loud 标记，不静默）：
//   ① 首选 `$A/profile-web/cordis.yml` = T02 冻结的真实装配产物（1904 行），确定性、无宿主依赖。
//   ② 交叉核对 `dsh --profile web --dump-config`（只读组装、无需宿主运行）——由**生成器**执行并打印
//      （生成器才有输出通道；本模块 import 时**不**起子进程，避免 T08/T10/T24 的 import 被拖慢）。
//   ③ 来源①缺失 ⇒ 单独用 live dump（下方 `readShellRowsFromDumpConfig()`）。
//   ④ 两者都不可得 ⇒ **loud 停**（抛错 ⇒ 进程非 0 退出），**不得**编造 / 不得用默认值兜底。
// ── T06（C2）参数化：以下取值槽一律「环境变量 → 推导 → 硬编码兜底 + 告警」 ──────
// ⚠️ 硬编码兜底字面量**故意保留**：T04 的 scan-abs-paths.sh 会命中它们，**这是预期**
//    （T06 的 PASS 条件是「能用参数覆盖」，不是「字面量消失」）。字面量的删除归 T13。
// ⚠️ 告警**不在 import 期打印**（本模块被 T08/T09/T24 import，import 必须无副作用）；
//    收集进 PARAMETERIZATION_WARNINGS，由生成器 CLI 在 main() 里打印。
const envTrim = (v) => (typeof v === 'string' ? v.trim() : '')

/** 告警收集（不产生 import 副作用） */
export const PARAMETERIZATION_WARNINGS = []

/** 冻结装配件路径。**默认值是空串** —— T05 实测该文件今天**不存在**
 *  （`~/.dsh/archive` 整个目录都没有），写死一条已失效的本机路径只会让人误以为来源还在。
 *  需要时用 `DSH_FROZEN_ASSEMBLED` 注入。 */
export const FROZEN_ASSEMBLED = envTrim(process.env.DSH_FROZEN_ASSEMBLED)

/** `DSH_HOME`：环境变量优先；否则按 `~/.dsh` 推导。**无它 ⇒ 派生件来源取不到**（不是硬编码兜底）。 */
export const DSH_HOME_DIR = envTrim(process.env.DSH_HOME)
  || (() => {
    try { return join(homedir(), '.dsh') } catch { return '' }
  })()

/** 派生装配件路径。`DSH_SHELL_ROWS` 覆盖；否则从 `DSH_HOME` 推导 `<DSH_HOME>/profiles/web/cordis.yml`。
 *  ⚠️ T13：硬编码的本机字面量**已删除** —— 取不到就是取不到（空串 ⇒ 该项不进来源链），
 *  **不许**用默认值兜底（§2.2 G5 子决定）。 */
export const DERIVED_ASSEMBLED = envTrim(process.env.DSH_SHELL_ROWS)
  || (DSH_HOME_DIR
    ? join(DSH_HOME_DIR, 'profiles', 'web', 'cordis.yml')
    : (PARAMETERIZATION_WARNINGS.push(
      'DSH_SHELL_ROWS 与 DSH_HOME 都未设置 ⇒ 派生装配件来源取不到（该项不进来源链；无默认值兜底）'), ''))

/** 来源链：任一项取不到即**不进链**；两项都缺时链为空 ⇒ 直接落到 dump-config 或 loud 停。 */
export const SHELL_SOURCE_CHAIN = [FROZEN_ASSEMBLED, DERIVED_ASSEMBLED].filter(Boolean)

/** `DSH_BIN`：`DSH_BIN` 环境变量 → 从 `PATH` 上的 `dsh` 反解真实入口。
 *  ⚠️ T13：**取不到时返回 `null`，绝不返回硬编码兜底字面量，也绝不抛错。**
 *  抛错会发生在**模块顶层**（本模块 import 时就会 `resolveShellSource()`）⇒ 整个脚本 import 即死，
 *  连「DSH 不可用时仍能渲染」的正控都会挂。真正的 loud 停放在
 *  `readShellRowsFromDumpConfig()` 里 —— 只有**真的要 spawn DSH** 时才停（§2.2 G5）。 */
export function resolveDshBin() {
  const env = envTrim(process.env.DSH_BIN)
  if (env) return env
  const sep = process.platform === 'win32' ? ';' : ':'
  const candidates = []
  for (const rawDir of (process.env.PATH ?? '').split(sep)) {
    const dir = rawDir.trim().replace(/[\\/]+$/, '')
    if (!dir) continue
    // npm 全局布局有两条：shim 与真实入口同在 <prefix> 下（本机实测命中），
    //   或 shim 在 <prefix>/bin 下、真实入口在 <prefix>/lib/node_modules 下（标准布局）。
    candidates.push(
      join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
      join(dir, '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    )
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  PARAMETERIZATION_WARNINGS.push(
    'DSH_BIN 未设置且 PATH 上找不到 dsh ⇒ DSH_BIN 未解析（crosscheck 将不可用但**不致命**；需要 dump-config 时才 loud 停）')
  return null
}

export const DSH_BIN = resolveDshBin()

/** `dsh --profile web --dump-config`（只读组装；副作用仅重置派生文件 cordis.yml）。 */
export function readShellRowsFromDumpConfig(profile = 'web') {
  // ⚠️ T13：DSH_BIN 取不到 ⇒ 在**这里**（唯一真正要 spawn 的地方）loud 停，而不是在模块顶层。
  if (DSH_BIN === null) {
    throw new Error('DSH_BIN 未解析（既没给 DSH_BIN 环境变量，PATH 上也找不到 dsh）⇒ dump-config 不可用')
  }
  const r = spawnSync(process.execPath, [DSH_BIN, '--profile', profile, '--dump-config'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error !== undefined && r.error !== null) throw new Error(`dump-config 启动失败：${r.error.message}`)
  if (r.status !== 0) throw new Error(`dump-config exit=${r.status}：${(r.stderr ?? '').trim().split('\n')[0]}`)
  const text = r.stdout ?? ''
  return { rows: parseHostShellRows(text, 'dump-config(web)'), md5: md5(text), normalizedDigest: normalizedSourceDigest(text) }
}

export function md5(text) {
  return createHash('md5').update(text).digest('hex')
}

/** T07（C1）来源文本的**规范化摘要**。
 *  动机：原始 md5 会随本机绝对路径漂移（同一份装配产物换台机器就变）⇒ 不能当跨机器指纹，
 *  更**不能进产物**（产物一旦写死本机路径就等于把发布面钉死在某台机器上）。
 *  做法：先把绝对路径片段与 file:// URL 替换成占位符**再**算 md5，并截断到 12 位。
 *  12 位不是为了防碰撞，而是为了**保证它不会被误认成一条 32 位裸 md5**（T07 判据明令禁止）。 */
export function normalizedSourceDigest(text) {
  const normalized = String(text)
    .replace(/[A-Za-z]:[\\/][^\s'"<>|]*/g, '<abs-path>')
    .replace(/file:\/\/\/[^\s'"<>|]*/gi, '<file-url>')
  return md5(normalized).slice(0, 12)
}

function resolveShellSource() {
  const tried = []
  for (const path of SHELL_SOURCE_CHAIN) {
    // ⚠️ T06：kind 按**路径身份**判定，不再按数组下标 —— 否则 `FROZEN_ASSEMBLED` 缺省为空时，
    //    链里唯一的 `DERIVED_ASSEMBLED` 会因为落在 index 0 而被误标成 'frozen'。
    const kind = path === DERIVED_ASSEMBLED ? 'derived' : 'frozen'
    // fallback 按「是不是链首」判定：链首 = 配置上的首选来源。
    const fallback = path === SHELL_SOURCE_CHAIN[0] ? 'no' : 'yes'
    if (!existsSync(path)) { tried.push(`${path}：不存在`); continue }
    try {
      const text = readFileSync(path, 'utf8')
      return {
        rows: parseHostShellRows(text, path),
        source: path,
        kind,
        fallback,
        md5: md5(text),
        normalizedDigest: normalizedSourceDigest(text),
        tried,
      }
    } catch (e) { tried.push(`${path}：${e.message}`) }
  }
  // ③ 前两步都不可得 ⇒ 单独用 live dump
  try {
    const live = readShellRowsFromDumpConfig('web')
    return { rows: live.rows, source: 'dump-config', kind: 'dump-config', fallback: 'yes', md5: live.md5, normalizedDigest: live.normalizedDigest, tried }
  } catch (e) { tried.push(`dump-config：${e.message}`) }
  // ④ 全部失败 ⇒ loud 停（非 0 退出）
  throw new Error(
    'shell 来源链全部失败 ⇒ 停（不得编造、不得用默认值兜底）：\n  ' + tried.join('\n  '),
  )
}

const SHELL_RESOLVED = resolveShellSource()

// 导出供 T08 的证据要求使用（HOST_SHELL_ROWS.bash.line / .pwsh.line）。
// 本机实测（frozen dump）：tool-bash disabled=false（:211）/ tool-pwsh disabled=true（:214）
export const HOST_SHELL_ROWS = SHELL_RESOLVED.rows

// 来源指纹（生成器必须把它打进 stdout 与产物头部 ⇒ 消除静默漂移）
export const SHELL_SOURCE = {
  source: SHELL_RESOLVED.source,
  kind: SHELL_RESOLVED.kind,
  fallback: SHELL_RESOLVED.fallback,   // 'no' = 用了首选（frozen）；'yes' = 回退了
  md5: SHELL_RESOLVED.md5,
  // T07（C1）：产物**只**用 normalizedDigest；`md5` 与 `source` 仅供 stdout 诊断，不进产物。
  normalizedDigest: SHELL_RESOLVED.normalizedDigest,
  bash: `${HOST_SHELL_ROWS.bash.disabled} @${HOST_SHELL_ROWS.bash.line}`,
  pwsh: `${HOST_SHELL_ROWS.pwsh.disabled} @${HOST_SHELL_ROWS.pwsh.line}`,
  tried: SHELL_RESOLVED.tried,
}

export const PLATFORM_SHELL = shellNamesFor(process.platform, HOST_SHELL_ROWS)
// 本机实测 = ['bash','pwsh'] ⇒ 参考清单共 30 个名字（28 平台无关 + bash[host] + pwsh[preset]）

// ── 合法工具名**参考清单**（REFERENCE list）—— ⛔ **不是门** ────────────────────
// 它**不再**用于生成期断言。理由（三条）：
//   ① 前提做不到：MCP 工具由部署层 dsh-mcp-loader 动态全局注册（随用户配置漂移）
//      ⇒ 不存在可穷举的静态闭集
//   ② 收益已证伪：deny 写错名**不是 mount 失败**，而是 child 首次 setup 抛
//      `names unknown global tool`（dsh-tools/lib/index.js:2895-2908 ← dsh-subagent/lib/index.js:522
//       ← setup 回调 :1065-1074）—— 炸得 loud，可接受
//   ③ 成本是负的：它**主动阻止补齐真实安全边界**（把 mcp_* 写进 deny 会被判越界 exit 2）
// **保留它的唯一用途**：人读 + 产物自检（「本 preset 声明的 row 确实产出了这些名字」）。
// **禁止**用它拦 deny/allow 名单 —— 那正是被删掉的假门。兜底 = 「首次派发时 loud 失败」。
export const LEGAL_TOOL_NAMES = new Set([
  // tool-fs
  'read', 'write', 'edit', 'read_image',
  // tool-fs-search
  'grep', 'glob',
  // tool-jobs
  'job_list', 'job_output', 'job_kill',
  // tool-skill
  'skill',
  // tool-ask-user
  'ask_user_question',
  // tool-todo
  'todo_write',
  // tool-web
  'web_fetch', 'web_search',
  // plan-mode
  'exit_plan_mode',
  // delegation 组：控制面 3 名（它们由本 preset 自己挂载 ⇒ 必然在 restrictableNames 内）
  //   dsh-tool-subagent-control/lib/index.js:23  -> send_message
  //   dsh-tool-subagent-control/lib/index.js:62  -> interrupt_agent
  //   dsh-tool-subagent-control/lib/types/list-agents.js:45 -> list_agents
  'send_message', 'interrupt_agent', 'list_agents',
  // lane-composition（T16 自写绑定器，只注册进 Lead own scope）的 3 个 lane 寻址名：
  //   对 lane 而言它们**继承自** Lead 的层 ⇒ 在 restrictableNames 内 ⇒ 所以 3 份 deny 都列上（见上）
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  // delegation 组：fork + 9 个具名 lane
  'subagent_fork',
  'subagent_scout', 'subagent_archivist', 'subagent_seer', 'subagent_reader',
  'subagent_analyst', 'subagent_auditor', 'subagent_wright', 'subagent_forge', 'subagent_planner',
  // ⚠️ tool-bash / tool-pwsh 按两处派生（不写成静态两个名字）—— 见 PLATFORM_SHELL
  ...PLATFORM_SHELL,
])

// plan-mode 的 section 文本：从 standard.patch.yml 取（`|` 字面块标量）。
// ⚠️ **取法只有一处权威定义**：T07「必须做的对照工作」里的「缩进判定 awk + 非空门」。
//    本文件**不复述**该命令。实测真值 = **6 行**（段落行）；
//    块 = standard.patch.yml `:51` 的 `section: |` + `:52-62`（6 非空 + 5 空行）。
//    不得凭记忆、不得从 cordis.yml 的 `>` 折叠版重建；取不到就停。
export const PLAN_MODE_SECTION = ''   // ← **有意的实现期取值槽**：由 T07 的契约在渲染时填入
                                      //    「从 `standard.patch.yml:51-62` 取出的 6 行原文」（取法见 T08 步骤 2f 的
                                      //    缩进判定 awk + 非空门；**取不到就 loud 停**，不猜）。⚠️ 它**不是**遗留占位符：
                                      //    §5.2 所说的「占位符清零」指**业务占位符**（`<newPersonasDir>` 之类），
                                      //    本常量属于**有意的取值槽**（见 §5.2 第 2 项的限定说明）。

// ── 9 个 lane（顺序与 toolName 见 DESIGN.md §3.3.3；toolFilter 见 §3.3.4 的最终名单）──
// ⚠️ DESIGN.md §3.3.3 的「共同约定」：全部 lane 固定 `provider: 'spawn'` +
//    `backgroundMode: 'continuable'`（与旧 bundle 一致）。这两项**不在** T06 契约块的 LANES
//    条目里（契约只给 tool / persona / maxDepth / deny|allow）⇒ 由 T07 渲染时按 LANE_COMMON 补齐。
export const LANE_COMMON = { provider: 'spawn', backgroundMode: 'continuable' }

export const LANES = [
  { tool: 'subagent_scout',     persona: 'scout.md',     maxDepth: 1, deny: READONLY_DENY },
  { tool: 'subagent_archivist', persona: 'archivist.md', maxDepth: 1, deny: READONLY_DENY },
  { tool: 'subagent_seer',      persona: 'seer.md',      maxDepth: 1, deny: READONLY_DENY },
  { tool: 'subagent_reader',    persona: 'reader.md',    maxDepth: 1, allow: ['read', 'read_image'] },
  { tool: 'subagent_analyst',   persona: 'analyst.md',   maxDepth: 1, deny: READONLY_DENY },
  { tool: 'subagent_auditor',   persona: 'auditor.md',   maxDepth: 1, deny: READONLY_DENY },
  { tool: 'subagent_wright',    persona: 'wright.md',    maxDepth: 1, deny: WRIGHT_DENY },
  { tool: 'subagent_forge',     persona: 'forge.md',     maxDepth: 1, deny: FORGE_DENY },
  { tool: 'subagent_planner',   persona: 'planner.md',   maxDepth: 1, deny: READONLY_DENY },
]

// ── 14 个顶层 row（12 个保留行的配置值与 preset-standard 逐字一致 + 2 个新增挂载行）──────────────────────────
// ⚠️ 权威骨架 standard.patch.yml **自身带** 6 个 row（command-goal / tool-goal / workflow-ptc /
//    tool-workflow / tool-ralph / present）⇒ 本 preset **不得**含这 6 个（DESIGN.md §2.3「删除项」）。
//    ⚠️ **第 2 个新增挂载行 = `lane-composition`（T16，2026-09-25）**：它注册 Lead own-scope 的 3 个
//    lane 寻址工具（`subagent_children` / `subagent_send` / `subagent_interrupt`），形态照 `routing-sections`。
export const topRows = [
  { id: 'persona',            name: bundlePkg + '/plan-aware-persona.mjs', config: { suffix: 'Your working directory is {{cwd}}.' } },
  { id: 'routing-sections',   name: bundlePkg + '/routing-sections.mjs' },
  { id: 'lane-composition',   name: bundlePkg + '/lane-composition.mjs' },
  { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
  { id: 'tool-bash',          name: '@deepseek-ai/dsh-tool-bash',          disabled: "process.platform === 'win32'" },
  { id: 'tool-pwsh',          name: '@deepseek-ai/dsh-tool-pwsh',          disabled: "process.platform !== 'win32'" },
  { id: 'tool-fs',            name: '@deepseek-ai/dsh-tool-fs' },
  { id: 'tool-fs-search',     name: '@deepseek-ai/dsh-tool-fs-search',     config: { sampleOverCapGlobResults: false } },
  { id: 'tool-jobs',          name: '@deepseek-ai/dsh-tool-jobs' },
  { id: 'skill-filesystem',   name: '@deepseek-ai/dsh-skill-filesystem' },
  { id: 'tool-skill',         name: '@deepseek-ai/dsh-tool-skill' },
  { id: 'tool-ask-user',      name: '@deepseek-ai/dsh-tool-ask-user' },
  { id: 'tool-todo',          name: '@deepseek-ai/dsh-tool-todo',          config: { allowParallelInProgress: true } },
  { id: 'tool-web',           name: '@deepseek-ai/dsh-tool-web',           config: { fetch: true, searchTimeoutMs: 60000 } },
]

// ── 3 个 group ───────────────────────────────────────────────────────────────
export const groups = [
  { id: 'planning',   isolate: { planMode: true }, rows: [
      // ⚠️ section 文本必须从 dsh-web-app/presets/standard.patch.yml 的 plan-mode.config.section 取
      //    （那里是 `|` 字面块标量；cordis.yml 的 `>` 折叠版会把多行粘成一行，不可用）
      { id: 'plan-mode', name: '@deepseek-ai/dsh-plan-mode', config: { section: PLAN_MODE_SECTION } } ] },
  { id: 'compaction', isolate: { compaction: true, toolResultPruner: true }, rows: [
      { id: 'compaction-basic',   name: '@deepseek-ai/dsh-compaction-basic' },
      { id: 'command-compact',    name: '@deepseek-ai/dsh-command-compact' },
      { id: 'tool-result-pruner', name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
        config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } } ] },
  // ⚠️ delegation 组**无 isolate**（D21 = 删；workflow 两行已删 ⇒ 组内不再有 provide service 的 row）
  { id: 'delegation', rows: [
      { id: 'tool-subagent-control',    name: '@deepseek-ai/dsh-tool-subagent-control' },
      { id: 'tool-subagent-list-agents',name: '@deepseek-ai/dsh-tool-subagent-control/list-agents' },
      { id: 'tool-subagent-fork',       name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'fork', toolName: 'subagent_fork', backgroundMode: 'continuable' } },
      ...LANES ] } ]
