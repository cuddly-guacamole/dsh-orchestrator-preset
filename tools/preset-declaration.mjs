// ============================================================================
// preset-declaration.mjs — 新 preset 的 31 个 row 的唯一来源（声明清单）
// ============================================================================
//
// 定位：把「31 个 row」从散文描述变成机器可读的单一来源，让 cordis.patch.yml 可再生成
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
//    ⇒ 本文件把**被引用者前置**（MCP_CLOSURE_EXPR / 三份 deny / PLATFORM_SHELL / PLAN_MODE_SECTION /
//    LANES），再声明 topRows / groups。**所有值逐字照抄契约块，只调整声明次序。**
//
// ⛔ LEGAL_TOOL_NAMES 是**参考清单（REFERENCE list）**，**⛔ 不是门**：
//    禁止在生成器里用它断言 / 拦截 deny / allow 名单（「生成期闭集断言」机制已按用户裁决删除，
//    见 DESIGN.md §3.3.4 的 ⛔ 段）。它只供人读 + 产物自检。新的兜底 = 「首次派发时 loud 失败」。

// 16 个顶层 row（14 个保留行的配置值与 preset-standard 逐字一致 + 2 个新增挂载行；口径见 topRows 处）
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
// 为什么前缀必须随预设发布：预设的常驻路由表按 `aegis-*` 点名二十二个技能，而上游
// aegis 包按**裸名**注册（brainstorming、goal-framing…），因为它不绑定宿主。
// 没有这一步，整张路由表会指向二十二个不存在的名字。详见 extensions/dsh/aegis-prefix.js。
// 它**只做命名空间，不碰描述** —— 描述语言是读者偏好，不是路由需求。
// ⛔ 关闭 `prefixAegisSkills` 必须同时改写路由表，两者不能分开。
export const prefixRowId = 'orch-aegis-prefix'
export const prefixEntry = `${bundlePkg}/extensions/dsh/aegis-prefix.js`
export const prefixAegisSkills = true
// 描述汉化：**默认关**。它是读者偏好而不是路由需求，不该强加给每个装这个预设的人。
// 谁想要，在自己的层里覆盖这一行（home 层 `$DSH_HOME/cordis.patch.yml` 在本层之后应用）。
export const describeAegisSkillsInZh = false

// description：默认文本（计划 T06 给定；约束：不得含被排除的上游项目文本（DESIGN.md §12.4/§12.5），不得含用户路径）
export const description = 'A thin orchestration preset: aegis method pack for methodology, self-authored lane boundaries for delegation. Declares its full plugins[] because DSH presets have no inheritance.'

// ── MCP loader 名：**按机器算**，不再静态写死（修「预设在新机器上不可用」的洞）──
// loader 名 = `mcp_<server>`（默认命名，dsh-mcp-loader/src/index.ts:74）；用户在 web profile 里
//   配了 4 个 server（playwright / jlceda / cloudflare-browser / desktop-touch）⇒ 4 个 loader 工具。
//
// 【能不能挡？能。源码依据】dsh-tools/lib/index.js:2895-2910 的 restrict() 把 deny 名校验
//   against `view(scope).restrictableNames`（= **继承来的**名字集合，含 global 层），而 loader
//   工具是**全局注册**的 ⇒ 在 restrictableNames 内 ⇒ deny 生效。
// 【loader 自己的 hiddenTools **挡不住** loader 名】:117 `deny.delete(loaderName)` +
//   :169-171 直接抛错（"rename the loader or drop the rule"）⇒ loader 名被结构性保护。
//   ⇒ 只有 preset 的 toolFilter 能挡它。
// ⚠️ **必须全部 10 个 agent 都 deny（不只只读 lane）** —— forge 若成为 holder，它派出的
//    只读孙代会经 ancestryIds 继承该 server 的真实工具名，与只读边界直接冲突。
// ⚠️ **orchestrator 无法被本 preset 收窄**（toolFilter 只是 `tool-subagent` row 的 config 字段，
//    orchestrator 由 preset registry 创建 ⇒ 无该机制）⇒ 记为**已知残余风险，不假装解决**。
//
// ⛔ **为什么不能把这 4 个名字写死**：同一个 restrict() 对**未知名字直接抛错**
//   （`tools.restrict() names unknown global tool "mcp_playwright"`）⇒ 名单一旦写死，
//   在**没有配那条 server 的机器上**（新机器必然如此）lane 的工具过滤创建即失败 ⇒ 该 lane 不可用
//   ⇒ 整个预设在新机器上不可用。而这 4 个名字正是 dsh-mcp-loader 为**用户自己配置的** server 生成的。
//
// 【修法 = 求值时从**已组装的 loader 树**里算】实测（`!!js` 求值上下文，见 `.dsh/evidence/` 的实验）：
//   - `baseUrl` / `process`（含 `process.getBuiltinModule`）可用 ⇒ 任意文件读取也可用；
//   - `ctx.loader` **可达**（`ctx.get('loader')` 亦可）⇒ `loader.entries()` 里能看到**整棵**已组装
//     的 entry 列表，**含本行之后的行**（实测：即使 mcp-loader 行排在本行之后也能读到）⇒ 与顺序无关；
//   - 但**工具注册表当时还看不到 mcp_* 名**：`ctx.get('tools')` → undefined、`ctx.reflect.get('tools')`
//     严格模式 → undefined、非严格模式下 `restrictableNames` 里也还没有 mcp_* —— loader 是在
//     dsh-mcp-loader 的 apply 里注册的（src/index.ts:1038），晚于本行的 config 求值。
//   ⇒ 只能按**配置**算（而不是按当时已注册的名字算）。这就是 MCP_CLOSURE_EXPR 存在的原因。
export const MCP_CLOSURE_EXPR = "(() => { const out = []; const l = ctx.loader || ctx.get('loader'); if (!l) return out; let rows = []; try { rows = Array.from(l.entries()) } catch (e) { return out } for (const r of rows) { let off = false; try { off = r.disabled === true } catch (e) { off = true } if (off) continue; const o = r.options || {}; if (!/mcp[-_]loader/i.test(String(o.id) + ' ' + String(o.name))) continue; const servers = (o.config && o.config.servers) || {}; for (const s of Object.keys(servers)) { const c = servers[s] || {}; if (c.mode === 'eager') continue; if (c.loaderName) { out.push(String(c.loaderName)); continue } if (!/^[A-Za-z0-9_-]{1,32}$/.test(s)) continue; out.push('mcp_' + s) } } return Array.from(new Set(out)).sort() })()"
// 取值口径（逐条都能在被测源码上核对）：
//   · 只认 **mcp-loader** 行（id/name 匹配 /mcp[-_]loader/i）—— 官方 `dsh-mcp-client` 注册的是
//     `mcp__<server>__<tool>`，**没有** `mcp_<server>` 这种 loader ⇒ 把它算进来会得到不存在的名字。
//   · `mode: 'eager'` 的 server **排除**：eager 的 loader 会被 probe 后 dispose（src/index.ts:1008-1025）
//     ⇒ 届时该名字不存在 ⇒ deny 会炸。
//   · `loaderName` 覆盖优先；server 名不合 `^[A-Za-z0-9_-]{1,32}$`（mcp-loader 自己会在 mount 时
//     拒绝这种配置，src/connection.ts:248）且未给 loaderName ⇒ 跳过。
//   · `entry.disabled` 为真 ⇒ 跳过（禁用的行不会注册 loader）。
//
// ⚠️ **已知残余（未消除，写在这里而不是留给下一个人发现）**：`mode: 'auto'`（默认）+ 
//   `singleToolThreshold >= 1`（默认 1）+ 该 server 实际工具数 ≤ 阈值 ⇒ mcp-loader 会 **eager 注册并
//   dispose 掉 loader**（src/index.ts:1008-1025）⇒ 上面算出来的名字届时**不存在** ⇒ 该 lane 首次派发
//   仍会 loud 失败（restrict 抛 unknown）。本机不受影响（profile patch 设了 `singleToolThreshold: 0`，
//   该设置下 auto 永不 eager）。要**彻底**消除只能靠运行时机制（对 child 施加 guard / 在 agent 创建时
//   按当时注册表 restrict）——那需要新增插件文件，不在本单的面内；见证据文件的「Limits」。
// ⚠️ **漂移提醒（改口径了）**：新增 MCP server **不再**需要同步任何名单（闭包按机器算）。
//   但 dsh-mcp-loader 的**默认命名规则**（src/index.ts:74）或 **eager 判定**（src/index.ts:1008-1025、
//   1038）若变了，必须改 MCP_CLOSURE_EXPR —— 它就是这两个事实的镜像。

// ── `schedule_*`：**静态** deny（2026-10-10 裁决；版本条件已在 T1 退休）────────────
// 2026-10-10 用户裁决：**放开 tool-schedule，但只给 Lead，9 个 lane 全部 deny**
// （「选项1，只给主代理，不给子agent」）。
//
// 🔻 **退休记录**：本段原先是一套「按版本求值」的条件闭包，现已整体删除。它的退休触发条件
//    写在原段第 ⑤ 条，两条判据**都**已满足 ——
//      ① README「Host version gate」的表不再含 `0.2.0-rc.2`（支持集只剩 `0.2.1-rc.2`）；
//      ② `package.json` 的 `peerDependencies` 已钉到 `0.2.1-rc.2`（下界越过 `0.2.0-rc.2`）。
//    被删掉的四件：`SCHEDULE_TOOLS` / `SCHEDULE_RESOLVE` / `SCHEDULE_ABSENT_EXPR` /
//    `SCHEDULE_DENY_EXPR` —— 连同「解析得到就 deny、解析不到就交空数组」的按机器求值。
//    **替换物**：那四个名字移进三份静态 deny 名单（`READONLY_DENY` / `WRIGHT_DENY` /
//    `FORGE_DENY`），`tool-schedule` 行不再带 `disabled`（裸一行，与官方骨架同形）。
//
// 为什么静态是对的（而不是「退回到一个更弱的写法」）：唯一受支持的宿主 `0.2.1-rc.2`
//   **自己依赖** `@deepseek-ai/dsh-tool-schedule`（`dsh@0.2.1-rc.2` 的 dependencies 里有它，
//   实测可解析）⇒ 这四个名字在**每一台**受支持的机器上都存在 ⇒ 静态名单正是表达
//   「每台机器都有」的地方；条件求值反而多一层会漂移的机器相关性。
// ⚠️ `lane-tool-gate` 的 deny 名单同样含这四个名字（见 `laneGateDeny`）：在 rc.2 上**真正**
//   拦住 lane 的是那个 gate，静态名单是裁决的记录 —— 两者不得只做一半。

// ── 宿主形态探针：这个宿主的 `tool-subagent` 还在旧契约上吗 ────────────────────
// ⚠️ **先读名字再读语义**：本常量叫 `LANE_FORM_SUPPORTED_EXPR`，但它为 **true 的含义是
//    「宿主是旧形态」= 本包**不支持**它**。支持集现在恰好只有 `0.2.1-rc.2` 一个版本
//    （`package.json` 的四个 peer 都钉死，README 的表只剩那一行），所以这条探针的职责
//    已经从「挑一种形态」缩成**一个开关**：**true ⇒ 每一条 lane 行与每一条 preset 行都
//    `disabled`**，即在这台不受支持的宿主上本 bundle **什么都不挂**；false ⇒ 正常挂载。
//    极性**没有**反转，也不得反转 —— 它仍然直接取自「`persona` 还在不在 Config 里」这个事实。
//
// 🔻 **背景（宿主 0.2.1-alpha.3 实测，2026-10-14）**：alpha.3 把 `persona` 与 `toolFilter`
//    **一起**从 `dsh-tool-subagent` 的 Config 里删掉，并在 `apply()` 里对这两个键**硬抛**：
//      `lib/index.js:355`
//      ```js
//      for (const field of ["persona", "toolFilter"])
//        if (Object.hasOwn(config, field)) throw new Error(`tool-subagent: ${field} is no longer supported; configure persona and tool plugins in an Agent Preset and select it with agentPreset (spawn only)`);
//      ```
//    ⇒ 旧形态的 9 条 lane 行**每条都同时带这两个键** ⇒ 在 alpha.3 及以后挂载期**全部不激活**
//      （`dsh --profile headless --patch <旧形态>` 实测：`warning: 1 entry did not activate` +
//       逐字同上的错误；会话仍能起，但 9 条 lane 全废）。
//    ⇒ 这就是「true 的宿主上必须整族关闭」而不是「换一种写法」的原因：那种宿主上**没有任何**
//      一种写法能让 lane 行挂上去（旧写法被 apply() 硬拒，新写法缺 `agentPresets` 服务）。
//
// ── 判据的选取（三个候选，实测淘汰两个；详见该轮证据档第十节）────────────────────
//   ① ❌ **读 `Config` 的键表**（schema 是否“声明”了 persona）：**测不出来**。
//      schemastery 对未知键**不抛**（`Config({provider, toolName, persona})` 实测**原样通过**），
//      拒绝发生在 `apply()` 而非 schema ⇒ schema 探针永远返回「支持」。
//      ⚠️ 这与本包 alpha.2 那次 `backgroundMode` 的「静默死键」是**同一条教训**，别再踩。
//   ② ⚠️ **源码文本匹配**那句 throw：能用，但脆（上游重排/改措辞即失效）。
//   ③ ✅ **读 `Config = z.object({…})` 的字段字面量**（本判据）：结构性事实，非文本猜测。
//      双向实测：alpha.2 的 `persona: true / toolFilter: true`；alpha.3 的 `false / false`；
//      受支持的 rc.2 上 `Config` 字面量含 `agentPreset` / `allowedAgentPresets`，**不含** `persona:`
//      ⇒ 探针读 false ⇒ 9 条 lane 行与 9 条 preset 行正常挂载。
//
// ⚠️ **失败方向**：解析不到 / 读不到文件 ⇒ 返回 `true`（**当作旧形态** ⇒ 整族关闭）。
//    理由：读不到文件时**不能**假装宿主受支持 —— 那会让 lane 行在一个未知宿主上带着
//    `agentPreset` 硬挂，失败方式随宿主而异（缺服务就 throw，多一个键就静默）。整族关闭
//    的失败是**响亮**且一致的（没有 lane 可用），而「按错形态挂上去」的失败是**安静**的。
//    两害相权取其响。
// ⚠️ **解析用裸包名**（`resolve('@deepseek-ai/dsh-tool-subagent')` ⇒ 该包的 `main` = `lib/index.js`）。
//    不要写成 `…/lib/index.js` 子路径：该包的 `exports` 只导出 `"."` / `./package.json` /
//    `./model-selection-settings` 等，**没有** `./lib/index.js` ⇒ 子路径解析恒抛
//    `ERR_PACKAGE_PATH_NOT_EXPORTED`，于是本判据**永远**返回 true（= 在受支持的宿主上也判错，
//    而且判错的方向是「整族关闭」，静默地少掉 9 个 lane）。
// ── 受支持宿主的**版本**（单一来源）──────────────────────────────────────────────
// 支持集恰好是这一个版本。它同时出现在三处，必须同值：
//   · 本常量（宿主门的判据）
//   · README「Host version gate」那张只剩一行的表（T3 的文件）
//   · `install.sh` 的 MIN_HOST_VERSION（安装下限）
// ⚠️ 为什么门要按**版本**判而不是按 Config 形状判（第 24 轮更正，seer 提出）：
//    旧判据读 `Config` 字面量里有没有 `persona:`。那个事实在 0.2.0-rc.2 / alpha.1 /
//    alpha.2 上是 true、在 alpha.3 及以后是 false ⇒ 它只把**老**宿主关掉，而把
//    alpha.3/4/5 **放进来**。可是 alpha.3 与受支持的 0.2.1-rc.2 在结构上**无法区分**：
//    两者的 `Config` 键集相同（`agentPreset` / `allowedAgentPresets`，无 `persona`）、
//    服务需求相同 —— **只有版本字符串能分开它们**。所以判据必须是版本。
export const SUPPORTED_HOST_VERSION = '0.2.1-rc.2'

// ── 宿主门：**这台宿主的 `dsh-tool-subagent` 版本不是受支持的那个吗** ────────────────
// 名字仍然叫 `LANE_FORM_SUPPORTED_EXPR`，而 **true 的含义是「不受支持」**（保持既有极性，
// 三族行——9 条 lane 行 / 9 条 preset 行 / fork 行——都直接取它作 `disabled`，不加 `!`）。
//
// 判据两步，都从 `baseUrl` 出发（与宿主求值 `!!js` 的 ctx 同一手法）。两步的**性质不同**，
// 这一点曾经写错，所以在这里写清楚：
//
//   ① **版本步 —— 严格（strict）**：`createRequire(baseUrl).resolve('@deepseek-ai/dsh-tool-subagent')`
//      拿到入口，从它所在目录**向上最多走 6 层**，找 `name` 等于该包名的 `package.json`，读 `version`。
//      **只要读得到一个版本，且它不是 `SUPPORTED_HOST_VERSION`，就返回 true（禁用）**。
//      这是区分 alpha.3/4/5 与受支持版本的**唯一**事实 —— 三者结构完全相同，只有版本不同。
//   ② **结构步 —— 受支持宿主的回退（fallback）**：版本**读不到**时（walk-up 没找到匹配的
//      `name`+`version`，例如 package.json 里没有 `version` 字段、或 `name` 被改写、或布局深于
//      6 层），才落到旧的 `/persona:/` 判定上：仍在旧契约（声明 `persona:`）⇒ true（禁用）；
//      不是旧契约 ⇒ **false（挂载）**。
//
// ⚠️ **读不到版本时的方向是「挂载」，这是有意的，不是漏掉的 fail-closed。** 依据三条：
//    · 那两种情形**在结构上无法区分** —— 一个 alpha.3+ 宿主与受支持宿主有同样的 `Config` 键集、
//      同样的 `agentPreset`/`allowedAgentPresets`、同样没有 `persona`。读不到版本时，判据里
//      **没有**任何事实能说「这不是受支持的宿主」。
//    · 两个方向的代价**极不对称**：误判成「不支持」⇒ 受支持宿主机上 9 条 lane + 9 条 preset
//      + fork **全部消失**（本 preset 在这个宿主上等于没装）；误判成「支持」⇒ 一个结构兼容的
//      alpha.3+ 宿主挂上了我们的 lane —— 它认得 `agentPreset` 这套机制，组合**是有效的**，
//      只是版本层面的行为可能有差异。**零 lane 比「少拦一档」更糟**。
//    · 失败方向**不是**「一律 true」：只有 `resolve()` 抛错（包根本解析不到）才是 fail-closed
//      返回 true —— 那种情况连入口文件都没有，三族行挂上去必然在挂载期炸。
//
// 🔻 **已知残余（写在这里，而不是留给下一个人发现）**：一个 alpha.3+ 宿主，若它的
//    `package.json` 读不到 `version`，**会被放行**（挂载）。这是上面那条取舍的另一面，接受。
//    要消除它只能靠运行时机制（按注册表判断），那需要新增插件文件，不在本轮面内。
//    ⚠️ 已考虑并**否决**的替代写法：直接 `resolve('@deepseek-ai/dsh-tool-subagent/package.json')`。
//       它比 walk-up 直接，但**该包的 `exports` 一旦不暴露 `./package.json`，这个 resolve 就抛错**
//       ⇒ 按上面的方向规则变成 fail-closed ⇒ 受支持宿主丢光所有 lane。诊断「版本读不到」的代价
//       不该是整族关闭，所以保留 walk-up。
// ⚠️ **plain scalar 边界**（旧表达式踩过，别再踩）：表达式体内**不得**出现
//    `: `（冒号+空格）/ `#` / 反斜杠 / 双引号 / 对象字面量 / 三元 —— 它会被嵌进 YAML 的
//    `!!js` plain scalar，一旦出现这些就把整条表达式切成映射。所以下面只用 `if` / `return`、
//    字符串一律单引号、比较用 `!==`。
export const LANE_FORM_SUPPORTED_EXPR = "(() => { try { "
  + "const fs = process.getBuiltinModule('node:fs'); "
  + "const path = process.getBuiltinModule('node:path'); "
  + "const req = process.getBuiltinModule('node:module').createRequire(baseUrl); "
  + "const entry = req.resolve('@deepseek-ai/dsh-tool-subagent'); "
  + "let dir = path.dirname(entry); "
  + "let version = null; "
  + "for (let i = 0; i < 6; i++) { "
  + "try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); "
  + "if (j.name === '@deepseek-ai/dsh-tool-subagent' && j.version) { version = j.version; break } } catch (e) {} "
  + "const up = path.dirname(dir); if (up === dir) break; dir = up } "
  + "if (version !== null && version !== '" + SUPPORTED_HOST_VERSION + "') return true; "
  // ⚠️ 括号必须配平：`.test(` 自己也要一对。漏掉最外层那个 `)` ⇒ 整条表达式
  //    **语法错误**（`missing ) after argument list`），而它被嵌进 `!!js` 后**不会**在
  //    生成期报错 —— 只会在宿主求值那条 `!!js` 时炸，或在 check 13 的求值测试里炸。
  + "const src = fs.readFileSync(entry, 'utf8'); "
  + "const at = src.indexOf('const Config = z.object({'); "
  + "if (at < 0) return true; "
  + "return /persona:/.test(src.slice(at, src.indexOf('});', at))) "
  + "} catch (e) { return true } })()"

// ⛔ **为什么新形态必须有 `lane-tool-gate`（不挂它 = 静默的权限放大）**：
//    alpha.3 把工具组成搬进 Agent Preset，但 preset 的 `plugins[]` **只能加不能减** ——
//    实测：只挂 persona 的 preset，child 自报拿到 **25** 个工具（含 `edit` / `bash` /
//    `send_message` / `interrupt_agent`）；在 preset 里把 `tool-bash` 标 `disabled: true`
//    之后 `bash` **依然在**。而 `toolFilter` 在新路径上**没有可达通道**：
//    `dsh-subagent/lib/index.js:1452` 的全新派发只带 `composition: { agentPreset }`，
//    `toolFilter` 只在 `:2177` 的**恢复**路径上从持久化 descriptor 读回；
//    `:395` 的 `restrict()` 是**唯一**消费点 ⇒ 全新派发的 child **永远不会**被 `toolFilter` 收窄。
//    ⇒ 若不补 gate，只读 lane（scout/archivist/seer/analyst/auditor/planner）会**拿到写权限**，
//      而这是**安静**地发生 —— 比旧宿主上「9 条不激活」的**响亮**失败危险得多。
//    ⇒ 新形态下工具收窄只由 preset 内的 `lane-tool-gate` 承担（`tools.guard()`，按 agent scope 生效）。
export const laneGatePlugin = bundlePkg + '/lane-tool-gate.mjs'

// fork 控制行的 id —— **唯一来源**。声明侧（`groups` 的 delegation 组）按它认行。
// ⚠️ **生成器不再对它做任何特殊处理**：这一行就是一行普通声明，原样渲染（理由与被接受的
//    退化见 `groups` 里 delegation 组的 🔻 段）。常量仍然保留，因为「fork 控制行是哪一个」
//    这件事在契约测试里还要按 id 认（不得靠推断）。
export const forkControlRowId = 'tool-subagent-fork'

// 只读 lane（**25** 项静态 + 按机器算的 MCP 闭包）
//   —— 控制面 3 名（DESIGN.md §3.3.4 的裁决：只读 lane 不得操纵/杀死他 lane）
//   ⚠️ **+3 项（T16 / lane-composition.mjs）**：`subagent_children` / `subagent_send` / `subagent_interrupt`
//   —— 它们是自写绑定器注册进 **Lead own scope** 的 lane 寻址名；scope 自己的层会被**其下每个 agent 继承**
//   （`dsh-scope:162-171` `chainLayers` + `dsh-tools:2959-2974`）⇒ 不 deny 就会出现在 lane 的工具面里。
//   这 3 名对 lane 是**继承来的** ⇒ 落在 `restrictableNames` 内 ⇒ deny **合法且生效**（不会抛掉整条 filter）。
//   ⚠️ reader 用 `allow: ['read','read_image']` ⇒ 白名单天然不含 `schedule_*`，**不重复列**（列了反而越界，
//   见 `patch-contract.test.mjs` 第 10 条：allow 面出现越界名即失败）。
export const READONLY_DENY = ['write', 'edit', 'todo_write', 'ask_user_question', 'exit_plan_mode',
  'send_message', 'interrupt_agent', 'list_agents',
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  'subagent_fork',
  'subagent_scout', 'subagent_archivist', 'subagent_seer', 'subagent_reader',
  'schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update',
  'subagent_analyst', 'subagent_auditor', 'subagent_wright', 'subagent_forge', 'subagent_planner']
// wright（**22** 项静态 + 同一份 MCP 闭包）—— 同上，叶子执行者不需要控制面
//   （可写、可用 todo_write / skill）；⚠️ T16 的 3 个 lane 寻址名同样 deny（理由见上）
export const WRIGHT_DENY = ['ask_user_question', 'exit_plan_mode',
  'send_message', 'interrupt_agent', 'list_agents',
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  'subagent_fork',
  'subagent_scout', 'subagent_archivist', 'subagent_seer', 'subagent_reader',
  'schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update',
  'subagent_analyst', 'subagent_auditor', 'subagent_wright', 'subagent_forge', 'subagent_planner']
// forge（**17** 项静态 + 同一份 MCP 闭包）—— 保留 list_agents + send_message
//   （它要管自己派出的只读孙代）；deny interrupt_agent。**MCP 也 deny**（理由见上）。
//   ⚠️ T16 的 3 个 lane 寻址名同样 deny：本轮裁决是「这 3 件不出现在**任何 lane** 的工具面里」
//   （见 T16 目标句）—— lane 用「派人」而不是「寻址」。
export const FORGE_DENY = ['ask_user_question', 'exit_plan_mode', 'interrupt_agent',
  'subagent_children', 'subagent_send', 'subagent_interrupt',
  'subagent_fork',
  'schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update',
  'subagent_analyst', 'subagent_auditor', 'subagent_reader', 'subagent_wright', 'subagent_forge', 'subagent_planner']

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
// ⚠️ DESIGN.md §3.3.3 的「共同约定」：全部 lane 固定 `provider: 'spawn'`（与旧 bundle 一致）。
//    这一项**不在** T06 契约块的 LANES 条目里（契约只给 tool / persona / maxDepth / deny|allow）
//    ⇒ 由 T07 渲染时按 LANE_COMMON 补齐。
//
// ⛔ **`backgroundMode: 'continuable'` 已删除（host 0.2.1-alpha.2 实测）**。它曾在这里与 9 条
//    lane 行上一共出现 10 次，现在**一个字节都不该留**。理由分两层，两层都实测过：
//    ① **宿主已不认识这个键**：`@deepseek-ai/dsh-tool-subagent` 的 `Config`（`lib/index.js:251-267`）
//       在 0.2.1-alpha.2 上只有 provider / toolName / modelSelectionSettings / agentOptions /
//       persona / toolFilter / maxDepth —— `backgroundMode` 不在其中（0.2.1-alpha.1 的同一 schema
//       在 `lib/index.js:257` 有它）。schemastery 对未知键**不抛**（实测：带该键与不带该键的输入
//       都原样通过），所以这是一条**静默死键**，不是启动错误 —— 正因为静默，它只能靠人删。
//    ② **意图没有被丢掉，只是搬了家**：continuable 现在是 provider 的**能力**而非行的配置。
//       `apply()`（`lib/index.js:323`）按 `subagentProvider.prepareContinuable !== undefined`
//       决定工具描述，spawn provider 在 0.2.1-alpha.1 **与** 0.2.1-alpha.2 上都实现了
//       `prepareContinuable`（`dsh-subagent-spawn-in-process/lib/index.js:33` / `:37`）。
//       ⇒ 删掉这个键**不会**让 lane 退回 one-shot；lane 的「第二轮是同一 durable id 的一轮」
//       （personas/orchestrator.md 的 I6）依据仍在。
//    ⚠️ 若将来某版 spawn provider 不再实现 `prepareContinuable`，lane 会**静默**退回 one-shot：
//       那时 `subagent_children` 会把所有子代理投影成不可续（`lane-composition.mjs` 的
//       `projectChild` 丢弃 `mode !== 'continuable'`），而不是报错。这一条是本次删除的残余风险，
//       已知并接受 —— 它比留一个宿主不读的键更诚实。
export const LANE_COMMON = { provider: 'spawn' }

// ── 每条 lane 的 Agent Preset id ──────────────────────────────────────────────
// 新形态（alpha.3+）下 lane 的工具面与 persona 都由一条 **Agent Preset** 声明，
// lane 行只留 `agentPreset: <id>` + `allowedAgentPresets: [<id>]`。
// id 由 persona 文件名派生（`scout.md` ⇒ `orch-lane-BROKEN`）：**唯一来源是 LANES 表本身**，
// 不再手写第二份清单 —— 那样改名时会有一处静默失配。
// `orch-` 前缀避免与官方 preset id（`standard`）和用户自己的 id 相撞。
const lanePresetId = (lane) => 'orch-lane-' + lane.persona.replace(/\.md$/, '')

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
].map((lane) => ({ ...lane, presetId: lanePresetId(lane) }))

// ── lane 的 Agent Preset 声明（新形态用；旧形态不生成这些行）────────────────────
// 每条含两件：该 lane 的 persona（沿用运行时读文件，行为与旧形态的 `persona: !!js …` 一致）
// 与 `lane-tool-gate`（承接旧形态的 `toolFilter`，原因见上方 ⛔ 段）。
//
// ⚠️ **`allow` 的 lane（reader）在新形态下没有等价物**：gate 是「拒绝名单」，表达不了白名单
//    （`tools.guard()` 只有 deny 语义，没有 allow —— 见 `dsh-tools` 的 `ToolGuard` 类型）。
//    reader 的旧 `allow: ['read','read_image']` 是**允许名单**，含义是「只留这两个」。
//    新形态下用 gate 表达它需要**枚举全部要拒的名字**（= 宿主工具面减去两个），而那份名单
//    随宿主版本漂移 ⇒ 写死会在新宿主上拒掉不存在的名字，或在工具增加时漏放。
//    ⇒ reader 的 gate **不收窄通用工具面**（它在新宿主上会看到比旧宿主更多的工具）；
//      这一条退化在 README 的契约表里如实登记。
//
// ⛔ **但 lane 寻址名必须无条件挡住**（`LANE_ADDRESSING_DENY`）。这不是顺带的好意：
//    旧形态下 reader 用 **allow** 白名单，白名单天然不含那 3 个名字 ⇒ 它**本来就**寻址不了别的 lane。
//    若新形态直接 `lane.deny ?? []`，reader 的 gate 会变成空名单 ⇒ **它反而能寻址 sibling lane**，
//    即「本来被挡住的能力被解锁」。那是权限放大，不是行为退化 ⇒ 必须显式补上，
//    且这份名单与 `READONLY_DENY` 里那 3 个名字**同一个来源**，不得另写一份。
export const LANE_ADDRESSING_DENY = ['subagent_children', 'subagent_send', 'subagent_interrupt']

// ── 每条 lane 的 gate 名单：静态项 + 按机器算的 MCP 闭包 ────────────────────────
// ⛔ **在 rc.2 上，lane 的收窄**全部**走这里**（`lane-tool-gate` 的 `tools.guard()`）：
//    `dsh-tool-subagent@0.2.1-rc.2` 的 Config 里既没有 `persona` 也没有 `toolFilter`
//    （只有 `agentPreset` / `allowedAgentPresets`），而 preset 的 `plugins[]` **只能加不能减**。
//    ⇒ 若这里只列「声明里的 deny」，`allow` 形态的 reader 会拿到**空名单**，而其余 lane 也
//      只会拿到静态项 —— **每一条只读 lane 都能调用 `mcp_*`**，并继承 `schedule_*`。
//      那是权限放大，不是退化；而且产物看起来完全正常（名单在、只是短了）。
//    ⇒ 名单 = `lane.deny`（reader 用 `LANE_ADDRESSING_DENY`）+ `LANE_ADDRESSING_DENY`
//      + **MCP 闭包**（按机器算，理由见 `MCP_CLOSURE_EXPR` 段）+ **四个 `schedule_*`**。
//      `schedule_*` 在这里是**静态**列出的：唯一受支持的宿主 rc.2 自己依赖
//      `@deepseek-ai/dsh-tool-schedule` ⇒ 这四个名字在每台受支持机器上都存在（退休记录见上方段）。
//      这也正是 2026-10-10 裁决「只给 Lead，9 个 lane 全部 deny」在 rc.2 上的**执行点**：
//      静态名单是裁决的记录，这条 gate 名单是它真正生效的地方，两者缺一不可。
// ⚠️ **MCP 闭包是表达式，不是字面数组** ⇒ 本函数只交出**静态段**；生成器
//    （`gen-cordis-patch.mjs` 的 `lanePresetRow`）把它渲染成
//    `!!js ([…静态…]).concat(<MCP_CLOSURE_EXPR>)`。与旧形态 lane 的 `toolFilter.deny`
//    同一套渲染手法（同样是 plain scalar：无 `: `、无 `#`、无反斜杠、无双引号）。
// ⚠️ 这里的 4 个 `schedule_*` 名字与 `READONLY_DENY` 里那 4 个**同一个裁决**，但**不是**
//    同一份字面量 —— 前者要覆盖 reader（它的 `lane.deny` 是 undefined），后者是 deny 形态
//    lane 的名单。两处都由 `SCHEDULE_TOOL_NAMES` 供值，不得各写一份。
export const SCHEDULE_TOOL_NAMES = ['schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update']

/** 一条 lane 在新形态下的 gate 静态名单：声明里的 deny（若有）+ 寻址名 + `schedule_*`。 */
const laneGateDeny = (lane) => [...new Set([
  ...(lane.deny ?? []),
  ...LANE_ADDRESSING_DENY,
  ...SCHEDULE_TOOL_NAMES,
])]

export const lanePresetRows = LANES.map((lane) => ({
  id: 'preset-' + lane.presetId,
  name: '@deepseek-ai/dsh-agent-preset',
  config: {
    id: lane.presetId,
    order: 10 + LANES.indexOf(lane),
    plugins: [
      // `personaFile` 是**取值槽**：生成器把它渲染成与旧形态同形的运行时 `readFileSync`
      // 表达式（见 `gen-cordis-patch.mjs` 的 `personaExpr`）。本文件不产 `!!js`。
      { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { personaFile: lane.persona } },
      { id: 'lane-gate', name: laneGatePlugin, config: { deny: laneGateDeny(lane) } },
    ],
  },
}))

// ── 15 个顶层 row（13 个保留行的配置值与 preset-standard 逐字一致 + 2 个新增挂载行）──────────────────────────
// ⚠️ 权威骨架 standard.patch.yml **自身带** 6 个 row（command-goal / tool-goal / workflow-ptc /
//    tool-workflow / present / tool-plugin-manager）⇒ 本 preset **不得**含这 6 个（DESIGN.md §2.3「删除项」）。
//    ⚠️ **第 2 个新增挂载行 = `lane-composition`（T16，2026-09-25）**：它注册 Lead own-scope 的 3 个
//    lane 寻址工具（`subagent_children` / `subagent_send` / `subagent_interrupt`），形态照 `routing-sections`。
//
// ⛔ **`persona` 行不再带 `suffix`（host 0.2.1-alpha.2 实测）**。它曾经是
//    `config: { suffix: 'Your working directory is {{cwd}}.' }`，现在**必须为空**。
//    ① **`{{cwd}}` 这个提示词变量在 0.2.1-alpha.2 上已不存在**。`dsh-agent-loop` 的注册表：
//       0.2.0-rc.2 与 0.2.1-alpha.1 都注册 `provider` / `model` / **`cwd`**（各版 `:1564-1566`），
//       0.2.1-alpha.2 只剩 `provider` / `model`（`:1591-1592`）。上游 `dsh-system-prompt` 的
//       `interpolate()` 对**未知**变量是 **throw**，不是留空 —— 实测（用已装宿主自己的
//       `renderPrompt`）：`unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`。
//       该错误发生在**任何模型请求之前**，所以它不是降级，是装配期硬失败。
//       上游 `dsh-system-prompt/README.md:78` 已经把这件事写成对使用者的要求：
//       「Remove the `Your working directory is {{cwd}}.` clause … Omit or clear an otherwise empty suffix.」
//    ② **删掉不丢信息**：目录上下文由 `dsh-working-directory` 服务供给（它自 0.2.0-rc.2 起就在
//       `dsh-base` 的骨架里，`cordis.patch.yml:161-165`；0.2.1-alpha.2 新增的 `working_directory`
//       工具是它的接口）。README 那段指引的落点正是这里。
//    ⚠️ **这个删除在三版上都安全**：rc.2 / alpha.1 认得 `{{cwd}}`，但**不要求**任何行去用它；
//       一个没有 suffix 的 persona 行在旧版上与新版上都是合法配置（suffix 的 schema 默认 `''`）。
//       ⇒ 支持矩阵是三版时，只有这一种写法是三版通用的。
export const topRows = [
  // ⚠️ **`promptProfile` 开关（2026-10-22，提示词裁剪）**。两个取值：
  //    · `'minimal'`（**缺省**）—— persona 走 `personas/orchestrator.minimal.md`，routing 走四个压缩常量；
  //    · `'full'`         —— persona 走逐字未改的 `personas/orchestrator.md`，routing 走四个原始常量。
  //    **不写这个键等价于 `minimal`**：省 token 是默认意图，完整版要显式要。
  //    ⚠️ 两行必须同档。只切一行会得到「完整 persona + 压缩 routing」这种没人设计过的组合 ——
  //       两处都读同一个 `config?.promptProfile`，正是为了让它们不可能分叉。
  //    ⚠️ 这里是**运行时取值槽**，不是构建期常量：`cordis.patch.yml` 由本文件渲染，
  //       所以改档位必须重新跑 `node tools/gen-cordis-patch.mjs`（产物首行写着 DO NOT EDIT）。
  { id: 'persona',            name: bundlePkg + '/plan-aware-persona.mjs', config: { promptProfile: 'minimal' } },
  { id: 'routing-sections',   name: bundlePkg + '/routing-sections.mjs',   config: { promptProfile: 'minimal' } },
  { id: 'harness-sections',   name: bundlePkg + '/harness-sections.mjs',   config: { promptProfile: 'minimal' } },
  { id: 'lane-composition',   name: bundlePkg + '/lane-composition.mjs' },
  { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
  { id: 'time-context',       name: '@deepseek-ai/dsh-time-context' },
  { id: 'tool-bash',          name: '@deepseek-ai/dsh-tool-bash',          disabled: "process.platform === 'win32'" },
  { id: 'tool-pwsh',          name: '@deepseek-ai/dsh-tool-pwsh',          disabled: "process.platform !== 'win32'" },
  { id: 'tool-fs',            name: '@deepseek-ai/dsh-tool-fs' },
  { id: 'tool-fs-search',     name: '@deepseek-ai/dsh-tool-fs-search',     config: { sampleOverCapGlobResults: false } },
  { id: 'tool-jobs',          name: '@deepseek-ai/dsh-tool-jobs' },
  // ⚠️ **`tool-schedule`（2026-10-10 用户裁决：放开，只给 Lead）**。位置逐字跟随官方
  //    `standard.patch.yml`（`tool-jobs` 之后、`skill-filesystem` 之前，alpha.2 的 `:33-39`），
  //    config 为空 —— 与官方那一行同形（裸一行，无 config、**无 `disabled`**）。
  //    ① **它是什么**：`schedule_create/delete/list/update` 四个**持久提醒**工具（不是「时间感知」——
  //       时间感知是 `time-context`，自 0.1.4 起已在 `topRows` 第 5 行）。上游
  //       `dsh-tool-schedule/README.md`：它是 `@deepseek-ai/dsh-schedule` 服务的**面向模型的消费者**，
  //       在**挂载它的 preset 或 Agent scope** 里注册这四个工具 ⇒ 谁拿到由**装配**决定。
  //    ② **它挂在这一层 = 只给 Lead**：四个名字进的是 preset 顶层的工具面，而**每一条** lane 都在
  //       三份静态 deny 名单里列全了它们（`READONLY_DENY` / `WRIGHT_DENY` / `FORGE_DENY`），
  //       lane 的 `lane-tool-gate` 也列全了（`laneGateDeny`）。**只做前一半 = 把提醒能力
  //       静默发给所有 lane**，所以这两半必须一起改。
  //    ③ **本行为什么不再带宿主门**：唯一受支持的宿主 `0.2.1-rc.2` **自己依赖**
  //       `@deepseek-ai/dsh-tool-schedule`（`dsh@0.2.1-rc.2` 的 dependencies 里有它）⇒ 这个包在
  //       每一台受支持的机器上都可解析 ⇒ 不需要「解析不到就禁用」的那条按机器求值的 `disabled`。
  //       版本条件的完整退休记录见上方 `schedule_*` 段。
  { id: 'tool-schedule',      name: '@deepseek-ai/dsh-tool-schedule' },
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
      // ⚠️ `backgroundMode` 与 9 条 lane 行一同删除（同一理由，见 LANE_COMMON 上方的 ⛔ 段）：
      //    宿主 0.2.1-alpha.2 的 tool-subagent Config 里已无此键。fork provider 同样实现了
      //    `prepareContinuable`（`dsh-subagent-fork-in-process/lib/index.js:47`）⇒ 续话能力不丢。
      //
      // 🔻 **本行不再带任何 `toolFilter` / `disabled`** —— 它就是一行普通声明
      //    （`provider: fork` / `toolName: subagent_fork`），与官方骨架同形。原先那条
      //    「只 deny `schedule_*` 的条件尾巴」是为**旧形态宿主**存在的（alpha.3 之前
      //    `tool-subagent` 认 `toolFilter`）；受支持的 `0.2.1-rc.2` 会在 `apply()` 里对
      //    `toolFilter` 键硬抛（`lib/index.js:355` 的 `Object.hasOwn`）⇒ 那条尾巴无处可挂。
      //
      //    **被接受的退化**：在 rc.2 上，经 `subagent_fork` 派出的 child **继承父 agent 的
      //    preset 组合**（fork provider 自报 `capabilities.agentPreset = false`）⇒ 那四个
      //    `schedule_*` 名字**无法**在这条路径上被声明式 deny。0.1.9 声称它能，而那个声称在
      //    alpha.4 / alpha.5 上**已经**是假的；本轮只是把这句话改成真的。
      //    影响面：Lead 主动 fork 出来的 child 会看到提醒工具；9 条**具名** lane 不受影响
      //    （`laneGateDeny` 列全了这四个名字，且 lane 自己 fork 不了 —— 它们的 deny 里含
      //    `subagent_fork`）。
      //    ⚠️ 要彻底关掉这个口子只能靠运行时机制（对 fork child 施加 guard），需要新增插件
      //       文件，不在本轮面内。
      { id: forkControlRowId,           name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'fork', toolName: 'subagent_fork' } },
      ...LANES ] } ]
