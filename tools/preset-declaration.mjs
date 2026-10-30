// ============================================================================
// preset-declaration.mjs — 新 preset 的 32 个 row 的唯一来源（声明清单）
// ============================================================================
//
// 定位：把「32 个 row」从散文描述变成机器可读的单一来源，让 cordis.patch.yml 可再生成
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
//    ⇒ 本文件把**被引用者前置**（LANE_OFFICIAL / PLATFORM_SHELL / PLAN_MODE_SECTION / LANES），
//    再声明 topRows / groups。**所有值逐字照抄契约块，只调整声明次序。**
//
// ⛔ LEGAL_TOOL_NAMES 是**参考清单（REFERENCE list）**，**⛔ 不是门**：
//    禁止在生成器里用它断言 / 拦截 deny / allow 名单（「生成期闭集断言」机制已按用户裁决删除，
//    见 DESIGN.md §3.3.4 的 ⛔ 段）。它只供人读 + 产物自检。新的兜底 = 「首次派发时 loud 失败」。

// 19 个顶层 row（14 个保留行 + 4 个新增挂载行：routing-sections / harness-sections /
// tool-presentation / lane-composition + 1 个 OPS 接入行 ops-integration；口径见 topRows 处）
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

// ── MCP server 名与 `schedule_*`：不再需要任何静态/闭包名单 ──────────────────────
// 旧形态在这里算过两件事，现在两件都由机制自己兜住：
//   ① **MCP 闭包**（按 `ctx.loader.entries()` 算出本机会注册的 `mcp_<server>` 名，
//      再拼进 deny）。它存在的唯一理由是「deny 名单必须穷举要挡的名字」—— 本机没配的
//      server 一旦写死就会在别的机器上炸 `names unknown global tool`。现在 lane 声明的是
//      `official`（要什么），`lane-tool-gate` 按**当时**注册表求 deny ⇒ 晚注册的
//      MCP 名字在 `tools/change` 的第二次求值里照样被剥掉（实测见 G5）。
//      ⇒ 新增 MCP server **不需要**同步任何名单，也不再需要镜像 mcp-loader 的命名规则
//        (`mcp_<server>`) 或 eager 判定 —— 那两条事实不再被本文件复制。
//   ② **`schedule_*` 静态 deny**（2026-10-10 裁决：只给 Lead，9 条 lane 全部不给）。
//      四个名字现在统一体现在「不在任何 lane 的 `official` 里」：`tool-schedule` 行仍在
//      `topRows`（Lead 的工具面），而九条 lane 的 official 集都不含这四个名字。
//      ⇒ 裁决不变，表达方式从「逐条 deny」换成「不授予」。
// ⚠️ 唯一保留下来的相关事实是 `LEGAL_TOOL_NAMES`（参考清单，不是门）：它仍列着这些名字，
//    供人读与产物自检使用。
// ── 宿主形态探针：这个宿主的 `tool-subagent` 还在旧契约上吗 ────────────────────
// ⚠️ **先读名字再读语义**：本常量叫 `LANE_FORM_SUPPORTED_EXPR`，但它为 **true 的含义是
//    「宿主是旧形态」= 本包**不支持**它**。支持集见下方常量 `SUPPORTED_HOST_VERSIONS`
//    （版本集见下方常量，单一来源 —— 这里不再复述版本号与版数，免得两处漂移），所以这条探针的职责
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
// ── 受支持宿主的**版本集**（单一来源）────────────────────────────────────────────
// 支持集是**两个**版本（升序）：`0.2.1-rc.5` / `0.2.2-alpha.2`。
// 为什么是这两版（两个渠道，2026-10-30 用户裁定）：
//   · `0.2.1-rc.5` —— 桌面 app 的 asar 树**已升到这一版**，也是 npm `latest`
//   · `0.2.2-alpha.2` —— npm `next` / `alpha` 通道（本机 npm 安装树就是这一版）
//   两个渠道各自都有用户在跑；任一档被判成「不支持」，都会让 19 行全关、九条 lane 静默消失，
//   所以两个渠道的当前版本都要进集合。
//   `0.2.1-rc.3` / `0.2.1-rc.4` **退出**集合：官方发了 rc.5 并出了安装包之后，这两版**不再有
//   任何渠道承载**（asar 里 `0.2.1-rc.5` 标记 4623 处、`0.2.1-rc.3` **0** 处）。
// 它同时出现在三处，必须同值：
//   · 本常量（宿主门的判据）
//   · README / README.zh「Host version gate」那张支持集表（⛔ 不写行数：集合已经变过几轮，写死必漂）
//   · `install.sh` 的 SUPPORTED_HOST_VERSIONS（安装期的支持集检查）
// ⚠️ **集合不是区间**：判据是逐字成员判断，不是 semver 比较。原因是 `dsh-tool-subagent`
//    的 `version` 字段里 prerelease 段的写法属上游自由（`-rc.2` / `-rc3` 都可能是同一版），
//    而「相邻两版之间还有什么」这件事本包没有逐版实测过（例如 rc.3↔rc.4、rc.5↔alpha.2
//    之间）—— 一次 semver 比较会顺手把
//    未测过的中间态也放进来。逐字成员只放行这里明确点名的版本。
// ⚠️ 为什么门要按**版本**判而不是按 Config 形状判（第 24 轮更正，seer 提出）：
//    旧判据读 `Config` 字面量里有没有 `persona:`。那个事实在 0.2.0-rc.2 / alpha.1 /
//    alpha.2 上是 true、在 alpha.3 及以后是 false ⇒ 它只把**老**宿主关掉，而把
//    alpha.3/4/5 **放进来**。可是 alpha.3 与当时受支持的 `0.2.1-rc.2` 在结构上**无法区分**：
//    两者的 `Config` 键集相同（`agentPreset` / `allowedAgentPresets`，无 `persona`）、
//    服务需求相同 —— **只有版本字符串能分开它们**。所以判据必须是版本。
//    本轮收窄到两版后同一条理由仍然成立，而且更清楚：**rc.5 与本轮退出集合的 rc.3 / rc.4
//    逐字节相同**（两份 `patch.yml` + 7 个 `lib/index.js` 的 sha256 全同，`E:\dsh-verify`
//    矩阵实测），更早退出的 `0.2.1-rc.2` 也在这条同结构线上 ⇒ 形状把「rc 线」整族判成同一种
//    形态，分不开 rc.5 与 rc.4，也分不开 rc.5 与 rc.2。**同一形状、一侧在集合内一侧在集合外
//    ⇒ 判据只能是版本字符串**。
//    ⚠️ 这条 sha 测量是 **rc.5 支持依据的来源**（rc.3 当年被真启动过，rc.5 与它逐字节相同）；
//    它是**历史测量**，**不表示** rc.3 / rc.4 现在受支持。
//    ⚠️ `0.2.2-alpha.2` 的结构**不同**（矩阵实测），它的差异由另一条**结构**判据承担 ——
//    见下方 `TOOL_PRESENTATION_RETIRED_EXPR`。两件事别混：**版本判据**管「这是哪一版」，
//    **结构判据**管「宿主是否已经自己管了这一层」。
// ⚠️ 每一版进集合的依据是**逐版实测**（矩阵），而**不是**「上一版能用所以这版也能用」。
export const SUPPORTED_HOST_VERSIONS = ['0.2.1-rc.5', '0.2.2-alpha.2']

// ── 宿主门：**这台宿主的 `dsh-tool-subagent` 版本不在受支持集里吗** ──────────────────
// 名字仍然叫 `LANE_FORM_SUPPORTED_EXPR`，而 **true 的含义是「不受支持」**（保持既有极性，
// 三族行——9 条 lane 行 / 9 条 preset 行 / fork 行——都直接取它作 `disabled`，不加 `!`）。
//
// 判据两步，都从 `baseUrl` 出发（与宿主求值 `!!js` 的 ctx 同一手法）。两步的**性质不同**，
// 这一点曾经写错，所以在这里写清楚：
//
//   ① **版本步 —— 严格（strict）**：`createRequire(baseUrl).resolve('@deepseek-ai/dsh-tool-subagent')`
//      拿到入口，从它所在目录**向上最多走 6 层**，找 `name` 等于该包名的 `package.json`，读 `version`。
//      **只要读得到一个版本，且它不在 `SUPPORTED_HOST_VERSIONS` 里，就返回 true（禁用）**。
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
  + "if (version !== null && ![" + SUPPORTED_HOST_VERSIONS.map((v) => "'" + v + "'").join(',') + "].includes(version)) return true; "
  // ⚠️ 括号必须配平：`.test(` 自己也要一对。漏掉最外层那个 `)` ⇒ 整条表达式
  //    **语法错误**（`missing ) after argument list`），而它被嵌进 `!!js` 后**不会**在
  //    生成期报错 —— 只会在宿主求值那条 `!!js` 时炸，或在 check 13 的求值测试里炸。
  + "const src = fs.readFileSync(entry, 'utf8'); "
  + "const at = src.indexOf('const Config = z.object({'); "
  + "if (at < 0) return true; "
  + "return /persona:/.test(src.slice(at, src.indexOf('});', at))) "
  + "} catch (e) { return true } })()"

// ── `dsh-ops/integration` 的宿主门（这个子路径是 dsh-ops **0.5.0** 才有的）──────────
// **为什么需要门**：`dsh-ops` 不是本 bundle 的依赖 —— 装不装、装哪一版由用户机器决定。
//   而 `dsh-ops/integration` 是 0.5.0 新增的**公开 opt-in 子路径**：0.4.4（当时的 npm
//   latest）没有它，`resolve()` 抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`（本机两个 profile 实测：
//   装了 0.5.0 的那个解析成功，装 0.4.4 的 desktop profile 抛这个错）。
//   没有门时，`- id: ops-integration` 会在「没装 OPS」或「装了 0.4.4」的机器上于 mount 期
//   抛错；而 preset 的 `plugins[]` 是**整体装配** —— 一行炸掉，整个 preset 不挂
//   （persona / routing / 9 条 lane 一起消失）。一个可选增强不该有这种爆炸半径。
// **极性**：与 `LANE_FORM_SUPPORTED_EXPR` **同向** —— `true` = 不可用 = 该行 `disabled`。
//   装配面上只允许一种读法：门为真即关。反着写会让「该关的挂上、该挂的关掉」。
// **判据为什么是 `resolve()` 而不是读 `version`**：`./integration` 有没有被 `exports`
//   暴露，才是宿主能不能挂这一行的**直接**事实；版本号还要经过一层「哪几版有它」的映射，
//   多一步推导就多一处会漂的假设（0.4.4 → 0.5.0 之间的小版本也可能变 exports）。
// **`catch (e) { return true }` 是 fail-closed**：解析不到 = 连入口文件都没有，那种情况
//   强行挂上去必然在 mount 期炸 ⇒ 关掉它（与上面那条表达式同一个失败方向）。
// ⚠️ **plain scalar 边界同 `LANE_FORM_SUPPORTED_EXPR`**：表达式体内**不得**出现
//   `: `（冒号+空格）/ `#` / 反斜杠 / 双引号 / 对象字面量 / 三元 —— 它被嵌进 YAML 的
//   `!!js` plain scalar。所以这里只用 `try` / `return`、单引号字符串、`;` 收尾。
//   下面这份形态已核对过该约束，**不要**为了「更好读」改写它。
export const OPS_INTEGRATION_UNSUPPORTED_EXPR = "(() => { try { "
  + "process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('dsh-ops/integration'); "
  + "return false } catch (e) { return true } })()"

// ── `tool-presentation` 行的宿主门（宿主**自己**已经在管 executor 时，这一行必须让位）─────────
// **为什么是结构判据、不是版本判据**：这不是「挑一种形态」，而是**重复注册** —— 宿主 base 骨架
//   若已经挂了 `tool-executor-native`，它就在管「模型看到什么形状的工具面」，本行再挂一次
//   `dsh-agent-tool-presentation` 就会把 native executor 挂**第二遍**。判据读的是「这一层归谁管」，
//   与 vendor 版本号无关：同一版本号里也能发生结构变化，所以这里读结构。
// **两个世界的事实**（E:\dsh-verify 契约矩阵 + 两棵树逐包 ls 实测）：
//   · rc.3 / rc.4 / rc.5（逐字节相同）：树里**没有** `@deepseek-ai/dsh-tool-executor-native`；
//     它们的 `dsh-tools` 是 `mode: z.union(['native','ptc']).default('native')`。
//   · `0.2.2-alpha.2`：树里**有** `@deepseek-ai/dsh-tool-executor-native`；`dsh-tools` 的 `mode`
//     已收成 `z.never()`，宿主 base 骨架**自己**挂了 `tool-executor-native`（启用）与
//     `tool-executor-ptc`（`disabled: true`），而 `dsh-agent-tool-presentation` 做的是
//     `ctx.plugin(mode === 'native' ? Native : Ptc)` ⇒ 本行在 alpha.2 上是重复注册。
// **判据**：`@deepseek-ai/dsh-tool-executor-native` 能 `resolve()` ⇒ 宿主自己管这一层 ⇒ 本行 disabled。
// **极性**：与上面两条表达式**同向** —— `true` = 不可用 = 该行 `disabled`。
// ⚠️ **`catch (e) { return false }` 与上面两条是反的，这是刻意的**：解析不到 = 这个包不在树里 =
//   rc 线那种情形 ⇒ 保持现状（rc 线上本行照挂）。这里**不能** fail-closed —— 那会把 rc 线上本来
//   合法的一行关掉。代价：若 alpha.2 的树因 `exports` 遮蔽而解析失败，本行会重复挂载；已接受的
//   残余（实测该包在两棵树上都可解析，见矩阵）。
// ⚠️ **rc 线上本行是冗余的**（`mode: 'native'` 与 schema 默认值相同）—— 保留它没有行为差异，
//   所以**不改 rc 线现状**：最小风险，等上游把 `mode` 收干净再谈删行。
// ⚠️ **退休触发（什么时候该删掉这条门）**：当受支持集里**不再有 rc 线** —— 也就是所有受支持宿主都
//   自带 `@deepseek-ai/dsh-tool-executor-native` —— 本表达式会**恒为 true**（每台受支持宿主都关掉
//   这一行）。届时正确的动作是把 `tool-presentation` 行与这条表达式**一起删掉**，而不是留一条永不
//   打开的门：恒真的门会让下一个人以为它还在判什么。判据可读：只要 `SUPPORTED_HOST_VERSIONS` 里还有
//   一个 rc 版本，这条门就仍然有用；最后一个 rc 版本移出集合的那一次，就是它退休的那一次。
// ⚠️ **plain scalar 边界同 `LANE_FORM_SUPPORTED_EXPR`**：体内不得出现 `: ` / `#` / 反斜杠 /
//   双引号 / 对象字面量 / 三元。下面这份形态已核对过该约束，**不要**为了「更好读」改写它。
export const TOOL_PRESENTATION_RETIRED_EXPR = "(() => { try { "
  + "const req = process.getBuiltinModule('node:module').createRequire(baseUrl); "
  + "req.resolve('@deepseek-ai/dsh-tool-executor-native'); "
  + "return true } catch (e) { return false } })()"

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

// ── 为什么不再有三份静态 deny 名单 ─────────────────────────────────────────────
// 每一条 lane 现在声明的是它**要什么**（`official`，见 LANES），不是它**不要什么**。
// 这不是措辞偏好，是机制决定的：静态 deny 名单必须枚举「宿主工具面减去本 lane 的」，
// 而宿主的全局工具面按部署漂移（MCP server、第三方插件、workbench 扩展）⇒ 名单只会
// 越写越长、越写越漏。`official` 反过来：它只写本 lane 该有的名字，剩下的由
// `lane-tool-gate` 按**当时**注册表算出来再说。
// ⚠️ 因此这里**没有**三份静态名单可供对照 —— 想看某条 lane 能看见什么，
//   看 `LANE_OFFICIAL` 里那一行，那就是全部。
// ⚠️ 这也顺带消掉了一类缺陷：旧名单里 `subagent_*` 十三个名字必须逐条列全（漏一个 =
//    lane 能派活给 sibling），而现在只要不在 `official` 里就进不了工具面。

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

// ── 九条 lane 的**官方工具集**（`official`）─────────────────────────────────────
// 这份表是每条 lane 工具面的**唯一来源**：lane 的 preset 里挂哪些官方工具行、以及
// `lane-tool-gate` 的 `official`，都从同一个 `official` 数组派生（见下方的 `laneToolRows`）。
// 两个用途共用一个数组，是为了让「声明了却挂不上」与「挂上了却没声明」都**不可能发生** ——
// 那两件事的组合正是「lane 的工具面与它的声明不符」，而这种不符不会有任何报错。
//
// ⚠️ **为什么是 `official`（要什么）而不是 deny（不要什么）**：见本文件上方
//     「为什么不再有三份静态 deny 名单」段。一句话：宿主的全局工具面按部署漂移，
//     「不要什么」永远列不全，「要什么」永远列得全。
//
// ⚠️ **shell 两个名字都写进 `official`**（`bash` 与 `pwsh`）：`official` 是**允许**名单，
//     不是「本机注册了什么」的镜像 —— 多写一个没注册的名字是**无害**的（deny 只从
//     **已知**名字里选，不存在的名字不会进 deny，因此 `restrict()` 不会抛 unknown），
//     少写一个才是权限缺口。而本机到底注册哪个由 `plugins[]` 里那两条 `!!js` 平台表达式
//     决定 ⇒ **两个都声明、两个都挂**，两边永远自洽，且与构建这台机器上的平台无关。
//     ⚠️ 这正是上一轮在别处踩过的坑：只写 `bash` 又只挂 `tool-bash` 时，Windows 上
//        两条都不生效 ⇒ 该 lane **完全没有 shell**（可写 lane 却跑不了命令）。
export const LANE_OFFICIAL = {
  // 只读侦查面：读文件 + 看图片 + 找路径 + 搜内容
  scout:     ['read', 'read_image', 'glob', 'grep'],
  seer:      ['read', 'read_image', 'glob', 'grep'],
  analyst:   ['read', 'read_image', 'glob', 'grep'],
  auditor:   ['read', 'read_image', 'glob', 'grep'],
  // 档案 lane 额外能上网取证（它要给别的 lane 送外部事实）
  archivist: ['read', 'read_image', 'glob', 'grep', 'web_fetch', 'web_search'],
  // reader 是**唯一**的窄口：只有两把读的钥匙，连找路径都没有
  reader:    ['read', 'read_image'],
  // 可写 lane：在只读面之上加 write / edit / todo / skill / shell
  wright:    ['read', 'read_image', 'glob', 'grep', 'write', 'edit', 'skill', 'todo_write', 'bash', 'pwsh'],
  forge:     ['read', 'read_image', 'glob', 'grep', 'write', 'edit', 'skill', 'todo_write', 'bash', 'pwsh'],
  // 规划 lane：能读能查、能取 skill 的用法，但**不能写**（它只产出计划）
  planner:   ['read', 'read_image', 'glob', 'grep', 'skill'],
}

export const LANES = [
  { tool: 'subagent_scout',     persona: 'scout.md',     maxDepth: 1, official: LANE_OFFICIAL.scout },
  { tool: 'subagent_archivist', persona: 'archivist.md', maxDepth: 1, official: LANE_OFFICIAL.archivist },
  { tool: 'subagent_seer',      persona: 'seer.md',      maxDepth: 1, official: LANE_OFFICIAL.seer },
  { tool: 'subagent_reader',    persona: 'reader.md',    maxDepth: 1, official: LANE_OFFICIAL.reader },
  { tool: 'subagent_analyst',   persona: 'analyst.md',   maxDepth: 1, official: LANE_OFFICIAL.analyst },
  { tool: 'subagent_auditor',   persona: 'auditor.md',   maxDepth: 1, official: LANE_OFFICIAL.auditor },
  { tool: 'subagent_wright',    persona: 'wright.md',    maxDepth: 1, official: LANE_OFFICIAL.wright },
  { tool: 'subagent_forge',     persona: 'forge.md',     maxDepth: 1, official: LANE_OFFICIAL.forge },
  { tool: 'subagent_planner',   persona: 'planner.md',   maxDepth: 1, official: LANE_OFFICIAL.planner },
].map((lane) => ({ ...lane, presetId: lanePresetId(lane) }))

// ── lane 的 Agent Preset 声明（新形态用；旧形态不生成这些行）────────────────────
// 每条 lane 的 preset 含三类行：
//   ① `persona` —— 该 lane 的 persona 文件（沿用运行时读文件，与旧的 `persona: !!js …` 同形）；
//   ② `lane-tool-gate` —— 持有 `official`，在**运行时**把其余一切从该 lane 的工具面上剥掉；
//   ③ **官方工具行** —— 该 lane 真正需要的 `@deepseek-ai/*` 工具插件。
//
// ⛔ **③ 不是「顺手也挂上」，它是必需的一半**：`official` 只是**允许**名单，不注册任何东西。
//    一个在 `official` 里但没被 ③ 挂载的名字就是**不存在**的工具：「允许」一个不存在的工具，
//    结果仍然是 lane 没有它。反过来，③ 挂了某个工具却不在 `official` 里，那个工具会被 gate
//    立刻剥掉 —— 花了注册成本、产物看起来正常、lane 却拿不到。
//    ⇒ 两半必须**同源**。所以 ③ 不手工书写，而是由 `laneToolRows()` 从 `official` **派生**：
//      声明里有 `write` ⇒ 挂 `tool-fs` 且 `write: true`；有 `glob`/`grep` ⇒ 挂 `tool-fs-search`；
//      有 `web_search` ⇒ 挂 `tool-web`；有 `skill` ⇒ 挂 `tool-skill`；有 `todo_write` ⇒ 挂 `tool-todo`；
//      有 `bash`/`pwsh` ⇒ 各挂一条，带与 `topRows` **同形**的平台 `disabled` 表达式。
//      这样「官方集」只有一个 home，产物与声明不可能分叉。
//
// ⚠️ **shell 的两条行必须都挂**（`tool-bash` + `tool-pwsh`）。它们的 `disabled` 是
//    **未求值**的平台表达式（`process.platform === 'win32'` / `!== 'win32'`），与 `topRows`
//    里那两条逐字同形 —— 宿主的 profile / home patch **够不到** preset 的 `plugins[]`，
//    所以启用哪一个由这两条表达式在**运行时**决定，不由构建机器决定。
//    只挂其中一条 = 在另一个平台上该 lane 没有 shell（静默的能力缺口，不报错）。
const SHELL_ROWS = {
  bash: { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', disabled: "process.platform === 'win32'" },
  pwsh: { id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh', disabled: "process.platform !== 'win32'" },
}

/** 由一个 `official` 集派生该 lane 的官方工具行。**唯一来源**，不得在别处另写一份。 */
function laneToolRows(official) {
  const has = (n) => official.includes(n)
  const rows = []
  if (has('read')) {
    // `write` / `edit` 是 `tool-fs` 的两个开关；不开就等于注册了也拿不到那两个工具
    rows.push({ id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs',
      config: { write: has('write'), edit: has('edit') } })
  }
  if (has('glob') || has('grep')) {
    // 与 `topRows` 同形：`glob` 结果超采样上限时不再追加，保持输出可预期
    rows.push({ id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search',
      config: { sampleOverCapGlobResults: false } })
  }
  if (has('web_fetch') || has('web_search')) {
    rows.push({ id: 'tool-web', name: '@deepseek-ai/dsh-tool-web',
      config: { fetch: true, searchTimeoutMs: 60000 } })
  }
  if (has('todo_write')) {
    rows.push({ id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo',
      config: { allowParallelInProgress: true } })
  }
  if (has('skill')) {
    rows.push({ id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' })
  }
  for (const name of ['bash', 'pwsh']) {
    if (has(name)) rows.push({ ...SHELL_ROWS[name] })
  }
  return rows
}

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
      // `official` 是**字面数组**（不是表达式）：它是声明，不带任何按机器求值的东西。
      { id: 'lane-gate', name: laneGatePlugin, config: { official: lane.official } },
      ...laneToolRows(lane.official),
    ],
  },
}))

// ── 19 个顶层 row（14 个保留行 + 4 个新增挂载行 + 1 个 OPS 接入行）──────────────────
// ⚠️ 计数随 2026-10-27 的 `ops-integration` 接入从 18 变 19（该行不属于「保留行」，也不属于
//    那 4 个自写挂载行：它是**外部包** dsh-ops 的公开子路径，带自己的宿主门）。
// ⚠️ 计数随 T11（2026-10-22，`tool-presentation`）从 17 变 18；上两轮的 `harness-sections`（T7-T9）
//    与 `tool-presentation` 都是「刻意用通用 id 的自写挂载行」，所以这条注释里的加数要一起变。
//    「保留行」= 权威骨架 `standard.patch.yml` 里也有同名 id 的行（含被本包**替换**的 `persona`）。
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
/**
 * 工具呈现模式。'native' = 每个工具一份独立 schema（现状，默认）；
 * 'ptc' = wire 收拢为单个 run_code + 生成的 SDK（见 dsh-agent-tool-presentation/README.md）。
 * ⚠️ 切到 'ptc' 会让提示词显著变长（tools:sdk 段按工具 schema 生成，本 preset 工具面很大），
 *    而且 run_code 下的工具调用方式与 native 完全不同。切之前先量账。
 */
export const TOOL_PRESENTATION = 'native'

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
  // ⚠️ **工具呈现行（T11，2026-10-22）**：`dsh-agent-tool-presentation` 决定「模型看到什么形状的工具面」。
  //    与官方 `ptc.patch.yml:123-126` 那一行同形（官方 ptc preset 相对 standard preset 的**唯一**差别
  //    就是这一行）；取值来自本文件顶部的 `TOOL_PRESENTATION` 常量。
  //    ① `mode` 在 schema 里**必填、无默认值**（`dsh-agent-tool-presentation/README.md` 的字段表）：
  //       「a preset without this row inherits the deployment default」。本行**显式**写出取值，
  //       所以本 preset 的呈现模式不随部署层漂移。
  //    ② ⛔ **同一 composition 内不得再声明第二行**：README:50「A second declaration in the same
  //       composition is refused rather than merged」—— 那是矛盾，不是覆盖。本 preset 只有这一行。
  //    ③ ⛔ **不在这里挂 `dsh-ptc-runtime-node`**：它是 host-plane 服务，部署层已经挂了
  //       （`dsh-base/cordis.patch.yml:397-398`）。README:109「a preset can select PTC mode but
  //       cannot supply the TypeScript runtime it needs」⇒ preset 挂不上它。
  //    ④ 别与 `dsh-workflow-ptc` / `dsh-tool-workflow` 搞混：那两行是 **workflow 引擎**，
  //       本 preset 明确删除（见下方 `topRows` 开头的删除说明），与工具呈现无关。
  //    ⑤ `native` 立即生效；`ptc` 要等 `ctx.ptcRuntime`。部署层没挂 runtime 时，选 ptc 的
  //       composition **拒绝挂载**并点名本行（失败落在运维能处理的地方，不是首次请求）。
  //    ⑥ **宿主自己管 executor 时本行必须让位**：门取自 `TOOL_PRESENTATION_RETIRED_EXPR`
  //       （`@deepseek-ai/dsh-tool-executor-native` 能 resolve ⇒ 本行 disabled）。理由与代价
  //       写在那条常量上面：alpha.2 自己挂了 native executor，本行再挂一次就是重复注册；
  //       rc 线上本行仍是冗余的（等于默认值），保留不动。
  { id: 'tool-presentation',  name: '@deepseek-ai/dsh-agent-tool-presentation', config: { mode: TOOL_PRESENTATION }, disabled: TOOL_PRESENTATION_RETIRED_EXPR },
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
  //    ② **它挂在这一层 = 只给 Lead**：四个名字进的是 preset 顶层的工具面，而**九条 lane 的
  //       `official` 集都不含这四个名字**（见 `LANE_OFFICIAL`）⇒ `lane-tool-gate` 会把它们
  //       从每条 lane 的工具面上剥掉。**只挂这一行而不看 official = 把提醒能力静默发给所有
  //       lane**，所以「挂在这里」与「不进任何 official」是同一裁决的两半，必须一起改。
  //    ③ **本行为什么不再带宿主门**：受支持的**两版**（`0.2.1-rc.5` 与 `0.2.2-alpha.2`）**都自带**
  //       `@deepseek-ai/dsh-tool-schedule`（rc 线的 `dsh` 与 `0.2.2-alpha.2` 的 `dsh`，其
  //       `dependencies` 里都有它）⇒ 这个包在每一台受支持的机器上都可解析 ⇒ 不需要
  //       「解析不到就禁用」的那条按机器求值的 `disabled`。
  //       版本条件的完整退休记录见上方 `schedule_*` 段。
  { id: 'tool-schedule',      name: '@deepseek-ai/dsh-tool-schedule' },
  { id: 'skill-filesystem',   name: '@deepseek-ai/dsh-skill-filesystem' },
  { id: 'tool-skill',         name: '@deepseek-ai/dsh-tool-skill' },
  { id: 'tool-ask-user',      name: '@deepseek-ai/dsh-tool-ask-user' },
  { id: 'tool-todo',          name: '@deepseek-ai/dsh-tool-todo',          config: { allowParallelInProgress: true } },
  { id: 'tool-web',           name: '@deepseek-ai/dsh-tool-web',           config: { fetch: true, searchTimeoutMs: 60000 } },
  // ── `dsh-ops/integration`（dsh-ops 0.5.0 的公开 opt-in 接口，2026-10-27 接入）──────
  //
  // ① **为什么排进本 preset 的 `plugins[]`，而不是 bundle 顶层 `- insert:`**：
  //    OPS 文档要求「mount at the preset composition scope」。preset 的组成面才是本
  //    preset 的 Lead 拿到的那份工具面；这一行渲染进 `preset.config.plugins[]`
  //    （`- id:` 缩进 **10**）。顶层 `- insert:`（缩进 **4**）是**部署层**的挂载点 ——
  //    挂在那儿是把工具面加到 host 层，既不是这个 preset 的 Lead，也与本文件其余
  //    「本 preset 的工具面」脱节（同一件事就有了两个家）。
  //    形态上它就是一条普通 row：该模块导出 `{ name, apply }`，与 `topRows` 里每条
  //    插件行同形 ⇒ 不需要新 .mjs 文件，也不需要动 `exports` / `files` / `.gitignore`。
  //
  // ② **为什么 `profile: 'discovery'`**：该 profile 给出 `files: false` /
  //    `presentation: 'native'` / `discovery: true` ⇒ **不重复**本 preset 已有的官方
  //    `read` / `write` / `edit` / `glob` / `grep`（OPS 的文件工具要 `files: true` 才注册）。
  //    OPS 的额外能力（read_pdf / read_docx / read_table / replace / diff / stat / copy /
  //    move / remove 等）由 `ops_discover_tools` **按需解锁**，而不是在常驻工具面上再挂一套
  //    并行的文件工具（常驻双份 = 每次请求都付两份 schema 的 token，还要面对「同一件事两个
  //    实现」）。
  //    ⚠️ `shell` / `replaceOfficial` **不取自 profile**，而是下面 ③④ 的**显式键覆盖**：
  //    `resolveIntegrationConfig()` 先取 profile 默认值、再用同名布尔键覆盖
  //    （`dsh-ops/lib/integration/config.js:26-49`，0.5.0 实测读到的实现）。
  //
  // ③ **`shell: true` —— 2026-10-29 用户裁决：要 `ops_bash`，并顶掉官方 `pwsh`**。
  //    这是本行**唯一**一次「改变已有行为」的开关，代价照实记在这里，不淡化：
  //    · **Lead 从此没有直接的 `pwsh`**：`replaceOfficial: true` + `shell: true` + win32
  //      ⇒ `integration/index.js:59-61` 把 `SHELL_OFFICIAL_NAMES`（`pwsh` /
  //      `pwsh_persistent`，`modes/plan.js:5`）逐一映射到 `ops_bash`，由
  //      `publication/replacements.js` 在该 agent scope 上 `tools.restrict({ deny })`。
  //    · **PowerShell 没消失，只是不再是一等工具**：cmdlet / `.ps1` 要在 `ops_bash` 里
  //      显式起 `powershell.exe` / `pwsh.exe` 才能用。`ops_bash` 是 MSYS bash（包内
  //      `runtime/win32-x64` 与 `@dsh-ops/bash-win32-x64` 均已就位）。
  //    · **9 条 lane 不受影响**：替换是**按 agent 门控**的 —— `matches(agent) =
  //      gate.allows(agent)`，而 `gate.allows` 要求该 agent 的 preset id ===
  //      `config.preset`（也就是本 preset 的 Lead）。lane 的 preset id 各不相同 ⇒ 它们仍
  //      看得见官方 `pwsh`，用法与现在完全一致。
  //    · **fail-safe**：`plan()` 只在「对方 counterpart 可见」时才隐藏官方工具
  //      （`replacements.js:35-37`）⇒ 万一 `ops_bash` 没发出来，`pwsh` 自动保留，不会出现
  //      「两个都没有」。
  //    · 常驻工具面的实际变化（`files: false` 时）：**+`ops_bash`**，`pwsh` /
  //      `pwsh_persistent` 被顶掉；原有的 `ops_discover_tools` 与 `ops_status` 不变。
  //    · win32 上还会 `mountWorkspacePreparation()`（`integration/index.js:31-32`），但它只在
  //      `workspace-write` 策略下真的动手（`workspace-preparation.js:27-28`），
  //      `danger-full-access` 下是 no-op。
  //    · `promptPolicy` 默认为 true，`shell && !files` ⇒ 还会挂一段作用域化的 shell 路由文本
  //      （`integration/index.js:35-42` → `policy.js` 的 `renderToolingPolicy`）。
  //      **`ops_bash` 的调用约定与 `pwsh` 不同，那段文本就是唯一来源**：必须带
  //      `description`；返回 `kind: foreground / background / promoted` 的结构化结果；长脚本
  //      （约 1 KB 以上，或含 heredoc / 引号 / 反斜杠 / 非 ASCII）应**先写文件再传
  //      `script_path`**，别塞进 `command`。
  //
  // ④ **`replaceOfficial: true` —— 在这里只对 shell 生效，因为 `files: false`**。
  //    文件替换分支要求 `config.files && presentation === 'native'`
  //    （`integration/index.js:55-58`）；本行的 `files` 为假 ⇒ 官方 `read` / `glob` / `grep`
  //    保持原实现，**不**被 OPS 顶掉。这也正是**不**连带打开 `files` 的理由：那会白白多挂
  //    一套并行文件工具（`read_files` / `inspect_local_file` / `glob` / `grep` / `result`），
  //    与官方 `read` / `write` / `edit` / `glob` / `grep` 重复，每次请求多付一份 schema。
  //    ⚠️ 不能只写 `replaceOfficial: true` 而 `shell` / `files` 都不开 —— 0.5.0 对此直接抛
  //    `replaceOfficial requires files or shell`（`integration/config.js:50-51`）。这里合法
  //    是因为 `shell: true` 同时成立（旧注释那条「本 profile 上它不可选」的前提，正是
  //    `shell` 也为 false）。
  //
  // ⑤ **`config.preset` 必须精确等于宿主 preset id**（用导出的 `presetId`，不写字面量）：
  //    这一键是「我声明自己在哪个 composition 里」的自述，同时也是 ③ 里那道替换门的判据 ——
  //    写错 ⇒ 挂载期点名不符，且替换永远匹配不到任何 agent。
  //    这里**只写这四个键**（`preset` / `profile` / `shell` / `replaceOfficial`），其余键全部
  //    走 0.5.0 的默认值：`resolveIntegrationConfig()` 先校验键集，未知键直接抛 `ConfigError`
  //    （`integration/config.js:18-20`），所以不许多写。
  //
  // ⑥ **`disabled` 用上面那条 `OPS_INTEGRATION_UNSUPPORTED_EXPR`**：没装 dsh-ops、或装的
  //    是不带 `./integration` 导出的 0.4.4 ⇒ 该行禁用，而不是让整个 preset 在 mount 期炸。
  { id: 'ops-integration', name: 'dsh-ops/integration', disabled: OPS_INTEGRATION_UNSUPPORTED_EXPR,
    config: { preset: presetId, profile: 'discovery', shell: true, replaceOfficial: true } },
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
      //    `tool-subagent` 认 `toolFilter`）；而受支持的两版（`0.2.1-rc.5` 与 `0.2.2-alpha.2`）的
      //    `tool-subagent` 的 `Config` 里都没有 `toolFilter`，`apply()` 对残留键硬抛
      //    （rc 线在 `lib/index.js:355` 的 `Object.hasOwn`）⇒ 那条尾巴无处可挂。
      //
      //    **被接受的退化**：经 `subagent_fork` 派出的 child **继承父 agent 的 preset 组合**
      //    （fork provider 自报 `capabilities.agentPreset = false` —— ⚠️ **这条只在 rc 线上实读；
      //    `0.2.2-alpha.2` 未单独读**：矩阵的十项与附录 B 的 sha 表都不含
      //    `dsh-subagent-fork-in-process`，所以不要把它写成「两版都一样」）⇒ 那四个 `schedule_*`
      //    名字**无法**在这条路径上被声明式 deny。0.1.9 声称它能，而那个声称在
      //    alpha.4 / alpha.5 上**已经**是假的；本轮只是把这句话改成真的。
      //    影响面：Lead 主动 fork 出来的 child 会看到提醒工具；9 条**具名** lane 不受影响
      //    （它们的 `official` 不含这四个名字 ⇒ gate 剥掉；而且 lane 自己 fork 不了 ——
      //    `subagent_fork` 也不在任何 `official` 里）。
      //    ⚠️ 要彻底关掉这个口子只能靠运行时机制（对 fork child 施加同一个 gate），需要新增
      //       插件文件，不在本轮面内。
      { id: forkControlRowId,           name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'fork', toolName: 'subagent_fork' } },
      ...LANES ] } ]
