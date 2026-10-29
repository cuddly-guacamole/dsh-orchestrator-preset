<div align="center">

# @quill507/dsh-orchestrator-preset

**为 DeepSeek Harness 的薄壳 agent preset**

*aegis 方法论层负责方法 · 自研编排层负责委派*

[![npm](https://img.shields.io/npm/v/@quill507%2Fdsh-orchestrator-preset?style=flat-square&label=npm&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
[![downloads](https://img.shields.io/npm/dm/@quill507%2Fdsh-orchestrator-preset?style=flat-square&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.3_%7C_0.2.1--rc.4_%7C_0.2.1--rc.5_%7C_0.2.2--alpha.2-4c6ef5?style=flat-square&labelColor=454a54)
[![license](https://img.shields.io/badge/license-MIT-3da639?style=flat-square&labelColor=454a54)](https://opensource.org/licenses/MIT)

[English](README.md) · [归属与来源](THIRD_PARTY_NOTICES.md) · [Issues](https://github.com/cuddly-guacamole/dsh-orchestrator-preset/issues)

</div>

DeepSeek Harness 的薄壳 agent preset：**aegis 方法论层**（上游、运行时消费、未改动）加上一个**自研编排层** —— 九条命名 lane、声明式工具边界、常驻路由 section、随装配切换的 persona，以及以磁盘证据为准的完成门。

仓库根目录**就是** bundle 本身：没有 `bundle/` 子目录，这里的文件即是将被安装的文件。

---

## 设计

> **本节（对应英文版的 Design 一节）是本 preset「是什么、怎么工作」的当前且完整的权威。**
> 本仓库**不含**另立的设计规范：它所源自的完整设计草案 —— 约 280K 的设计史、决策轨迹与被
> 否决的备选方案 —— **不在此分发**。它被留存下来，而本节即是取而代之的设计说明。
> 若你需要更深的推理，可以索取；此处不给链接，是因为链向一个本仓库并不包含的文件，会看起来
> 很权威、点下去却是错的。

### 它是什么

DSH 没有「一个会派活的 agent」这种概念。preset 声明一组工具和一份 persona，而这套词汇里没有「这件事该别人做」的说法。本 preset 补上这一层：协调者不写代码、不搜代码库、不自审 —— 它把每块工作路由给一条**被声明为有权做它**的 lane，再用磁盘上的证据来判定结果。

### lane 与它们的工具边界

九条 lane 是 preset 自己的行：`planner`、`scout`、`archivist`、`seer`、`reader`、`analyst`、`auditor`、`wright`、`forge`。每条自带 persona 文件与自己的 Agent Preset，后者里的 `lane-gate` 插件持有该 lane 的**允许名单**（`official`），其余各行挂着那份名单点到的官方工具插件 —— 所以能力边界是**声明式的，不是建议式的**。允许名单是排他的：只读 lane 的 `official` 是 `read`、`read_image`、`glob`、`grep` ⇒ `write`、`edit`、`todo_write`、`bash`/`pwsh`、四个提醒工具、其它所有 lane 的派发工具、面向 lead 的子代寻址工具，不是被收窄，而是**不在它的工具面上**。用「授予」而不是「拒绝」，正是它阻止 lane 重新滑回协调者角色的方式：没人授予过的能力不会自己漂回来。

`lane-composition.mjs` 补上宿主留下的一个缺口。Team 装配给 lead 的 `send_message` / `list_agents` / `interrupt_agent` 是按**名字**寻址 teammate 的，根本够不到 `subagent_*` 子代 —— 于是用 `subagent_*` lane 派活的 lead 没有任何工具能列出、续接或中断它们。本 bundle 恰好以另外三个名字（`subagent_children`、`subagent_send`、`subagent_interrupt`）注册了这三个动作，按**持久 agent id** 寻址。两套 id 命名空间，永不混用。三个名字是**全局**注册的，而且是刻意的：`tools.restrict()` 在全局注册表上解析名字，作用域内注册会让每条 lane 的 deny 项失效，进而拖垮整族 lane。

### 路由 section

`routing-sections.mjs` 注册四段**静态**文本，由宿主的 `systemPrompt` registry 每一轮重新装配：域归属表、触发词裁决表、少量常设判断的索引，以及 MCP 纪律。它们是静态常量，这是刻意的 —— 动态的 system 前缀会让整个会话缓存全量失效。

「唯一归属者」正是要点。MCP 纪律只存在于一段里，orchestrator persona 只留一个指针，委派函可以**引用**它但绝不可复述它。编排层自身的内容也守同一条纪律：orchestrator persona 明确声明不承载 lane 名册与 MCP 规则 —— 因为第二份副本就是第二个归属者。

**四个 `orch-*` 技能名是承重的，改名是「改两个文件」的活。** `routing-sections.mjs` 与 `personas/orchestrator.md` 都按名字显式引用了 `orch-evidence-protocol` 与 `orch-delegation-brief`，而路由表的行是按那个**精确字符串**解析的。把技能目录和 frontmatter 改名、却没改这两处引用，那一行就会指向一个没有东西提供的名字 —— **而这是静默失败**：匹配不到任何技能的路由行，只是永远不触发而已。`node tools/gen-cordis-patch.mjs` 与 `node tools/audit-personas.mjs` 能抓住半途而废的改名；两者都不会自动运行，所以动过技能名之后，跑一个。

`orch-` 前缀本身不是装饰：这些技能落进的是一个**还装着该机器已装其它技能的注册表**，所以不加前缀的 `evidence-protocol` 就是一个等着撞名的名字。

### 证据与状态

完成是一个文件，不是一句话。只有当 `.dsh/evidence/<task-id>-<slug>.md` 存在、非空、且**末行**恰有一条锚定的判定行时，一个任务才算完成。每个回合触碰的每条路径在完成时会被归类为 `in_scope` / `out_of_scope` / `undeclared` / `illegal`，凡非 `in_scope` 一律拒绝完成声明。需要跨会话存活的状态 —— lane 台账（`.dsh/state/lanes.md`）、方向级认领（`.dsh/state/claims.md`）、目标帧（`.dsh/goals/<slug>.md`）—— 都落在文件里，以便任何主张都能对着别的写入者也能看到的那个文件来核对。

### 与上游 aegis 的区别

aegis 提供**方法**：怎么写计划、怎么做严格 TDD、怎么系统调试、怎么评审、怎么在声称完成前验证。它是一套技能库，并假定存在单一协调者亲自执行。

本 preset 提供**拓扑**：谁做什么、在什么工具限制下、拿什么证据。两者正交且互补 —— aegis 技能是被**路由到** lane 上，而不是就地执行。本 preset 补上 aegis 结构上给不了的东西：一切以「存在多个 agent」为前提的东西 —— lane 台账及其三态、带停滞判据的方向级原子认领（用于跨会话所有权），以及独立评审规则。它们不是对 aegis 的扩展，而是另一个维度；**没有修改任何 aegis 技能来迁就它们**。

---

## 来源：哪些是上游的，哪些是在这里实测的

这件事值得比通常更较真，因为一个 preset 就是一堆关于别人运行时的主张。

**请把下表里的版本号读成「测量地点」，不是支持声明。** 受支持的宿主集合是四个版本，`0.2.1-rc.3`、`0.2.1-rc.4`、`0.2.1-rc.5` 与 `0.2.2-alpha.2` —— 见[宿主版本门](#0-宿主版本门)。下面若干行引用了 `0.2.0-rc.2`、`0.2.1-alpha.1` … `0.2.1-alpha.5`、`0.2.1-rc.2`；每一个都只是某次测量的发生地，而它们**全部不受支持**。保留它们，是因为它们是产物至今仍然体现的那些决定的证据 —— 哪些键缺失、为什么需要一道门、为什么 MCP 名字是按机器算而不是写死的。记录**当前**受支持宿主事实的行会明确说出来。

| 主张 | 状态 |
|---|---|
| bundle 通过 `package.json` 里的 `dsh.bundle.patch` 字段声明自己的 patch，例如 `"patch": "./cordis.patch.yml"`。 | **上游契约。** 在已发布的 `@deepseek-ai/dsh-base` manifest 里逐字如此，那份 manifest 还把这份 patch 作为一个 subpath 导出。 |
| 靠后的 patch 层胜出，且 patch 是**整行替换**而不是深合并 —— 所以一个覆盖 `config` 的行必须重述它需要的每一个键。 | **两次独立印证。** |
| 精确的层序：先按 `dsh.profile.bundles` 的顺序应用各 bundle patch，然后是 profile 自己的 `cordis.patch.yml`，然后是 `$DSH_HOME/cordis.patch.yml`，最后是每个 `--patch` 覆盖层。 | **在宿主 0.2.0-rc.1 上实测。** 未对着上游文档确认。 |
| 一个 profile 位于 `~/.dsh/profiles/<name>/`，内含 `cordis.yml`、`cordis.patch.yml` 与 `package.json`。 | **在宿主 0.2.0-rc.1 上实测。** 未对着上游文档确认。 |
| `config.selectedDefault` 在 preset 的 schema 里，且是生效的那个值；schema 里还有 `config.default`，而 `defaultId` 解析 `selectedDefault ?? default`。 | **在宿主 0.2.0-rc.1 上实测**，对着 `@deepseek-ai/dsh-agent-preset-registry`。 |
| `{{cwd}}` 是一个已注册的提示词变量；引用一个未知的 `{{…}}` 会在装配期抛错。 | **随版本而异，且逐版实测**（历史测量 —— 点名的两个版本都不受支持）。在 `0.2.0-rc.2` 上已注册（`dsh-agent-loop` 注册 `provider`/`model`/`cwd`），**自 `0.2.1-alpha.2` 起不存在**（只有 `provider`/`model` —— 已在已装的 `0.2.1-alpha.5` 上复核，并在四个受支持版本上各复核一次：`dsh-agent-loop` 的变量表在 rc 线 `:1591-1592` / `0.2.2-alpha.2` `:1345-1346`，都没有 `cwd`）。已对着已装宿主自己的 `renderPrompt` 复现：`unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`。上游 `dsh-system-prompt/README.md` 现已要求使用者删掉这个子句。`suffix` 这个字段本身**仍在** `dsh-persona` 的 `Config` 里；消失的是它引用的那个变量，所以 suffix 只能是空的 —— 这就是 `persona` 行不写 suffix 的原因。见[宿主版本门](#0-宿主版本门)。 |
| `tool-subagent` 的 `Config` 接受 `backgroundMode`。 | **随版本而异**（历史测量 —— 点名的版本都不受支持）。在 `0.2.1-alpha.1` 上存在（`lib/index.js:257`），**自 `0.2.1-alpha.2` 起不存在**。schemastery 容忍未知键，所以这次移除是静默的 —— 已把两种写法都喂给已装 schema 核过。continuable 现在由 provider 的 `prepareContinuable` 决定：spawn provider 与 rc 线的 fork provider（`dsh-subagent-fork-in-process`）都实现了它 —— ⚠️ **只在 rc 线上实读；`0.2.2-alpha.2` 未对该 fork 包单独读**（契约矩阵不含这个包）。⇒ lane 行**完全不写** `backgroundMode`。 |
| `standard` preset 骨架是「有哪些行」的权威。 | **逐版实测**（历史测量 —— 点名的版本没有一个受支持）。它从 162 行（`0.2.0-rc.2`、`0.2.1-alpha.1`）缩到 137 行（`0.2.1-alpha.2`），去掉了 `tool-ralph`、`tool-subagent-codex` 与 `tool-subagent-claude-code`；`tool-schedule` 是新增的 —— **在 alpha.1 上有，在 rc.2 上没有**。已在已装的 `0.2.1-alpha.5` 上复测：128 行，仍带 `time-context` 与 `tool-schedule`，仍没有那三条被删的行。**四个受支持版本逐一读过：**真正点名的骨架是 `dsh-web-app/presets/standard.patch.yml` —— rc 线 128 行 / 33 row（rc.3、rc.4、rc.5 逐字节相同），`0.2.2-alpha.2` 上 127 行 / 32 row（正好少一条 row：`tool-subagent-list-agents`）。`time-context`（`:19`）与 `tool-schedule`（`:35`）在四个版本上都是**那份文件**里的行；`dsh-base/cordis.patch.yml` 里**没有**它们，那里的一条是 `working-directory`（`:166`）与 `tool-working-directory`（`:169`）。 |
| `@deepseek-ai/dsh-tool-schedule` 在每一个受支持的宿主上都存在。 | **现在为真 —— 因为受支持集合就是 rc.3 + rc.4 + rc.5 + alpha.2 这四版。** 每一台受支持宿主都自带它，且是精确的 lockstep pin：`dsh@0.2.1-rc.3` 依赖 `@deepseek-ai/dsh-tool-schedule@0.2.1-rc.3`，rc.4、rc.5 与 `0.2.2-alpha.2` 各自钉自己那一版。在旧的**三版**集合下这条是**假的** —— npm 上它只发布在 `0.0.1-rc.2`（另一代）以及 `0.2.1-alpha.1` … `0.2.1-alpha.5`，而 `dsh@0.2.0-rc.2` 不依赖它（rc.2 的提醒工具是那个*可选、默认关*的 `dsh-experimental-schedule-bundle`，它插入 `time-context`/`schedule`/`ui-schedule`，而**不是** `tool-schedule`）。那段历史正是这四个名字过去必须放在条件尾巴里、现在可以静态列出的原因。 |
| deny 名单里点了一个宿主没注册的工具，会在派发时响亮失败，而不是在挂载时。 | **在 `0.2.0-rc.2` 与 `0.2.1-alpha.2` 上实测，行为一致**（历史测量 —— 两个版本都不受支持）。`tools.restrict()` 抛 `names unknown global tool`（rc 线 `dsh-tools/lib/index.js:2991-3004` / `0.2.2-alpha.2` `:453-466` —— 方法体相同、消息文本相同，只是行号不同），而 `dsh-subagent` 在组合一个 child 时不加保护地调用它（`lib/index.js`：rc 线 `:401` / alpha.2 `:396`）。这正是 `mcp_*` 那些名字必须**按机器算**、不能写成字面量的原因：一份硬编码清单会在缺某个 server 的机器上弄坏每一次派发。而 `schedule_*` 现在可以静态列出，正是因为**每一台**受支持宿主都一定有它们。拥有 `restrict()` 的那个类在 alpha.2 上由 `ToolRuntime` 改名 `ToolsService`，但它注册的服务键仍是 `"tools"`，所以走 `ctx.tools` 的调用点不受影响。 |
| `tool-subagent` 的行 `Config` 仍然接受 `persona` 与 `toolFilter`。 | **在每一台受支持宿主上都为假。** `dsh-tool-subagent` 的 `Config` 字面量两个键都不声明（rc 线 `lib/index.js:311-324` / `0.2.2-alpha.2` `:301-315`），且 `apply()` 在挂载期对两者硬抛（rc 线 `:355` / alpha.2 `:346` —— 文本逐字相同，只是行号移了）。`Config` 的**键集**在集合内也不一致：alpha.2 把 `modelSelectionSettings` 换成了 `modelSelection` + `modelDiscovery`，而 schema 不认识的键是被**静默丢弃**而不是被拒 —— 这正是那道门按版本判、而不按 `Config` 形状判的全部理由。本包两个键都不写。⇒ 因此只提供**一种** lane 形态，即 Agent-Preset 形态 —— 见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。 |
| Agent Preset 能表达「排除某个工具」。 | **假的，而这正是本包新增 `lane-tool-gate.mjs` 的原因。** preset 的 `plugins[]` **只能加不能减**。`0.2.1-alpha.3` 上实测（历史测量；该版本不受支持）：只挂 persona 的 preset 让 child 拿到 **25** 个工具（含 `edit`/`bash`/`send_message`/`interrupt_agent`），而在 preset 里把 `tool-bash` 标 `disabled: true` 之后 `bash` **依然在**（23 个工具）。`toolFilter` 在那条路径上也不可达：全新派发只带 `composition: { agentPreset }`（`dsh-subagent/lib/index.js:1452`），而 `:395` 那个唯一消费点读的字段是**恢复**路径从持久化 descriptor 里读回的（`:2177`）。 |
| `0.2.1-alpha.5` 没有改任何本包依赖的东西。 | **对着它自己那份已发布 tarball 实测，不是从邻居推的**（历史测量 —— alpha.4 与 alpha.5 都不受支持）。alpha.4 → alpha.5 只差两个包：`dsh-tool-subagent` 差**一句提示词**（`lib/index.js:516` 的派发提示丢了「end your turn instead of sleeping」那半句），`dsh-tools` 差 **71 行、且全部落在 `run_code` 的参数描述里**。本包真正依赖的面**逐字节相同**：`tool-subagent` 的 `Config` 字面量（`:311-324`）、其 `apply()` 的拒绝循环（`:355`），以及 `dsh-tools` 的 `guard()` / `guardReason` / `restrict()` / `defineTool`（两版出现次数一致）。`dsh-subagent`、`dsh-agent-preset`、`dsh-agent-preset-registry`、`dsh-persona`、`dsh-agent-loop`、`dsh-base`、`dsh-tool-schedule` 除各自的版本号外逐字节相同。保留它是作为「alpha.5 加入集合时无需改门」的记录；那个集合已不存在。 |

DeepSeek Harness 采用 MIT 许可：[`github.com/deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)。同名但无关的项目，不是本仓库里任何东西的来源。

---

## 仓库结构

| 路径 | 是什么 |
|---|---|
| `cordis.patch.yml` | **生成物**，preset 的各行。勿手改，见下。 |
| `tools/preset-declaration.mjs` | preset 各行的**唯一真源**。 |
| `tools/gen-cordis-patch.mjs` | 由声明生成 `cordis.patch.yml`。 |
| `tools/audit-personas.mjs` | persona 文件的静态审计（对照一个被排除的上游语料的原创性阈值）。 |
| `plan-aware-persona.mjs` | 每次装配在 Orchestrator 与 Planner 之间切换 persona。 |
| `routing-sections.mjs` | 四段常驻路由 section。 |
| `lane-composition.mjs` | 三个按持久 agent id 的子代寻址工具。 |
| `lane-tool-gate.mjs` | lane 的工具闸：`tools.restrict({ deny })`，挂在每条 lane 的 Agent Preset 内 —— 因为 preset 表达不了「排除某个工具」。`deny` 由**运行时全局已注册名减去该 lane 的 `official`** 现算，并在 `tools/change` 上重算 ⇒ **挂载之后才注册的工具同样被挡住**。见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。 |
| `personas/` | 十份 persona：orchestrator、planner，以及每条 lane 一份。 |
| `skills/` | 四个自研技能。本目录就是它们的权威清单。 |
| `extensions/dsh/` | 本包的两个插件：技能 provider，以及 aegis 前缀桥。 |
| `docs/` | **不分发。** 设计史被留存；上文的设计一节即是规范。 |
| `README.zh.md` | 中文 README。同样的内容，同样的义务。 |
| `install.sh` | 把下面这些装进一个 DSH home。 |
| `tools/verify-install.sh` | 十三项只读检查：preset 已安装且已被选中。 |
| `LICENSE` | MIT 许可 + 第三方归属。 |

**改 preset 的正确姿势**：`cordis.patch.yml` 带「DO NOT EDIT BY HAND」头，是生成出来的。改 `tools/preset-declaration.mjs`，然后：

```sh
node tools/gen-cordis-patch.mjs
```

生成器需要一个用来合并的骨架 patch：依次找 `--skeleton <path>`、`$DSH_SKELETON`、宿主自己的 `standard.patch.yml`，都找不到就**拒绝编造**。本仓库里的 `cordis.patch.yml` 与该命令从已提交声明产出的结果逐字节一致。

---

## 安装

安装方式是 **`link:` 依赖**，本包**同时也发布在 npm 上**（`@quill507/dsh-orchestrator-preset`）。`package.json` **没有** `"private"` 键。profile 用**与 registry 相同的名字**投影该 bundle ⇒ 本地投影与已发布的包**只能靠「指向哪里」区分，不能靠名字**（这正是 `tools/verify-install.sh:96-105` 记录的设计顾虑；统一到 npm 名是用户知情的例外 —— 代价与为何被接受，见[发布到 npm](#发布到-npm)）。本包**不**声明任何 `dependencies`：运行时一切由宿主提供。但它**声明了 `peerDependencies`**，四条全部标 `optional` —— 这样「我们测过什么」被写了下来，而任何安装都不会因为它失败：

| 包 | 版本声明 | 为什么 |
|---|---|---|
| `@deepseek-ai/dsh-skill-filesystem` | `0.2.1-rc.3 \|\| 0.2.1-rc.4 \|\| 0.2.1-rc.5 \|\| 0.2.2-alpha.2` | 本 bundle 挂载的 provider |
| `@deepseek-ai/dsh-tools` | `0.2.1-rc.3 \|\| 0.2.1-rc.4 \|\| 0.2.1-rc.5 \|\| 0.2.2-alpha.2` | `defineTool`，`lane-composition.mjs` 用 |
| `@deepseek-ai/cordis` | `4.0.5 \|\| 4.0.6-alpha.1` | 插件契约 |
| `@deepseek-ai/schemastery` | `3.18.5 \|\| 3.18.6-alpha.1` | 设置卡片据以生成的 `Config` schema |

这一列里没有范围。两个 dsh 包写的是**支持集本身** —— 与[宿主版本门](#0-宿主版本门)那张表、以及 `install.sh` 自己那份清单是同四个名字、同一顺序。`cordis` 与 `schemastery` 写的是**两个**取值而不是一个，因为支持集横跨它们的两代：rc 线上是 `4.0.5` / `3.18.5`，`0.2.2-alpha.2` 上是 `4.0.6-alpha.1` / `3.18.6-alpha.1`，没有任何一个取值能同时为四版作真。`||` 仍然是**枚举而不是范围**：它点名的就是写下来的那些版本，解析到别的宿主按构造即出约。写成 `>=0.2.1-rc.3` 那样的真范围会顺手把命名版本**之间**的东西、以及已退出集合的 `0.2.1-rc.2` 也宣称进来，而那正是没人测过的部分；这里没有带可供下限去指。

**诚实的附注：npm 对这一切没有强制力 —— 但宿主有，而且是在两个地方，其中只有一处叫 `disabled`。** 四个 peer 全标了 `optional`，所以 npm 本身不会因为解析到别的宿主就拒绝安装，也不会给出任何有人会当真的警告。真正发生什么，取决于宿主先碰到哪一道屏障：

- **加载期：peers 是那道屏障。** 宿主自己的 loader 拿本包的 `peerDependencies` 与自己的版本比，覆盖不到就**整包跳过**：

  ```
  dsh: skipping profile bundle "@quill507/dsh-orchestrator-preset": Error: Plugin @quill507/dsh-orchestrator-preset@0.2.1 is incompatible with dsh 0.2.2-alpha.2: requirements {"@deepseek-ai/dsh-skill-filesystem":"0.2.1-rc.2 || 0.2.1-rc.3","@deepseek-ai/dsh-tools":"0.2.1-rc.2 || 0.2.1-rc.3"}. Running it may cause crashes or data loss. … Exact-version exemption: not active.
  ```

  这一行取自 npm `0.2.2-alpha.2` 树、带着**上一轮** peers 的一次运行；可复跑：`dsh --profile <name> --dump-config 2>&1 | grep -i "skipping profile bundle"`。`requirements` 对象要读细，因为它的范围是**确切**的、不是「所有 peer 都查」：它点名的是那两个 `dsh` 包，既没有 `@deepseek-ai/dsh-tool-subagent`，也没有同样标了 `optional` 的 `cordis` / `schemastery`。这一道一旦触发，什么都不挂，因为**根本没有组合** —— 十九条行没走到「求值」那一步。豁免通道确实存在（`dsh plugin allow-version` 或插件管理器），记在这里是因为报错自己点了它，**不是**本文推荐的路径。
- **挂载期：产物自己的门是那道屏障。** peers 覆盖得到宿主时，bundle 被组合，每条受门行的 `disabled` 表达式把宿主的 `@deepseek-ai/dsh-tool-subagent` **版本**与 `SUPPORTED_HOST_VERSIONS` 比 —— 见[宿主版本门](#0-宿主版本门)。peer 放行、而集合不含的那台宿主，装得上、什么都不挂。

**两道屏障的判据不同，是有意的。** peers 那道是**semver 范围式** —— 它问「这台宿主被覆盖了吗」，而这个字符串在 loader 眼里是一串区间的并。这里要分清两句话：我们写下的字符串是逐字枚举（没有 `>=`），loader 则拿它当区间的并去判覆盖；两者在枚举点名的那些版本上给出同一答案，只可能在**命名版本之间**分开 —— 而那正是本 preset 拒绝声张的区域。`SUPPORTED_HOST_VERSIONS` 是**逐字成员式**：它问「这是不是有人真读过的那一版」。所以「范围放行、成员拒绝」是合法且**有意**的组合，不是矛盾：范围管**加载**，成员管**挂载**。`install.sh` 的版本门是成员判据的第三份拷贝，仍是**可选的** —— 用 `npm install` 安装、或手写 `link:` 依赖的人根本不会跑到它。

**这就是为什么本轮的 peers 改动是承重的，不是记账。** 旧枚举停在 `0.2.1-rc.2 || 0.2.1-rc.3`，而 npm `latest` 已经到 `0.2.1-rc.5`、`next` / `alpha` 通道到了 `0.2.2-alpha.2` —— 在这两个渠道上，bundle 不是「挂载时被门关掉」，而是**从未被加载**，那十九条表达式连回答的机会都没有。把枚举扩到四个名字，才让那些用户够得到 `disabled` 表达式；有了它，同一台宿主会把 bundle 组合出来、门回答 false —— 也就是[第 5 节](#5-接入-profile)那段读数所在的树。

**产物里为什么会有宿主门 —— 历史记录。** 有两次宿主发布打断了本包所依赖的东西，而它们打断的方式**完全不同**，这正是产物里存在 `disabled` 表达式的原因。这些是测量，保留是因为它们解释了产物的形状；它们**不是**支持声明，其中点名的版本没有一个受支持：

- **`0.2.1-alpha.2` 拿掉了两个键。** `{{cwd}}` 不再是已注册的提示词变量，`backgroundMode` 也从 `tool-subagent` 的 `Config` 里消失了。这两处删除**可以被吸收**：本包不再写它们中的任何一个，得到的 `persona` 行与 lane 行在受支持宿主上合法。
- **`0.2.1-alpha.3` 拿掉的是机制，不是一个键。** `persona` 与 `toolFilter` 整体离开了 `tool-subagent` 的行 `Config`，而 `apply()` 现在只要见到其中一个就硬抛。这一处**无法被吸收**：替代品（Agent Preset）在 alpha.3 之前根本不存在，而且它**完全无法表达「排除某个工具」**。所以 lane 行走 Agent-Preset 形态，并由该形态带一个自写的闸插件。见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。

宿主版本之间的差异**没有一处**是被静默容忍的（见[来源](#来源哪些是上游的哪些是在这里实测的)），因为一个只在自己的最新宿主上正确的 preset，在其它任何宿主上都**不**受支持 —— 而一个只在自己的最新宿主上正确、**却看起来加载成功了**的 preset，比一个直接失败的更糟。

**提醒工具只属于 Lead，而这一点现在是静态声明。** 持久提醒（`schedule_create` / `schedule_list` / `schedule_update` / `schedule_delete`）来自 `@deepseek-ai/dsh-tool-schedule`。**每一台受支持的宿主自己都带它**，且是精确的 lockstep pin —— `dsh@0.2.1-rc.3` 依赖 `@deepseek-ai/dsh-tool-schedule@0.2.1-rc.3`，rc.4、rc.5 与 `0.2.2-alpha.2` 各自钉自己那一版 —— 所以挂载它的那一行是一条**裸行**，与官方骨架同形，不带 `disabled` 表达式。那四个名字只出现在 Lead 自己的工具面上：九条 lane 的 `official` 集合**都不含**它们，闸按默认剥掉，而不是靠逐条列举。

这是对一个更早的条件写法的简化，而它之所以安全、之所以诚实，是同一个理由：本 bundle 早先的版本在挂载期求值宿主，只在那个包解析得到的地方加上这四个名字，因为 `0.2.0-rc.2` 没有 `@deepseek-ai/dsh-tool-schedule`。支持集里每一版都自带该包之后，「这台宿主上解析得到吗」已经不是一个值得问的问题 —— 静态名单正是「每一台受支持机器都有」的正确表达。

**一处已知、已接受的退化：经 `subagent_fork` 派出的 child 在每一台受支持宿主上都可以调用提醒工具。** 这是对 0.1.9 一句声称的更正，而那句旧声称在 `0.2.1-alpha.4`/`alpha.5` 上**已经**是假的 —— 它不是本轮引入的回归，也**没有**被 fork 行的 `disabled` 表达式修掉：那个表达式只在**不受支持**的宿主上关掉这一行，而在那种宿主上本来就什么都不挂。在**每一台**受支持宿主上这一行都是启用的，退化照旧成立。`subagent_fork` 控制行**不带 `toolFilter`**、也没有等价的 deny 名单，因为**每一台**受支持宿主都**硬拒那个键**（`dsh-tool-subagent/lib/index.js:355`），而 fork provider 自报 `capabilities.agentPreset = false` —— ⚠️ **这一条只在 rc 线上实读；`0.2.2-alpha.2` 未对 `dsh-subagent-fork-in-process` 单独读**（契约矩阵不含这个包）—— 并继承父 agent 的组合 ⇒ **不存在**任何声明式路径去收窄一个 fork 出来的 child。后果如实写明、不作淡化：**经 `subagent_fork` 创建的 child 可以调用提醒工具，尽管九条具名 lane 不能。** 影响面是有界的 —— 九条具名 lane 经那个闸 deny 这四个名字，且 lane 自己 fork 不了（它们的 deny 里含 `subagent_fork`）—— 但 Lead 自己的 fork 在这一边界之外。要关掉这个口子只能靠运行时机制（对 fork child 施加 guard），那需要新增插件文件；不在本版范围内。

`tools/verify-install.sh` 的 check 13 会对着**模拟**的机器求值 lane 闸的 deny 表达式与 `disabled` 探针，所以一个按机器漂移的名字若溜回静态名单，会在那里响亮失败，而不是在下一次派发时。

### 0. 宿主版本门

```sh
dsh --version          # 低于 0.2.1-rc.3 时 install.sh 拒绝继续
```

这是 `install.sh` 内部的硬检查。**下限与支持集不再是同一个值**，而这是有意回到本文档曾经反对过的那种区分：下限是**最低**的受支持版本 `0.2.1-rc.3`，支持集则是下面那张表里的四个版本。高于下限、却不在支持集里的宿主同样**什么都不挂**，但**在默认世界里它根本不会被组合**：宿主自己的 loader 发现这个版本不被 `peerDependencies` 覆盖，就把整个 bundle 跳过 ⇒ 产物那道 `disabled` 门**根本没有机会运行**。只有你按版本豁免了 peers（`dsh plugin allow-version`）之后，bundle 才会被组合，那时产物自己的门才回答 `true`、把十九条全部禁用。两段式、同一个结局；`install.sh` 会把这件事明说出来 —— 但它判的是**下限**，不是集合。

这道门是**下限**，不是等值判定 —— `install.sh` 拒绝**更旧**的宿主、放行更新的宿主，因为「未来的宿主」不是一道下限能裁决的东西。真正决定本 bundle 在那种宿主上能不能用的，按顺序是**宿主自己的 loader（peers）**与**产物自己的 `disabled` 表达式**（见下一段），不是这道门。

**受支持的集合恰好是四个宿主版本：**

| 宿主版本 | npm dist-tag | 你会拿到什么 |
|---|---|---|
| `0.2.1-rc.3` | 上一张表撰写时为 `next`；撰写时桌面 app 自带的那棵树 | 受支持 —— 从上一轮的集合延续下来，已按它自己的面实测（见下） |
| `0.2.1-rc.4` | 发布在 rc.3 与 rc.5 之间，本身没有 dist-tag | 受支持 —— **与 rc.3 逐字节相同**：两份骨架与本包读到的每一个宿主 `lib/index.js` 的 sha256 全同（见下） |
| `0.2.1-rc.5` | 撰写时为 `latest` | 受支持 —— **与 rc.3 逐字节相同**，同一份证据 |
| `0.2.2-alpha.2` | 撰写时为 `next` / `alpha` | 受支持 —— **结构不同**，不只是标签不同：十项契约在它上面逐项读了一遍，然后**真的挂载了一次**（见下） |

四个版本，不是一条带：四版都被逐字点名，产物里那道门是**成员判断**而不是 semver 范围。这是有意的 —— 范围会顺带放行两条命名版本**之间**的任何东西，而那正是没人测过的部分。三个 rc 名字是最清楚的一例：它们逐字节相同，所以一次测量能为三个名字作证；而这**不是** `>=` 可以安全的理由 —— 同一个范围会连同已退出集合的 `0.2.1-rc.2` 一起放进来。

其余一切**都不受支持，而且不兼容** —— 不只是「未测」。这涵盖每一个 `0.2.1-alpha.*`、`0.2.1-rc.1`、`0.2.0-rc.2`、`0.2.1-rc.2`（下限移到 rc.3 时它退出了集合），以及比 `0.2.2-alpha.2` 更新的版本。没有「大概没问题」那一档，也没有部分分：四个版本，边界就是契约。

**rc.3 为什么在这张表上，以及这里的「实测」指什么。** 这个声称不是「rc.2 能用，所以 rc.3 也能用」。四条事实是直接从一个真实的 `0.2.1-rc.3` 安装里读出来的（2026-10-24）：产物点名的每一个官方插件行 —— 二十二个 `@deepseek-ai/*` 包，含 `dsh-tool-schedule` 与 `dsh-tool-subagent-control/list-agents` 这个子路径 —— 在 `0.2.1-rc.3` 上都解析得到；`dsh-tool-subagent@0.2.1-rc.3` 仍然声明 `agentPreset` / `allowedAgentPresets`、仍然不声明 `persona`（`lib/index.js:311-324`），这正是那道门的结构面；产物能被宿主自己的 patch 加载器解析，且十九条门的表达式保持为表达式；这十九条在那台宿主上全部求值为 **false**，也就是挂载。**没有**做的是把 rc.3 当作作者自己的日常宿主跑一整场会话：证据是解析、结构与门的求值，本文档就照实这么说，不往上取整。

**rc.4 与 rc.5 为什么在这张表上：在本包依赖的每一个面上，它们就是 rc.3。** 依据是逐字节相同，而不是在同一批面上再测一遍 —— 后者只是方便，而这是证据能取的最强形式。两份骨架（`dsh-base/cordis.patch.yml`、`dsh-web-app/presets/standard.patch.yml`）与本包读到的七个宿主 `lib/index.js`（`dsh-tool-subagent`、`dsh-tools`、`dsh-agent-loop`、`dsh-agent-tool-presentation`、`dsh-experimental-tool-agent-team`、`dsh-harness-dev-context`、`dsh-web-app`）在 rc.3 / rc.4 / rc.5 上 sha256 全同。manifest **不在**这份同一性之内，也没有这样声称：它们的 `package.json` 各不相同，也必须不同，因为版本串与 lockstep 依赖 pin 就写在那里面。声称的正是上面那一条 —— 本包读到的代码与骨架文件相同。逐字节相同意味着行号与文本都相同，所以三个名字靠同一批读数支撑 —— 这正是本文里那些行号只写一遍「rc 线」、而不写三遍的原因。

**alpha.2 为什么在这张表上：十项契约在它上面逐项读过。** 它是集合里唯一「不是换了个名字的同一个文件」的成员，所以它与 rc 线逐项比对 —— 同十项，每版一行，每一格都给行号。差异大部分是位移：`tool-subagent` 的拒绝循环、`dsh-tools` 的三个入口、`fs-search` 与 `web` 的注册行都移了。实质性的差异，以及各自对本包意味着什么：

- `dsh-tools` 的主类叫 `ToolsService`，不再是 `ToolRuntime` —— 但它注册的**服务键仍是 `"tools"`**，所以读 `ctx.tools` 的地方不受影响。
- `modeFor(scope)` 消失，改由 `selectExecutor(scope)` 承担（`:624`）。rc 线上有 `modeFor`（`:2862`）、**没有** `selectExecutor`。本包两个都不调。
- `tools.mode` 变成 `z.never()`（`:407`；rc 线上是 `z.union(['native','ptc']).default('native')`，`:2763`），所以在 alpha.2 上写 `tools.mode` 会在 **schema 校验阶段就失败**，而不是被忽略。本包写的那个 `mode` 属于 `tool-presentation` 行，不属于 `dsh-tools`，因此仍然合法。
- `tool-subagent` 的 `Config` 把 `modelSelectionSettings` 换成 `modelSelection` + `modelDiscovery`（`:301-315` vs rc 线 `:311-324`），而那里的未知键是被**静默丢弃**、不是被拒。这正是那道门按版本判、而不按 `Config` 形状判的理由。本包两个键都不写。
- `PresetSelectionConfig.validate(ctx)` 不再存在，所以配错的 `agentPreset` 从「mount 期报错」变成「运行期才出问题」。九条 lane 行都带一个 `agentPreset`；这是真实的行为差，随版本一并接受。
- `dsh-agent-tool-presentation` 整包标了 `@deprecated`（`:8`、`:19`、`:26`），而 base 骨架现在自己挂 `tool-executor-native`（`:497`）与 `tool-executor-ptc`（`:500`）。这是唯一咬到本包的差异：`tool-presentation` 行会把 native executor **挂第二遍**，所以它现在带一道**结构门** —— 见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。
- `cordis` / `schemastery` 在 `4.0.6-alpha.1` / `3.18.6-alpha.1` 上，而 rc 线是 `4.0.5` / `3.18.5`，所以两条 peer 声明都写两代取值，而不是钉死一个。

**而 alpha.2 不只是读过：它被真挂载了一次。** 在一棵隔离的 `DSH_HOME` 上、用 npm 的 `0.2.2-alpha.2` CLI，本包的行走完了组合并挂载，门给出的答案与本节所述一致：**十九条**受门控的行全部求值为 **`disabled: false`** —— 九条 lane 行、九条 lane preset 行与 `subagent_fork` 控制行，因为 alpha.2 在集合内。`tool-presentation` 行上的**结构门**求值为 **`true`** ⇒ 该行关闭，组合树里在的是宿主自己的 `tool-executor-native`（启用）与 `tool-executor-ptc`（`disabled: true`）。对启动日志全量扫 `error` / `warn` / `duplicate` / `already registered` / `EEXIST` / `conflict` ⇒ **零条**，也就是没有重复注册 —— 而重复注册正是那道结构门存在的理由。web app 真起来了并服务根页面：**HTTP 200、38,581 bytes**。

**这证明了什么、没证明什么。** 挂载并服务是一次真启动，不是论证 —— 但它不是一次对话：没有在它上面跑过 agent 会话，那需要模型 key 与运行时 API 路由。所以「产物在 alpha.2 上挂载、过门、能服务」是**实测**；「某条 lane 在 alpha.2 上完成过一次派发」在这里既未被证明、也未被证伪。至于 rc.3、rc.4、rc.5，证据仍如前述 —— 上面的 rc.3 逐面读数、rc.4/rc.5 的逐字节相同，以及[只有一种 lane 形态](#只有一种-lane-形态以及为什么)里作为历史保留的那次 rc.2 真启动 —— 这三版没有再跑一次真启动。

**不受支持的宿主上实际会发生什么。** 本 bundle 的九条 lane 行、九条 lane preset 行与 `subagent_fork` 控制行带的都是**同一个** `disabled` 表达式 —— 同一段文本、同一个极性。它解析宿主自己的 `@deepseek-ai/dsh-tool-subagent`，向上找到那个包的 `package.json`，读出 `version`，只问一个问题：**它是否在支持集里？** 任何其它取值 —— 更新、更旧、或另一个构建 —— 都让表达式为 **true**，而 true 就是 `disabled`：

| 宿主 | 十九条受门的行会怎样 |
|---|---|
| `0.2.1-rc.3`、`0.2.1-rc.4`、`0.2.1-rc.5` 或 `0.2.2-alpha.2` | **挂载** —— 产物为之而生的四台宿主 |
| **其余每一个版本**：`0.2.0-rc.2`、`0.2.1-alpha.1` … `0.2.1-alpha.5`、`0.2.1-rc.1`、`0.2.1-rc.2`，以及任何尚未发布的版本 | **什么都不挂**。默认世界里宿主 loader 先按 peers 把整包跳过，十九条表达式**根本不会被求值**；**只有**在你按版本豁免（`dsh plugin allow-version`）之后，这道门才回答 `true`、把十九条全部禁用 |

所以有**四个**受支持的宿主，其余一切都只有**一种**失败方式。本 preset **什么都不挂**：没有 lane、没有 lane preset、没有 fork 行，所以**根本没有任何委派路径**。它**不会**退回去挂一批没有收窄的 lane。fork 行在这里之所以关键：它是唯一一条**不经过 lane** 也能创建 child 的行，把这道门加到它身上，才让「完全没有委派」成立，而不只是「没有具名 lane」。这就是「已退役、不兼容」的含义，而它现在是**机械事实**而不是文档声明 —— 产物里的门与这里的文字按构造一致。

**三道屏障，按宿主碰到它们的顺序：加载期的 peers、挂载期的门、以及只有你用它才存在的 `install.sh`。** 值得说清哪道是哪道，因为它们互相重叠，而把「写下来的意图」误当成「被强制的约束」太容易了：

- 四个 `peerDependencies` 是**第一道**，而且它们**不是提示**：宿主自己的 loader 在它们覆盖不到自己的版本时把整个 bundle 跳过（那一行原样报错引在[安装](#安装)一节）。
- 产物自己的 `disabled` 表达式是**挂载期**那道屏障。**当它被求值时** —— 也就是 peers 覆盖了这台宿主、或 peers 已被按版本豁免 —— 它在挂载期读宿主版本，版本落在支持集之外就把每一条 lane 行关掉。默认世界里，peers 覆盖不到的 bundle 早已被 loader 在加载期整包跳过 ⇒ 这道门在那样的宿主上**根本不会运行**。
- `install.sh` 的版本门会拒绝低于下限的宿主，并会报告「高于下限但不在支持集里」的宿主。它是真的，但**是可选的** —— 只有走 `install.sh` 的人才会跑到它；用 `npm install` 或手写 `link:` 依赖安装的人根本不会执行它。

前两条里的那份清单：两个 dsh 包把支持集原样枚举出来（`0.2.1-rc.3 || 0.2.1-rc.4 || 0.2.1-rc.5 || 0.2.2-alpha.2`）；`cordis` 与 `schemastery` 枚举支持集所横跨的两代（`4.0.5 || 4.0.6-alpha.1`、`3.18.5 || 3.18.6-alpha.1`）。

**一处已接受的边界，如实写明。** 这道门并不总能读到版本。如果解析到的包没有可读的 `package.json` `version`（manifest 被改名或缺失），它会退回更早的结构判定：`Config = z.object({…})` 字面量里是否仍然声明了 `persona:`？在这条路径上旧契约宿主仍会被关掉，但一个**新契约**宿主若 manifest 读不出来，就会挂载。这是刻意的，理由在于代价的方向：对一个读不出来的宿主按失败关闭，会连同**受支持**宿主的 lane 一起拿走 —— 而那恰恰发生在安装方式略有不同的情况下，比它规避的残余更糟。所以这条回退是**尽力而为**的网，不是第二重保证 —— 不要把上面那张表读成「对 manifest 被改写过的宿主也密不透风」。它回退所依据的结构事实自 `0.2.1-alpha.3`（`persona` 离开 `Config` 那次）以来从未变过。

**这是刻意的失败方向。** **什么委派都做不了**的宿主是**看得见**的问题 —— 你立刻会发现委派不工作，而且产物完好、可以检查。它所换掉的那个选择更糟：九条 lane 在一个本包从未测量过的宿主上挂载，带着 Lead 的完整工具面，而正常会话里看不出任何异常。在「响亮的缺席」与「安静的过度授权」之间，产物选择响亮地失败 —— 对**每一个**非受支持的版本都是如此，不只是较旧的那些。

同一个表达式在解析不到那个包时也按失败关闭（fail-closed）处理，理由相同：读不到的宿主不是受支持的宿主。注意这一句与上面那条回退是同一句话的两面 —— 只要定不出**版本**，门就倾向 `disabled`；唯一例外是「新契约宿主 + manifest 读不出来」。

**同一台机器可以有两棵宿主树，而门读的是正在运行的那一棵。** `disabled` 表达式从宿主自己的 `baseUrl`（bundle 被加载时那个模块 URL）解析 `@deepseek-ai/dsh-tool-subagent`，所以它问的不是「这块磁盘上某处装的是哪一版」，而是**正在运行的那棵树是哪一版**。这样的两棵树可以并存，彼此都不知道对方：桌面 app 把自己的运行时装在自己的归档里（asar），而 npm 全局安装把另一棵放在 npm 前缀下。工作区与两者都不绑定。所以同一台机器、同一个工作区、同一个 bundle，换一种启动方式，可能落在不同的一侧 —— 而落在哪一侧决定的是**在哪一步停下**，不是「会不会报」：

- **集合外 + 默认世界**：loader 在加载期就不要这个 bundle，并打出一行 `skipping profile bundle "@quill507/dsh-orchestrator-preset": … is incompatible with dsh <版本> …`（原样全文引在[安装](#安装)一节）。什么都没被组合 ⇒ 十九条表达式**根本不会被求值**。
- **集合外 + 已按版本豁免**（`dsh plugin allow-version`）：这时 bundle 才会被组合，于是门在十九条上回答 `true` —— 九条 lane 消失，而**这一步自己不再追加第二条消息**。「静默」只是**豁免这条路径**的性质，不是普通宿主看到的样子。

两条只读命令能看出你站在哪一侧：

```sh
# 1. 按运行中的宿主会用的方式解析那个包，并打印它会读到哪个版本
node -e "const {createRequire}=require('node:module');const r=createRequire((process.env.DSH_HOME||process.env.USERPROFILE+'/.dsh')+'/');const p=r.resolve('@deepseek-ai/dsh-tool-subagent/package.json');console.log(p, r(p).version)"

# 2. 或者直接问宿主：每条受门行的 `disabled` 都会出现在组合出来的树里
#    （打印的是 `!!js` 表达式 —— dump 给源码，不给布尔值）
dsh --profile <name> --dump-config | grep -n 'disabled:'
```

第一条命令的效力完全取决于你交给它的解析根 —— 那个参数就是全部要点，它也正是门内部做的那个决定。第二条是宿主自己的组合视图，所以它同时能看出哪一层 profile 改了什么、哪一行**带门**、哪些宿主行是关着进来的；它需要 `--profile <name>`（这个参数必填，没有默认值），且只对启动器能组合的 profile 名有效 —— `desktop` 由 Electron 托管、会拒绝 `--dump-config`，这也是 `tools/verify-install.sh` 改走宿主自己的 loader 去组合、而不是调它的原因（见[验证安装](#验证安装)）。

`install.sh --check` 只跑版本门，不写任何东西；它会报出下限、支持集，以及这台宿主站在支持集的哪一侧。

**有两个键没能通过那次 config 核对，本包现在不再写它们。** 记在这里，因为两者都是**静默**失效的 —— 而静默恰恰是 config 键唯一有意思的失效方式；也因为它们至今仍是「每一台受支持宿主上为何缺这两个键」的理由：

| 键 | 它去了哪 | 为什么不算能力降级 |
|---|---|---|
| `persona` 行上的 `suffix: 'Your working directory is {{cwd}}.'` | `{{cwd}}` 在 rc.2 与 alpha.1 上曾是已注册的提示词变量，在 **alpha.2 及更新版本上不是**（实测，见下方注），在四个受支持版本上也都不是。`dsh-system-prompt` 对未知变量是**抛错**，所以这不是「少了一句话」，而是**提示词装配期的硬失败，发生在任何模型请求之前**。上游现已直接要求使用者删掉这个子句。字段本身 —— `dsh-persona` 的 `Config` 里的 `suffix` —— **仍然在**；消失的是它引用的那个变量。 | 目录由 `dsh-working-directory` 服务供给 —— 它自 rc.2 起就在 `dsh-base` 骨架里，alpha.2 又通过新增的 `working_directory` 工具把它暴露出来。这个 suffix 在每一个实测过的宿主上都与它重复，而变量不在之后它只能是空的。 |
| 十条 subagent 行上的 `backgroundMode: continuable` | alpha.2 的 `tool-subagent` `Config` 里**根本没有这个键**（alpha.1 有），alpha.3 与 alpha.4 上同样没有（实测，见下方注）。schemastery 不拒绝未知键，于是它变成一条没人读的死键。 | continuable 现在是**provider 的能力**而非行的设置：`apply()` 读 `subagentProvider.prepareContinuable`，spawn provider 与 rc 线的 fork provider 都实现了它 —— ⚠️ **只在 rc 线上实读；`0.2.2-alpha.2` 未对 `dsh-subagent-fork-in-process` 单独读**。lane 的 durable-id 续话能力保留。 |

这两处删除在四台受支持的宿主上都是安全的，而这正是要点：无子句的 `persona` 行与无 `backgroundMode` 的 lane 行在那里**合法**，而旧写法只在较旧的、本包已不再支持的宿主上合法。`tools/patch-contract.test.mjs` 会在产物里重新出现 `{{cwd}}` 时失败，所以这一条不会再被误加回来。

**上面这两条测量是历史记录，不是支持声明。** 它们之所以点名 alpha.1 与 alpha.2，是因为它们就是在那里测出来的；逐字保留正是为了这一点：它们是两条**至今仍然成立**的决定的证据 —— 为什么 `persona` 行不写 `suffix`（字段还在，变量不在），以及为什么不写 `backgroundMode`。**这两个版本都不受支持**，任何其它 `0.2.1-alpha.*` 也不受支持；这些测量解释的是产物的形状，不是支持的边界。边界就是上面那张表。

### 只有一种 lane 形态，以及为什么

产物只发出**一种** lane 形态：每条 lane 一条 Agent Preset，由 lane 行用 `agentPreset` 选中，`allowedAgentPresets` 成对写出同一个 id。这里曾经有**两种** —— 一种是在 subagent 行上直接写 `persona` 与 `toolFilter` 的旧形态，另一种是这一种 —— 由同一个宿主门分档渲染。那个矩阵已经不存在了，因为每一台受支持的宿主 —— 整条 rc 线（`0.2.1-rc.3`、`rc.4`、`rc.5`）与 `0.2.2-alpha.2` —— 两个键都没有：`dsh-tool-subagent` 的 `Config` 字面量已不再声明 `persona` 或 `toolFilter`，且 `apply()` 只要见到其中一个就**硬抛**（`lib/index.js`：rc 线 `:355` / alpha.2 `:346` —— 文本逐字相同）：

```
tool-subagent: persona is no longer supported; configure persona and tool plugins
in an Agent Preset and select it with agentPreset (spawn only)
```

这是**单条 entry 的「未激活」失败，不是启动崩溃**：会话照常起来，而每一条受影响的行都静默地没被激活。在**每一台**受支持宿主上都没有第二种形态可以退回去 —— 旧键在挂载期就被拒 —— 所以「只发一种形态」不是图省事的简化，而是**唯一能挂上去的形状**。

随之而来的是两条硬约束，产物里把它们**成对**写出：

| 约束 | 为什么 |
|---|---|
| `allowedAgentPresets` 必须包含那个 `agentPreset` id | 否则 `dsh-tool-subagent/lib/index.js:209` 在挂载期抛 `agentPreset must be included in allowedAgentPresets`。两个键必须**成对**写。 |
| `agent-presets` 服务必须已挂载 | 否则 `:357` 抛 `agent preset selection requires the agent-presets service`。不是每个 profile 都提供它。 |

**为什么非得有一个 `lane-tool-gate`。** preset 的 `plugins[]` **只能加不能减**：没有任何声明式办法把某个宿主工具从一条 lane 上减掉。所以「排除」无法由 preset 机制自身表达 —— 它需要 `tools.restrict()`，沿调用 agent 自己的 scope 链求值。`lane-tool-gate.mjs` 就是那个闸，挂在每条 lane 的 preset 内。

它收一份**允许名单**（`official`），deny 集自己算：注册表当时已知的全部名字，减去该 lane 的 `official`。两件事由此成立。

- **lane 只看得见被授予的东西。** `restrict()` 把其余工具**从模型的可见面上移除**，与旧形态的 `toolFilter.deny` 完全一致。被拒的工具不是「留着但调用被拒」，而是**根本不在那儿**，无从调用。
- **晚注册的工具照样被剥掉。** 工具面在每次 `tools/change` 时重算 ⇒ 在 lane 挂载**之后**才注册的工具（MCP server、第三方插件）会在下一轮进入 deny 集。没有这一条，先挂载的 lane 会永久保留后到的 MCP 工具 —— 那是**静默**的权限授予，而不是响亮的失败。重算以 deny 名单本身作去重键，所以 `restrict()` 自己发出的 `tools/change` 不会引发自激。

**为什么用允许名单而不是拒绝名单。** 本包曾经携带三份静态 deny 名单（只读 / wright / forge）加一份按机器算的「MCP 闭包」（从 loader 配置算出 `mcp_<server>` 名）。两份都已删除。拒绝名单必须枚举「宿主工具面减去本该保留的」，而这个面随每一次部署漂移：MCP server、第三方插件、workbench 扩展。那份名单只会越写越长且永远不全 —— 而**不全的拒绝名单是静默失效的**：产物少一个名字，看起来完全正常。允许名单把默认翻过来：凡未显式授予的一律拒绝 ⇒ 新部署新增的工具不可能泄漏进一条从没要过它的 lane。它同时对**不存在的名字**安全：授予不要求工具已注册，而不在注册表里的名字永远进不了算出来的 deny 集 ⇒ `restrict()` 不会因它抛错。

最后这条性质正是 shell 名字那样处理的原因。可写 lane 的 `official` 里 **`bash` 与 `pwsh` 两个都列**，preset 里 **`tool-bash` 与 `tool-pwsh` 两条行也都挂**，各自带着与 `topRows` 同形的 `disabled` 平台表达式。到底哪个真的注册由运行时按平台决定，不由构建机器决定；两个都声明，授予与挂载在任何平台上都自洽。只挂其中一条会让这条 lane 在另一个平台上**完全没有 shell** —— 一个不报错的静默能力缺口。

每条 lane 的 `official` 集是**两半的同一个来源**：gate 的允许名单，与它 preset 里挂的官方工具行，都由同一个数组派生 ⇒「声明了却没挂」（授予了一个不是真实工具的名字）与「挂了却没声明」（工具刚挂上就被 gate 剥掉）这两件事都不会再静默成立。

**失败方向。** `disabled` 表达式把宿主的 `dsh-tool-subagent` **版本**与支持集逐字比较 —— 只有在版本读不出来时，才退回判断 `Config = z.object({…})` 字面量里是否仍然声明 `persona:` —— 并由 `tools/patch-contract.test.mjs` **双向**断言。它的职责已经变了：它不再「挑一种形态」，而是决定**到底挂不挂任何东西**。如果它解析不到那个包、或读不到文件，它求值为 **true**，也就是把每一条 lane 行与每一条 lane preset 行都禁用。这是刻意的。在一个读不到的宿主上猜「受支持」，会让这些行带着未知的形状硬挂上去，失败方式随宿主而异 —— 缺服务就抛，多一个键就被静默吞掉。**什么都不挂**是唯一不可能被误读成成功的结果。

**第二道 `disabled`，在另一个轴上 —— `tool-presentation` 行。** lane 行按**版本**判，因为它们问的是「这是不是我们测过的宿主」。`tool-presentation` 行（`@deepseek-ai/dsh-agent-tool-presentation`，`mode: 'native'`）按**结构**判，因为它问的是「这一层是不是已经由宿主自己管」。在 `0.2.2-alpha.2` 上，base 骨架自己挂了 `tool-executor-native`（`:497`）与 `tool-executor-ptc`（`:500`），而呈现包的 `apply()` 现在只做一件事：`ctx.plugin(<那个 executor>)` ⇒ 在那里再挂这一行就是**重复注册** native executor。所以这道门的判据是：`@deepseek-ai/dsh-tool-executor-native` 能 `resolve()` ⇒ 本行 disabled。rc 线上根本没有这个包，所以那一行照旧挂载 —— 在 rc 线上它是冗余的（`mode: 'native'` 等于 `dsh-tools` 自己的默认值），但无害。这个不对称如实写明、不作平滑：结构门若按**失败关闭**，会把 rc 线上一条合法的行关掉，所以它在解析不到时按**失败开启**处理，那份残余被接受。

**在真实宿主上实测过，不只是论证 —— 但别把已退出集合的那一版读成受支持宿主。** 受支持宿主上的真启动**只有一次**：`0.2.2-alpha.2`，在一棵隔离的 home 上，十九条受门行在那里全部求值为启用（本节末有读数）。另有一次更早的、作为**历史**保留的测量：在 `0.2.1-rc.2` 上跑真 `dsh --profile web` 启动，每一条 lane 行都挂载，且**没有** `persona is no longer supported`、**没有** `toolFilter is no longer supported`、**没有** `Duplicate agent preset` —— 这条测量作为历史保留，因为 rc.2 此后已退出支持集。探针本身对着已安装的 `dsh-tool-subagent` 跑过，在那台宿主上返回 **false** —— 正是「受支持」的那个取值 —— 所以这些行被启用，与它们合法，依据的是同一个事实。在 `0.2.1-rc.3` 上同一个探针对着已安装的包跑，同样返回 **false**。在 rc.4、rc.5 与 alpha.2 上决定同一件事的仍是同一个成员判断，其输入是各自树上读出的版本串；rc.4 与 rc.5 读到的更是与 rc.3 一模一样的文件。rc.3、rc.4、rc.5 **都没有**再跑一次真启动；alpha.2 **有** —— 在一棵隔离的 home 上，且十九条受门行在那里全部求值为启用。[第 0 节](#0-宿主版本门)逐条写明了每一版的支持依据是哪几条事实。

### 1–4. 安装

```sh
./install.sh                  # 装进 $DSH_HOME，或 ~/.dsh
DSH_HOME=/some/other/home ./install.sh
```

从一个 clone 安装时，它把 bundle stage 到 `<DSH_HOME>/plugins/dsh-orchestrator-preset-bundle/`，并校验 per-profile 符号链接。不往 `~/.dsh/skills/` 拷任何东西，也没有伴随插件：四个技能由本 bundle 自己的 provider 提供，aegis 前缀桥由生成器产出的一行挂载。手做的话：

```sh
# 1. 复制 bundle
cp -r . ~/.dsh/plugins/dsh-orchestrator-preset-bundle/

# 2. 装进某个 profile：见下面「接入 profile」一节的 package.json 行，然后在该 profile 目录
#    跑 `pnpm install` —— 链接由 pnpm 从 link: 依赖生成。
#    用 test -L 校验，绝不用 test -e：Git Bash 会把链接静默降级成复制，
#    而复制品能通过 test -e，却会冻结此后对 bundle 的每一次编辑。
test -L ~/.dsh/profiles/web/node_modules/@quill507/dsh-orchestrator-preset && echo "real symlink"

# 3. 四个自研技能**不需要安装步骤** —— 它们随包自带，由 extensions/dsh/index.js
#    这个 filesystem skill provider 提供；该 provider 由生成的 patch 挂载，且
#    includeDefaultRoots:false。不会向 ~/.dsh/skills/ 写入任何东西。

# 4. 什么都不用装。aegis 前缀桥随包自带（extensions/dsh/aegis-prefix.js），
#    由生成的一行 patch 挂载，带两个设置：prefixAegisSkills（默认开）与
#    describeAegisSkillsInZh（默认关，在你自己的层里打开 —— 见下）。
```

**不会向 `~/.dsh/skills/` 拷贝任何东西。** 四个 `orch-*` 技能随 bundle 走，由一个限定在
本包范围内的 provider 提供：装这个 preset 不会往你的全局技能目录里加东西，卸载也不会
留下东西。那个目录里装的是别人的工具；往里撒副本的 preset 只会继承那份混乱，却拿不到
对应的上下文。本包发布的内容就是 `skills/` 里那些，而 `.gitignore` 是**逐条**准入这四条
路径的 —— 想加第五条，必须显式说出来。

`describeAegisSkillsInZh` 默认关，因为把一份目录翻译过来是**读者偏好**，不是路由需求。

**在 patch 层里设置它。目前没有设置页开关。** home 层 `$DSH_HOME/cordis.patch.yml` 在本 bundle 之后应用，所以那里的一行会胜出：

```yaml
- id: orch-aegis-prefix
  config:
    prefixAegisSkills: true
    describeAegisSkillsInZh: true
```

**两个 key 都要重述。** patch 是**整行替换**某行的 config，不做深合并；只写你要改的那个，另一个会被打回默认值。两条路都需要**重启**：config 在插件 apply 时读。

### 为什么还没有开关，以及它需要什么

宿主确实会从插件 schema 生成设置表单，本插件的 `Config` 也按那个要求写好了 —— 用 `@deepseek-ai/schemastery` 而不是 `zod`，两个字段都标了 `.volatile()`。**但这不够，这是实测的结论而不是猜测**：`dsh-settings.describe()` 只考虑 `dsh-config-editor.entries()` 返回的条目，而后者过滤到 `parent.tree.ctx.fiber.entry?.id === "include"` 的行。**由 bundle patch 插入的行不属于那一类**，所以这里的东西到不了设置界面。

确实有**第二个**能到达补丁插入行的机制 —— **Plugins 页**会渲染一行自己的 config，键为 `<包名>#<行 id>`，它**不**查那个 `include` 过滤。所以卡住开关的不是行本身，而是**浏览器半边**：那两个开关需要一个 client bundle，而**预设的行供应不了**。

**实测，宿主 0.2.0-rc.2**（历史测量 —— 该版本不受支持；它描述的 `PresetTree` 构造函数在受支持宿主上仍然存在、形状未变）：client bundle 扫描器（`@deepseek-ai/dsh-client-modules`）走的是**根** loader 树，而预设的行挂在它自己的一棵独立 `PresetTree` 上（`@deepseek-ai/dsh-agent-preset-registry`，`mountPreset()` → `new PresetTree(ctx)` + `tree.root.update(...)`）。`PresetTree` 继承 `EntryTree`，却在构造函数里把 owner 的 `subtree` 指针删掉，所以它的行从扫描器枚举的任何东西都不可达。于是本包 manifest 里的 `dsh.client` 声明**永远不会被读到**，bundle 也永远不会被供应 —— 那一行只是不会长出 configure 控件。公开的路子也没有：`ClientModuleRegistry` 只导出 `compose` / `bundleResource` / `onGraphChanged`，响应表是私有的，所以也没有受支持的注册入口。UI 只能落在**一个 profile 级** bundle（另一个包）里，不能落在这个 preset 里。

设置表单本身不用怀疑：在 `orch-debug` 档上，`POST /api/settings/describe` 返回命名空间 `orch-aegis-prefix`，schema 里两个 key 都在，值里两个已存的布尔量也都在。

不带 UI 的编辑仍然有效，也仍然受支持：home 层 `$DSH_HOME/cordis.patch.yml` 在本 bundle 之后应用，所以那里的一行会胜出。**两个 key 都要重述**，因为 patch 是**整行替换**某行的 config，不做深合并。

**客户端页面支持不在计划内；上面那个限制是架构性的。** 两个开关只能改配置文件；想知道为什么，看这一节。

### 5. 接入 profile

在 `~/.dsh/profiles/<profile>/package.json` 里加上依赖，并把同一个字符串加进 `dsh.profile.bundles`（保持原位置）：

```json
"@quill507/dsh-orchestrator-preset": "link:<DSH_HOME>/plugins/dsh-orchestrator-preset-bundle"
```

然后在该 profile 目录跑 `pnpm install`。在 `~/.dsh/profiles/<profile>/cordis.patch.yml` 里选中本 preset：

```yaml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: standard
    selectedDefault: dsh-orchestrator-preset
```

**这是 registry 那一行，而且必须是完整的一行。** `selectedDefault` 是 `@deepseek-ai/dsh-agent-preset-registry` 的键（`lib/index.js`：rc 线 `:442-443` / `0.2.2-alpha.2` `:446-447`；`defaultId` 解析 `selectedDefault ?? default`），而这一行由 shipped 的 `dsh-web-app` bundle 插入，不由本 bundle 插入。patch 是**整行替换**而非深度合并，所以这一行的整份 `config` 都要重述、`default` 也在内：那个键在 registry 的 schema 里是 `required`，省掉它，组合出来的 registry 行里就**没有** `default` 了。反过来，把这行写成 bundle 自己的 `preset-dsh-orchestrator-preset` 行（本节早先的写法）不是「给它**加**一个键」：那是把 preset 定义整行**替换掉**，preset 直接消失。在一棵一次性 `DSH_HOME` 上用 `0.2.2-alpha.2` CLI 实测：那种写法组合出 **1243** 行、`preset-orch-lane` 出现 **0** 次、`tool-presentation` **0** 次；同一个 profile 不写那一行则组合出 **2106** 行，九条 lane preset 与每一条受门行都在。

两个 profile 必须钉住**同一个** aegis 发布 tag；desktop 不允许浮动。

`install.sh` 刻意停在这一步之前：那两个文件属于活机安装自身，而 `cordis.patch.yml` 被 `dsh-hmr` 实时监视，写它会当场触发运行中宿主的全树重组。脚本只打印这些改动，不代劳 —— 而**它**打印的那段选中片段仍然是上面说的「错行」写法：脚本侧的修正在进行中（`install.sh` 由另一条 lane 负责）。在你手上那份脚本改成打印 registry 行之前，请用上面的 row，不要直接粘贴脚本打印的那段；等它改好，就把这条提示删掉。

### 6. 安装 aegis 方法包

`aegis` 是上游依赖，不由本仓库分发。通过宿主安装，两个 profile 钉同一个 tag。

**关掉 aegis 的自动注入，同时保住路由表。**

aegis 会为每个会话上膛一段路由 bootstrap：默认 `tdd_mode = "off"` 时是 4443 字符的一块文本，在会话发出首个 `tool/call` 或 `assistant/message` 之后投递一次，并被 `compaction/end` 重新上膛。它是给会话**主 agent** 的一段文本 —— subagent 会话按设计被跳过 —— 而本 preset 按域与 lane 路由，所以在它之上这是第二套路由权威，说的却不是同一件事。aegis 用**它自己**配置文件里的一个开关来门控，不是 DSH 的 patch 层：

```toml
# ~/.config/aegis/config.toml
activation_mode = "explicit"
```

`explicit` 让 `installBootstrap()` 在读取或构建任何东西**之前**返回 `null`，于是什么都不注入。`auto` —— 默认值 —— 才是上膛的那个。

**这不以那 22 行路由为代价。** 两者是同一个插件里的两套机制，而且技能 provider 先注册、且无条件注册：在 aegis 自己的 `extensions/dsh/index.js` 里，`applyFilesystemProvider(...)` 是第 22–27 行，`installBootstrap(ctx, …)` 在第 29 行。所以 23 个技能照常注册，`routing-sections.mjs` 点名的 22 个照常解析。本机实测：23 提供、22 被点名，没有任何「被点名却没提供」。`activation_mode` 门控的只是那段注入文本，仅此而已。

改之前要知道两件事：

- **它是用户全局的，没有按项目的粒度。** 路径由 home 目录解析，所以一次改动会波及 `web` 与 `desktop` 两个 profile 上的**所有** workspace。
- **`AEGIS_ACTIVATION_MODE` 覆盖该文件，但前提是宿主启动时它已经存在。** 该值在启动期的插件 apply 阶段被读取一次，之后在 shell 里再 export 不起作用。两条路都一样：重启宿主。

---

## 故障排查

**在 GUI 里选的 preset 不会自己回来。** preset 选择器经由配置编辑器持久化，而后者就地重写 profile 自己的 `cordis.patch.yml`。在那里选过的 preset 会覆盖 `selectedDefault`，且没有任何东西会把它恢复。bundle 自己的 patch 没被动 —— 只有 profile 的。重新应用上面那段行即可回来；没有状态需要重置。

**`cordis.yml` 是空的，而这是正确的。** 宿主把空列表定义成字面量，并在每次启动时重写以让它保持为空；组合出来的行由 loader 写回其中，否则下一次启动会把每一条 bundle insert 都复制一遍。**所以 grep `cordis.yml` 永远无法告诉你当前选中了哪个 preset** —— 要看 `cordis.patch.yml`。

**bundle 加载了却找不到它的文件。** 用 `test -L` 查链接。目录存在但不是符号链接，那就是复制品，不会跟踪后续编辑。

**lane 表现得像是丢了 shell 工具。** preset 同时声明两个 shell —— `tool-bash` 与 `tool-pwsh` —— 各自按 `process.platform` 开关，所以在 Windows 上 preset 要的是 `pwsh`。在 profile 层**之后**应用的一层可以覆盖它，`~/.dsh/cordis.patch.yml` home 层就是这样一个地方：一个在 Windows 上只用 bash 的宿主，会在那里强制 `tool-bash: disabled: false` 与 `tool-pwsh: disabled: true`。这是**部署事实，不是缺陷** —— preset 不要求 `pwsh`，而「被禁用的工具」仍然是「已知的工具」，所以 lane 用 bash 一样派发和工作正常。看起来 lane 丢了 shell 时，先查你自己的 home 层或 profile 层，再怀疑 preset：home 层优先，而且是静默优先。另需注意，现在**不再**从这些生效值派生任何 shell 名：每条可写 lane 的 `official` 都**无条件**同时列着 `bash` 与 `pwsh`，两条行也都挂在它的 preset 里 ⇒ 部署层的 override 只改变哪个 shell **真的注册**，永远不改变某条 lane **被授予**哪个。本 preset 不为迁就任何特定 shell 安排而改动任何 tool 行、filter 或 persona。

**persona 前缀是空的。** `plan-aware-persona` 对缺失或空的 persona 文件**响亮失败**，而不是悄悄剥掉 agent 的身份。读报错：它会点名那个文件。

---

## 验证安装

```sh
./tools/verify-install.sh            # 检查 "desktop" profile
./tools/verify-install.sh web
```

preset 真的装上了吗，装的真的是被选中的那一个吗？十三项检查，朴素的 `PASS`/`FAIL` 行加一行汇总，任何一项失败就以非零退出。它是**只读**的：在内存里组合 profile 树，从不写入任何 DSH home —— check 5 断言的是这件事本身，而不是假设它。

| # | 检查什么 |
|---|---|
| 1 | profile patch 选中了本 preset，且恰好一次 |
| 2 | bundle 链接是**真符号链接** —— `test -L`，绝不用 `test -e`，因为一个被静默降级成复制的链接照样能通过 `test -e` |
| 3 | bundle **能穿过链接读出**，且目标的 `package.json` `name` 就是本仓库自己的 —— 存在不等于可用 |
| 4 | patch 生成器与产物同步，运行时 **`DSH_HOME` 未设置** |
| 5 | **组合出来的**树确实选中了本 preset，旧名一次都不出现，且 preset 行在场 |
| 6 | 四个 `orch-*` 技能已安装，四个已退役的无前缀名作为目录已消失 |
| 7 | 两条 shell 行读出来的正是这台宿主刻意配置的样子 |
| 8 | 泄漏门扫的是**工作树** —— 按形状抓机器本地绝对路径，并抓 `docs/` 之外的第三方技能名与私密数据 token；名称规则需要一份本地未提交的 `tools/leak-needles.local.txt`，该文件不存在时它会打印 `WARN` 说明名称规则未运行，而这一条检查**仍然报 `PASS`** |
| 9 | 路由表里每个 `aegis-*` 目标都能解析到已装包真正提供的技能 —— 悬空的行是静默失败 |
| 10 | zh 描述映射表仍与已装的方法包一致 —— 陈旧的键是静默失败 |
| 11 | 没有任何 client-bundle 声明回到本包 —— 按构造即死代码，所以「不在」是门唯一能断言的事 |
| 12 | npm 会发布的东西仍与 `package.json` 的 `files` 所说一致 —— 目录条目发的是**工作树**，不是被跟踪的集合 |
| 13 | 各 lane 的 deny 清单不点名「只有**这台**机器保证有」的工具 —— 这台机器没有的名字会让 lane 在下一台机器上坏掉 |

**check 4 刻意在 `DSH_HOME` 未设置的情况下运行。** 生成器从 `$DSH_HOME` 解析骨架、回退到 `~/.dsh`，所以一个碰巧导出了该变量的 shell 解析得通，而一个干净的 shell 解析不通 —— 后者被读成了「这工具坏了」。该工具此后已被修好、会回退，所以这项检查是去证明它，而不是假设它。

**check 5 组合树，而不是读 `cordis.yml`，** 因为 `cordis.yml` 回答不了这个问题：它是宿主每次启动都会重写的四行空根，所以它结构上装不下那些行，往里倒的任何东西都会在下次启动时死掉。`dsh --profile <name> --dump-config` 也不可用 —— 启动器对 `desktop` 这类由 Electron 管理的 profile 直接拒绝它。所以脚本调用宿主自己的只读 loader，跳过重写 `cordis.yml` 的那一步，再对组合出来的输出做 grep。

---

## 依赖

本 bundle 没有任何运行时 npm 依赖。它 import `@deepseek-ai/dsh-tools`（为了 `lane-composition.mjs` 里的 `defineTool`），npm 生态里别的什么都不 import；那个包由**宿主**提供，这就是它在这里既不是 `dependency` 也不是 `peerDependency` 的原因。

persona 文件在运行时按深路径解析（`createRequire(baseUrl).resolve('@quill507/dsh-orchestrator-preset/personas/scout.md')`）。`baseUrl` 由宿主注入，所以解析与 bundle 装在哪里无关。那些深层路径由 `package.json` 里一份显式的 `exports` 映射提供（**19** 个子路径：四个 `.mjs` 插件、十份 persona `.md`、`cordis.patch.yml`、两个 `extensions/dsh/*.js`、`locale/*.json` 与 `package.json`），所以它们走的是**声明过的门**，而不是 Node 的 legacy no-exports 行为。新增一个需要被解析的文件时，也要把它加进 `exports` —— 没列进去的深层路径即使文件就在盘上也会解析失败。

---

## 发布到 npm

**这件事已经做了。** 包以 `@quill507/dsh-orchestrator-preset` 发布。哪些版本已经发布，**以 npm 与 GitHub release 页面为准** —— 本文件不保留这份事实的副本，因为留在这里的副本每一次发布都会过期。运行时 specifier 就是 npm 名 —— `@local/` 别名在本 bundle 上已不再使用。

- **拥有全部 specifier 的那一行**是 `tools/preset-declaration.mjs:45`，`export const bundlePkg = '@quill507/dsh-orchestrator-preset'`。这一个常量拥有生成的 `cordis.patch.yml` 里全部 **15** 处 specifier 引用。实测命令：`grep -o '@quill507/dsh-orchestrator-preset/[A-Za-z0-9._/-]*' cordis.patch.yml | sed 's|@quill507/dsh-orchestrator-preset/||' | sort -u`，它返回 15 条互异路径：**4 个 `.mjs`**（`lane-composition.mjs`、`plan-aware-persona.mjs`、`routing-sections.mjs`、`lane-tool-gate.mjs`）、**2 个 `.js`**（`extensions/dsh/index.js`、`extensions/dsh/aegis-prefix.js`）与 **9 个 persona `.md`**。改那一行，然后跑 `node tools/gen-cordis-patch.mjs` —— 不需要别的改动，也没有任何 persona 文件受影响。（`personas/orchestrator.md` 是被内联的，不是按文件解析的，所以它正确地不在那份列表里。）
- **在此之外还有一件事没解决**：`skills/` 下那四个技能是纯 Markdown，没有 npm 故事，需要一个 postinstall 步骤把它们拷进某个 profile 的技能目录。包上了 registry 之后这件事更要紧，因为一次 npm install 会把那些 Markdown 送到，却不把它放到任何 profile 会去读的地方。`exports` 映射与「第二个包」这个问题都已了结 —— 映射有了，而伴随插件被折进 `extensions/dsh/aegis-prefix.js`，没有作为独立包发布。
- **已发布的包与 profile 的本地投影共用一个名字**，因为两者都是 `@quill507/dsh-orchestrator-preset`。名字上没有任何东西能区分它们；唯一的差别是各自解析到的目标 —— profile 的 `node_modules` 符号链接指向本地 stage 的 bundle，而 registry 那份是真正的 tarball。这正是 `tools/verify-install.sh:96-105` 记录的那个顾虑：原始设计把两个键区分开（`@local/…` 对 npm 名），好让「解析器返回了已发布包而不是本地投影」不可能静默发生。统一到 npm 名是对那条规则的一次**知情、且经用户批准的例外**；它接受的代价记在那条注释旁。读者不该把这个共用的名字当成巧合。

### 技能 provider 架构 —— 已采纳，刻意未建

**这没有实现，也没有测试。** 记录下来，是因为 owner 已把它采纳为*下一轮*的做法，也因为它会改掉上面两项。

做法是：**挂载一个插件，让它调用 `@deepseek-ai/dsh-skill-filesystem` 的 `apply()`**，配置 `includeDefaultRoots: false` 与指向本包自己 `skills/` 树的 `bundledSkillDir`。它与 aegis 给自己的随包技能用的那约 12 行形状相同。这个包从本 bundle 里已经可解析，**零新增依赖**，而且它导出 `apply`、`FileSystemSkillProvider` 与 `Config` —— 所以入口已经在那儿；缺的是调用点与注册。

**它会删掉什么：**

- **安装第 3 步消失。** 不再需要把四个技能拷进全局 `~/.dsh/skills/`，因为 provider 从包内提供它们。这同时替用户去掉了「一次只拷一个目录、绝不整棵树拷」的那个坑。
- **npm 待办第 5 条随之消失** —— postinstall 拷技能那一步正是这套架构存在的理由，所以那一条应当从上面的清单里划掉，而不是被解决。

**它的代价，以及代价正是它被推迟的原因：**

- **它会改掉生成的 `cordis.patch.yml`。** 必须声明一行新插件，于是 patch 被重新生成，它当前已核的 md5 —— `ba04ddbeb2eaa82bcb9f6d2df00fc219` —— 不再是期望值。任何钉住那个摘要的东西都得跟着更新。
- 重新生成必须真的做、并对着宿主重新验证，不能只是推理：那个能逐字节复现今天这份 patch 的生成器，正是会产出新 patch 的东西；而一行挂载失败的 skill-provider 行，会在**运行时**而不是安装时弄丢那四个技能。

现在做，意味着为一个还没人要求的收益，去改动运行中安装的技能面。推迟的代价只是一份过期的 `cordis.patch.yml` 摘要。

---

## 许可证

MIT —— 参见 [`LICENSE`](LICENSE)。

## 致谢

这个预设大半是别人的工作，只是被摆成了某一种形状，所以值得把是谁说清楚。

**[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** —— 本预设运行的宿主，MIT 许可。`cordis.patch.yml` 里的配置行派生自它，本项目赖以成立的 bundle/patch 模型是它的设计，而它自家的一等公民 bundle（`dsh-web-app`、`dsh-base`）就是这里那套架构的参照实现。本 README 记录的若干发现——组合一个 profile 会重写它的 `cordis.yml`、filesystem skill provider 可以指向任意目录树——都是宿主的既定行为，而且是**测出来的**，不是猜的。

**[aegis](https://github.com/GanyuanRan/Aegis)** —— 本预设路由进入的方法论包，作者 Jesse Vincent 与 Ganyuan Ran。方法归它：路由纪律、按情境给技能的做法、压力测试与验证习惯。本项目提供的是它外围的编排层，并在运行时消费 aegis，**一行原文都没有 vendor 进来**。它的 `extensions/dsh/index.js` 同时也是这里那座 provider 的可用参照——那十二行让「技能随包自带」这个设计在被尝试之前就已经显然正确。

**[itamzxm](https://github.com/itamzxm)** —— **Auto-Pilot** 的作者。那是一组**七个技能**，为**本预设之外的其它 agent 环境**而写（workbuddy、traework、opencode 等），而不是绑定某一个宿主。它们是**裸技能目录，没有 package manifest** —— 这正是它在这里**不是**一个可安装件的原因：Auto-Pilot 是被**当作机制的来源**读的，不是被当作组件引入的。本设计从它这里**按机制**借用了六组东西：记忆模型、召集闸与收敛三态、裸跑测试与委派函、四条调度机制、以及搜索与目标判据。Auto-Pilot 未发布、无许可证，本仓库不含它的任何文本 —— 哪个机制来自它，由本仓库自己的设计史点名，而不是把原文抄过来。

**[Tacrine](https://github.com/Tacrine)** —— 在本次设计开始之前，把 oh-my-openagent 的 agent 集移植到 DeepSeek Harness 并做了修改。这里那十份 persona 起初就是那次移植的产物。

**oh-my-openagent**（[code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)）—— 那些 persona 最终上溯到的源头，作者 **code-yeongyu**。该项目**不是开源的**，本仓库也不分发其中任何文本：这里每一份 persona 都已按一条明确阈值重写 —— 与上游 agent 源码的 n-gram 重合**低于 2%**，且**不存在连续六行相同**。`tools/audit-personas.mjs` 就是那条阈值，做成了可执行的形式。它的一半（术语探针）在任何环境都能跑；另一半（重合度）需要上游语料，而语料是**刻意不随仓库分发**的，所以这次重写是**部分证据，而不是一个已验证的结论** —— 工具把它报成「未验证」而不是「通过」，因为这两者是不同的事。

**本项所针对的各个包的作者** —— `@deepseek-ai/schemastery`，以及提供 `dsh-tools`、`dsh-skill-filesystem`、`dsh-home-paths` 的 DSH 各包。没有它们这里什么都加载不起来，而它们当中**没有任何一个是本包的依赖**：宿主在运行时提供，这正是本 bundle 不声明任何运行时依赖的原因。

还有一点要说清楚：用来**建造**它的工具——一个在长会话里工作的语言模型——不是这些设计的来源。其中的错误按原样记在本仓库自己的历史里，没有被抹平；哪些是实测、哪些是假设，全文随处都标了出来。

## 第三方归属

正式记录 —— 本仓库里哪些东西来自别处、哪些刻意不在其中 —— 在 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。它单独成文而不是追加到 `LICENSE` 末尾，有两个原因：追加会让 GitHub 对一个**明明是 MIT** 的文件报成「Other」；而一个事实有两个落点，等于没有落点。

其中两点值得在这里重复，因为它们影响你可以拿这份代码做什么：`aegis` 包是**运行时消费、未 vendor 进来**的；而任何一台机器上装的第三方技能**都不由本仓库再分发** —— 其中有些完全没有许可声明，再分发那类东西是**违规而不是疏忽**。
