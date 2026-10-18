<div align="center">

# @quill507/dsh-orchestrator-preset

**为 DeepSeek Harness 的薄壳 agent preset**

*aegis 方法论层负责方法 · 自研编排层负责委派*

[![npm](https://img.shields.io/npm/v/@quill507%2Fdsh-orchestrator-preset?style=flat-square&label=npm&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
[![downloads](https://img.shields.io/npm/dm/@quill507%2Fdsh-orchestrator-preset?style=flat-square&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.2-4c6ef5?style=flat-square&labelColor=454a54)
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

九条 lane 是 preset 自己的行：`planner`、`scout`、`archivist`、`seer`、`reader`、`analyst`、`auditor`、`wright`、`forge`。每条自带 persona 文件与自己的 Agent Preset，后者里的 `lane-gate` 插件持有该 lane 的 deny 名单 —— 所以能力边界是**声明式的，不是建议式的**。只读 lane 的 `deny` 名单会把 `write`、`edit`、`todo_write`、四个提醒工具、其它所有 lane 的派发工具、面向 lead 的子代寻址工具，以及 MCP 闭包，从它的座位上摘掉。正是这些 deny 名单阻止 lane 重新滑回协调者角色。

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

**请把下表里的版本号读成「测量地点」，不是支持声明。** 受支持的宿主集合只有一个版本，`0.2.1-rc.2` —— 见[宿主版本门](#0-宿主版本门)。下面若干行引用了 `0.2.0-rc.2`、`0.2.1-alpha.1` … `0.2.1-alpha.5`；每一个都只是某次测量的发生地，而它们**全部不受支持**。保留它们，是因为它们是产物至今仍然体现的那些决定的证据 —— 哪些键缺失、为什么需要一道门、为什么 MCP 名字是按机器算而不是写死的。记录**当前**受支持宿主事实的行会明确说出来。

| 主张 | 状态 |
|---|---|
| bundle 通过 `package.json` 里的 `dsh.bundle.patch` 字段声明自己的 patch，例如 `"patch": "./cordis.patch.yml"`。 | **上游契约。** 在已发布的 `@deepseek-ai/dsh-base` manifest 里逐字如此，那份 manifest 还把这份 patch 作为一个 subpath 导出。 |
| 靠后的 patch 层胜出，且 patch 是**整行替换**而不是深合并 —— 所以一个覆盖 `config` 的行必须重述它需要的每一个键。 | **两次独立印证。** |
| 精确的层序：先按 `dsh.profile.bundles` 的顺序应用各 bundle patch，然后是 profile 自己的 `cordis.patch.yml`，然后是 `$DSH_HOME/cordis.patch.yml`，最后是每个 `--patch` 覆盖层。 | **在宿主 0.2.0-rc.1 上实测。** 未对着上游文档确认。 |
| 一个 profile 位于 `~/.dsh/profiles/<name>/`，内含 `cordis.yml`、`cordis.patch.yml` 与 `package.json`。 | **在宿主 0.2.0-rc.1 上实测。** 未对着上游文档确认。 |
| `config.selectedDefault` 在 preset 的 schema 里，且是生效的那个值；schema 里还有 `config.default`，而 `defaultId` 解析 `selectedDefault ?? default`。 | **在宿主 0.2.0-rc.1 上实测**，对着 `@deepseek-ai/dsh-agent-preset-registry`。 |
| `{{cwd}}` 是一个已注册的提示词变量；引用一个未知的 `{{…}}` 会在装配期抛错。 | **随版本而异，且逐版实测**（历史测量 —— 点名的两个版本都不受支持）。在 `0.2.0-rc.2` 上已注册（`dsh-agent-loop` 注册 `provider`/`model`/`cwd`），**自 `0.2.1-alpha.2` 起不存在**（只有 `provider`/`model` —— 已在已装的 `0.2.1-alpha.5` 上复核）。已对着已装宿主自己的 `renderPrompt` 复现：`unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`。上游 `dsh-system-prompt/README.md` 现已要求使用者删掉这个子句。这就是 `persona` 行在唯一受支持宿主上都不带 `suffix` 的原因 —— 见[宿主版本门](#0-宿主版本门)。 |
| `tool-subagent` 的 `Config` 接受 `backgroundMode`。 | **随版本而异**（历史测量 —— 点名的版本都不受支持）。在 `0.2.1-alpha.1` 上存在（`lib/index.js:257`），**自 `0.2.1-alpha.2` 起不存在**。schemastery 容忍未知键，所以这次移除是静默的 —— 已把两种写法都喂给已装 schema 核过。continuable 现在由 provider 的 `prepareContinuable` 决定，spawn 与 fork 两个 provider 都在受支持宿主上实现了它。⇒ lane 行**完全不写** `backgroundMode`。 |
| `standard` preset 骨架是「有哪些行」的权威。 | **逐版实测**（历史测量 —— 点名的版本没有一个受支持）。它从 162 行（`0.2.0-rc.2`、`0.2.1-alpha.1`）缩到 137 行（`0.2.1-alpha.2`），去掉了 `tool-ralph`、`tool-subagent-codex` 与 `tool-subagent-claude-code`；`tool-schedule` 是新增的 —— **在 alpha.1 上有，在 rc.2 上没有**。已在已装的 `0.2.1-alpha.5` 上复测：128 行，仍带 `time-context` 与 `tool-schedule`，仍没有那三条被删的行。 |
| `@deepseek-ai/dsh-tool-schedule` 在每一个受支持的宿主上都存在。 | **现在为真 —— 因为受支持集合只剩一个版本。** 受支持的宿主自带它：`dsh@0.2.1-rc.2` 依赖 `@deepseek-ai/dsh-tool-schedule@0.2.1-rc.2`。在旧的**三版**集合下这条是**假的** —— npm 上它只发布在 `0.0.1-rc.2`（另一代）以及 `0.2.1-alpha.1` … `0.2.1-alpha.5`，而 `dsh@0.2.0-rc.2` 不依赖它（rc.2 的提醒工具是那个*可选、默认关*的 `dsh-experimental-schedule-bundle`，它插入 `time-context`/`schedule`/`ui-schedule`，而**不是** `tool-schedule`）。那段历史正是这四个名字过去必须放在条件尾巴里、现在可以静态列出的原因。 |
| deny 名单里点了一个宿主没注册的工具，会在派发时响亮失败，而不是在挂载时。 | **在 `0.2.0-rc.2` 与 `0.2.1-alpha.2` 上实测，行为一致**（历史测量 —— 两个版本都不受支持）。`tools.restrict()` 抛 `names unknown global tool`（`dsh-tools/lib/index.js:2895-2908`），而 `dsh-subagent` 在组合一个 child 时不加保护地调用它（`lib/index.js:401`）。这正是 `mcp_*` 那些名字必须**按机器算**、不能写成字面量的原因：一份硬编码清单会在缺某个 server 的机器上弄坏每一次派发。而 `schedule_*` 现在可以静态列出，正是因为受支持的宿主一定有它们。 |
| `tool-subagent` 的行 `Config` 仍然接受 `persona` 与 `toolFilter`。 | **在受支持宿主上为假。** `dsh-tool-subagent/lib/index.js:311` 已不再声明这两个键，且 `:355` 在挂载期对两者硬抛。⇒ 本包因此只提供**一种** lane 形态，即 Agent-Preset 形态 —— 见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。 |
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
| `lane-tool-gate.mjs` | lane 的工具闸：`tools.guard()`，挂在每条 lane 的 Agent Preset 内 —— 因为 preset 表达不了「排除某个工具」。见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。 |
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

| 包 | 钉住的版本 | 为什么 |
|---|---|---|
| `@deepseek-ai/dsh-skill-filesystem` | `0.2.1-rc.2` | 本 bundle 挂载的 provider |
| `@deepseek-ai/dsh-tools` | `0.2.1-rc.2` | `defineTool`，`lane-composition.mjs` 用 |
| `@deepseek-ai/cordis` | `4.0.5` | 插件契约 |
| `@deepseek-ai/schemastery` | `3.18.5` | 设置卡片据以生成的 `Config` schema |

四个 peer **钉到唯一受支持宿主自己的包版本** —— 也就是 `dsh@0.2.1-rc.2` 所依赖的那几个精确版本 —— 而不是写成范围。这正是这次改动的要点：一条范围等于宣称「这一带版本都能用」，而本 bundle 不再作这个宣称。对着任何其它宿主的安装**按构造就在契约之外**：已经没有范围可以让它落进去。旧措辞说下界写的是「所支持的最低宿主版本」（`0.2.0-rc.2`）；现在已经没有带可以划，也就没有下界可写。

**诚实的附注：npm 对这一切没有强制力。** 四个 peer 全标了 `optional`，所以 npm 不会因为解析到别的宿主就拒绝安装，也不会给出任何有人会当真的警告。**真正**的屏障是产物里那个 `disabled` 表达式，见[宿主版本门](#0-宿主版本门)：它在挂载期读宿主版本，非受支持版本上那些行根本不挂载。`install.sh` 的版本门拒绝同一批宿主，但它**是可选的** —— 任何用 `npm install` 安装、或手写 `link:` 依赖的人根本不会跑到它。peer 是「测过什么」的书面记录，不是一个机制。

**产物里为什么会有宿主门 —— 历史记录。** 有两次宿主发布打断了本包所依赖的东西，而它们打断的方式**完全不同**，这正是产物里存在 `disabled` 表达式的原因。这些是测量，保留是因为它们解释了产物的形状；它们**不是**支持声明，其中点名的版本没有一个受支持：

- **`0.2.1-alpha.2` 拿掉了两个键。** `{{cwd}}` 不再是已注册的提示词变量，`backgroundMode` 也从 `tool-subagent` 的 `Config` 里消失了。这两处删除**可以被吸收**：本包不再写它们中的任何一个，得到的 `persona` 行与 lane 行在受支持宿主上合法。
- **`0.2.1-alpha.3` 拿掉的是机制，不是一个键。** `persona` 与 `toolFilter` 整体离开了 `tool-subagent` 的行 `Config`，而 `apply()` 现在只要见到其中一个就硬抛。这一处**无法被吸收**：替代品（Agent Preset）在 alpha.3 之前根本不存在，而且它**完全无法表达「排除某个工具」**。所以 lane 行走 Agent-Preset 形态，并由该形态带一个自写的闸插件。见[只有一种 lane 形态，以及为什么](#只有一种-lane-形态以及为什么)。

宿主版本之间的差异**没有一处**是被静默容忍的（见[来源](#来源哪些是上游的哪些是在这里实测的)），因为一个只在自己的最新宿主上正确的 preset，在其它任何宿主上都**不**受支持 —— 而一个只在自己的最新宿主上正确、**却看起来加载成功了**的 preset，比一个直接失败的更糟。

**提醒工具只属于 Lead，而这一点现在是静态声明。** 持久提醒（`schedule_create` / `schedule_list` / `schedule_update` / `schedule_delete`）来自 `@deepseek-ai/dsh-tool-schedule`。受支持的宿主**自己就带它** —— `dsh@0.2.1-rc.2` 依赖 `@deepseek-ai/dsh-tool-schedule@0.2.1-rc.2` —— 所以挂载它的那一行是一条**裸行**，与官方骨架同形，不带 `disabled` 表达式。那四个名字列在三份静态 deny 名单（`READONLY_DENY` / `WRIGHT_DENY` / `FORGE_DENY`）以及 lane 闸的 deny 名单里，因为在每一台受支持的机器上它们都存在。

这是对一个更早的条件写法的简化，而它之所以安全、之所以诚实，是同一个理由：本 bundle 早先的版本在挂载期求值宿主，只在那个包解析得到的地方加上这四个名字，因为 `0.2.0-rc.2` 没有 `@deepseek-ai/dsh-tool-schedule`。只剩一个自带该包的受支持宿主之后，「这台宿主上解析得到吗」已经不是一个值得问的问题 —— 静态名单正是「每一台受支持机器都有」的正确表达。

**一处已知、已接受的退化：在受支持的宿主上，经 `subagent_fork` 派出的 child 可以调用提醒工具。** 这是对 0.1.9 一句声称的更正，而那句旧声称在 `0.2.1-alpha.4`/`alpha.5` 上**已经**是假的 —— 它不是本轮引入的回归，也**没有**被 fork 行的 `disabled` 表达式修掉：那个表达式只在**不受支持**的宿主上关掉这一行，而在那种宿主上本来就什么都不挂。在**受支持**宿主上这一行是启用的，退化照旧成立。`subagent_fork` 控制行**不带 `toolFilter`**、也没有等价的 deny 名单，因为受支持的宿主**硬拒那个键**（`dsh-tool-subagent/lib/index.js:355`），而 fork provider 自报 `capabilities.agentPreset = false` 并继承父 agent 的组合 ⇒ **不存在**任何声明式路径去收窄一个 fork 出来的 child。后果如实写明、不作淡化：**经 `subagent_fork` 创建的 child 可以调用提醒工具，尽管九条具名 lane 不能。** 影响面是有界的 —— 九条具名 lane 经那个闸 deny 这四个名字，且 lane 自己 fork 不了（它们的 deny 里含 `subagent_fork`）—— 但 Lead 自己的 fork 在这一边界之外。要关掉这个口子只能靠运行时机制（对 fork child 施加 guard），那需要新增插件文件；不在本版范围内。

`tools/verify-install.sh` 的 check 13 会对着**模拟**的机器求值 lane 闸的 deny 表达式与 `disabled` 探针，所以一个按机器漂移的名字若溜回静态名单，会在那里响亮失败，而不是在下一次派发时。

### 0. 宿主版本门

```sh
dsh --version          # 低于 0.2.1-rc.2 时 install.sh 拒绝继续
```

这是 `install.sh` 内部的硬检查。**「能装」与「受支持」之间不再有缺口**：下限与支持集是同一个值，`0.2.1-rc.2`。旧的那个更宽松的下限，作用是「在支持集是另一条更宽的带时，让设计所依据的版本仍然装得上」；带已经收成一个版本，更宽松的下限也就没有东西可表达了。

这道门是**下限**，不是等值判定 —— `install.sh` 拒绝**更旧**的宿主、放行更新的宿主，因为「未来的宿主」不是一道下限能裁决的东西。这不等于放宽支持：**支持**声明仍是下面那张一行表，高于下限的宿主在被实测之前**仍不受支持**。真正决定本 bundle 在那种宿主上能不能用的，是产物自己的 `disabled` 表达式（见下一段），不是这道门。

**受支持的集合恰好是一个宿主版本：**

| 宿主版本 | npm dist-tag | 你会拿到什么 |
|---|---|---|
| `0.2.1-rc.2` | 撰写时为 `next`（`latest` 仍指向 `0.2.0-rc.2`，而那个版本**不受支持** —— 不要从 `latest` 安装） | 本 bundle 唯一受支持的宿主 |

其余一切**都不受支持，而且不兼容** —— 不只是「未测」。这涵盖每一个 `0.2.1-alpha.*`、`0.2.1-rc.1` 与 `0.2.0-rc.2`。没有受支持的带、没有「大概没问题」那一档、也没有部分分：一个版本，边界就是契约。

**不受支持的宿主上实际会发生什么。** 本 bundle 的九条 lane 行、九条 lane preset 行与 `subagent_fork` 控制行带的都是**同一个** `disabled` 表达式 —— 同一段文本、同一个极性。它解析宿主自己的 `@deepseek-ai/dsh-tool-subagent`，向上找到那个包的 `package.json`，读出 `version`，只问一个问题：**它是否恰好是 `0.2.1-rc.2`？** 任何其它取值 —— 更新、更旧、或另一个构建 —— 都让表达式为 **true**，而 true 就是 `disabled`：

| 宿主 | 十九条受门的行会怎样 |
|---|---|
| `0.2.1-rc.2`，恰好是它 | **挂载** —— 这正是产物为之而生的宿主 |
| **其余每一个版本**：`0.2.0-rc.2`、`0.2.1-alpha.1` … `0.2.1-alpha.5`、`0.2.1-rc.1`，以及任何尚未发布的版本 | **十九条全部禁用 —— 什么都不挂** |

所以**只有一个**受支持的宿主，其余一切都只有**一种**失败方式。本 preset **什么都不挂**：没有 lane、没有 lane preset、没有 fork 行，所以**根本没有任何委派路径**。它**不会**退回去挂一批没有收窄的 lane。fork 行在这里之所以关键：它是唯一一条**不经过 lane** 也能创建 child 的行，把这道门加到它身上，才让「完全没有委派」成立，而不只是「没有具名 lane」。这就是「已退役、不兼容」的含义，而它现在是**机械事实**而不是文档声明 —— 产物里的门与这里的文字按构造一致。

**三道屏障，只有一道是真正承重的。** 值得说清哪道是哪道，因为它们互相重叠，而把「写下来的意图」误当成「被强制的约束」太容易了：

- 产物自己的 `disabled` 表达式是**真正**的那道屏障。它在挂载期读宿主版本，在版本不对时关掉每一条 lane 行。
- `install.sh` 的版本门会拒绝低于同一版本的宿主。它是真的，但**是可选的** —— 只有走 `install.sh` 的人才会跑到它；用 `npm install` 或手写 `link:` 依赖安装的人根本不会执行它。
- 四个 `peerDependencies` 钉到精确版本，而它们**只是提示**：四条全标了 `optional`，所以 npm 既不会拒绝、也不会阻止解析到别的宿主的安装。

**一处已接受的边界，如实写明。** 这道门并不总能读到版本。如果解析到的包没有可读的 `package.json` `version`（manifest 被改名或缺失），它会退回更早的结构判定：`Config = z.object({…})` 字面量里是否仍然声明了 `persona:`？在这条路径上旧契约宿主仍会被关掉，但一个**新契约**宿主若 manifest 读不出来，就会挂载。这是刻意的，理由在于代价的方向：对一个读不出来的宿主按失败关闭，会连同**受支持**宿主的 lane 一起拿走 —— 而那恰恰发生在安装方式略有不同的情况下，比它规避的残余更糟。所以这条回退是**尽力而为**的网，不是第二重保证 —— 不要把上面那张表读成「对 manifest 被改写过的宿主也密不透风」。它回退所依据的结构事实自 `0.2.1-alpha.3`（`persona` 离开 `Config` 那次）以来从未变过。

**这是刻意的失败方向。** **什么委派都做不了**的宿主是**看得见**的问题 —— 你立刻会发现委派不工作，而且产物完好、可以检查。它所换掉的那个选择更糟：九条 lane 在一个本包从未测量过的宿主上挂载，带着 Lead 的完整工具面，而正常会话里看不出任何异常。在「响亮的缺席」与「安静的过度授权」之间，产物选择响亮地失败 —— 对**每一个**非受支持的版本都是如此，不只是较旧的那些。

同一个表达式在解析不到那个包时也按失败关闭（fail-closed）处理，理由相同：读不到的宿主不是受支持的宿主。注意这一句与上面那条回退是同一句话的两面 —— 只要定不出**版本**，门就倾向 `disabled`；唯一例外是「新契约宿主 + manifest 读不出来」。

`install.sh --check` 只跑版本门，不写任何东西。

**有两个键没能通过那次 config 核对，本包现在不再写它们。** 记在这里，因为两者都是**静默**失效的 —— 而静默恰恰是 config 键唯一有意思的失效方式；也因为它们至今仍是「唯一受支持宿主上为何缺这两个键」的理由：

| 键 | 它去了哪 | 为什么不算能力降级 |
|---|---|---|
| `persona` 行上的 `suffix: 'Your working directory is {{cwd}}.'` | `{{cwd}}` 在 rc.2 与 alpha.1 上曾是已注册的提示词变量，在 **alpha.2 及更新版本上不是**（实测，见下方注）。`dsh-system-prompt` 对未知变量是**抛错**，所以这不是「少了一句话」，而是**提示词装配期的硬失败，发生在任何模型请求之前**。上游现已直接要求使用者删掉这个子句。 | 目录由 `dsh-working-directory` 服务供给 —— 它自 rc.2 起就在 `dsh-base` 骨架里，alpha.2 又通过新增的 `working_directory` 工具把它暴露出来。这个 suffix 在每一个实测过的宿主上都与它重复。 |
| 十条 subagent 行上的 `backgroundMode: continuable` | alpha.2 的 `tool-subagent` `Config` 里**根本没有这个键**（alpha.1 有），alpha.3 与 alpha.4 上同样没有（实测，见下方注）。schemastery 不拒绝未知键，于是它变成一条没人读的死键。 | continuable 现在是**provider 的能力**而非行的设置：`apply()` 读 `subagentProvider.prepareContinuable`，而 spawn 与 fork 两个 provider 都在受支持宿主上实现了它。lane 的 durable-id 续话能力保留。 |

这两处删除在唯一受支持的宿主上是安全的，而这正是要点：无子句的 `persona` 行与无 `backgroundMode` 的 lane 行在那里**合法**，而旧写法只在较旧的、本包已不再支持的宿主上合法。`tools/patch-contract.test.mjs` 会在产物里重新出现 `{{cwd}}` 时失败，所以这一条不会再被误加回来。

**上面这两条测量是历史记录，不是支持声明。** 它们之所以点名 alpha.1 与 alpha.2，是因为它们就是在那里测出来的；逐字保留正是为了这一点：它们是两条**至今仍然成立**的决定的证据 —— 为什么 `persona` 行不带 `suffix`，以及为什么不写 `backgroundMode`。**这两个版本都不受支持**，任何其它 `0.2.1-alpha.*` 也不受支持；这些测量解释的是产物的形状，不是支持的边界。边界就是上面那张一行表。

### 只有一种 lane 形态，以及为什么

产物只发出**一种** lane 形态：每条 lane 一条 Agent Preset，由 lane 行用 `agentPreset` 选中，`allowedAgentPresets` 成对写出同一个 id。这里曾经有**两种** —— 一种是在 subagent 行上直接写 `persona` 与 `toolFilter` 的旧形态，另一种是这一种 —— 由同一个宿主门分档渲染。那个矩阵已经不存在了，因为唯一受支持的宿主（`0.2.1-rc.2`）两个键都没有：`dsh-tool-subagent` 的 `Config` 字面量已不再声明 `persona` 或 `toolFilter`，且 `apply()` 只要见到其中一个就**硬抛**（`lib/index.js:355`）：

```
tool-subagent: persona is no longer supported; configure persona and tool plugins
in an Agent Preset and select it with agentPreset (spawn only)
```

这是**单条 entry 的「未激活」失败，不是启动崩溃**：会话照常起来，而每一条受影响的行都静默地没被激活。在受支持的宿主上根本没有第二种形态可以退回去 —— 旧键在挂载期就被拒 —— 所以「只发一种形态」不是图省事的简化，而是**唯一能挂上去的形状**。

随之而来的是两条硬约束，产物里把它们**成对**写出：

| 约束 | 为什么 |
|---|---|
| `allowedAgentPresets` 必须包含那个 `agentPreset` id | 否则 `dsh-tool-subagent/lib/index.js:209` 在挂载期抛 `agentPreset must be included in allowedAgentPresets`。两个键必须**成对**写。 |
| `agent-presets` 服务必须已挂载 | 否则 `:357` 抛 `agent preset selection requires the agent-presets service`。不是每个 profile 都提供它。 |

**为什么非得有一个 `lane-tool-gate`。** preset 的 `plugins[]` **只能加不能减**：没有任何声明式办法把某个宿主工具从一条 lane 上减掉。所以「排除」无法由 preset 机制自身表达 —— 它需要 `tools.guard()`，沿调用 agent 自己的 scope 链求值。`lane-tool-gate.mjs` 就是那个闸，挂在每条 lane 的 preset 内；它的 deny 名单**按机器算**：该 lane 的静态 deny 名、三个 lane 寻址名、四个 `schedule_*` 名，以及 **MCP 闭包** —— 也就是这台机器自己的 loader 配置会注册的那些 `mcp_<server>` 名。最后这一项是关键：它在挂载期按配置算出来，口径与旧的 `toolFilter.deny` 完全相同 ⇒ **只读 lane 无法调用 `mcp_*`，而且是经由这个闸**，在任何机器上都成立，本包无需写死一份会随部署漂移的名字清单。

**两处已知退化，如实写明。** 这种形态**不是**旧形态的等价替换。两处都是刻意接受、且在产物里看得见的：

- **`reader` 的白名单没有等价物。** `tools.guard()` 只有 deny 语义，没有 `allow`。旧形态给 `reader` lane 的是 `allow: ['read', 'read_image']`，含义是「只留这两个」。这种形态只能枚举要拒的名字，而那份名单等于「宿主工具面减去两个」，随每一次宿主发布漂移。所以 `reader` lane 的闸挡住 lane 寻址名、`schedule_*` 名与 MCP 闭包，**它的通用工具面比旧宿主上更宽**。寻址名那三个是**无条件**挡住的（`LANE_ADDRESSING_DENY`）：旧白名单按构造就不含它们，而放它们过去属于权限放大，不属于退化。
- **这个闸什么都不隐藏。** 闸让被拒的工具**保持可见、在调用时拒绝**，并给出可读理由；旧形态的 `restrict({deny})` 则是**把它从可见面移除**。这不是对等替换：lane 能看见一个它不许用的工具。但这是受支持宿主能提供的最强手段 —— preset 的 `plugins[]` **只能加不能减**，根本不存在声明式地排除某个宿主工具的办法。

**失败方向。** `disabled` 表达式把宿主的 `dsh-tool-subagent` **版本**与受支持版本比较 —— 只有在版本读不出来时，才退回判断 `Config = z.object({…})` 字面量里是否仍然声明 `persona:` —— 并由 `tools/patch-contract.test.mjs` **双向**断言。它的职责已经变了：它不再「挑一种形态」，而是决定**到底挂不挂任何东西**。如果它解析不到那个包、或读不到文件，它求值为 **true**，也就是把每一条 lane 行与每一条 lane preset 行都禁用。这是刻意的。在一个读不到的宿主上猜「受支持」，会让这些行带着未知的形状硬挂上去，失败方式随宿主而异 —— 缺服务就抛，多一个键就被静默吞掉。**什么都不挂**是唯一不可能被误读成成功的结果。

**在受支持宿主上实测过，不只是论证。** 在 `0.2.1-rc.2` 上跑真 `dsh --profile web` 启动，每一条 lane 行都挂载，且**没有** `persona is no longer supported`、**没有** `toolFilter is no longer supported`、**没有** `Duplicate agent preset`。探针本身对着已安装的 `dsh-tool-subagent` 跑过，在那台宿主上返回 **false** —— 正是「受支持」的那个取值 —— 所以这些行被启用，与它们合法，依据的是同一个事实。

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
- id: preset-dsh-orchestrator-preset
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    selectedDefault: dsh-orchestrator-preset
```

patch 是**整行替换**而非深度合并，所以上面那段是完整的一行，不是往更大的行里追加。两个 profile 必须钉住**同一个** aegis 发布 tag；desktop 不允许浮动。

`install.sh` 刻意停在这一步之前：那两个文件属于活机安装自身，而 `cordis.patch.yml` 被 `dsh-hmr` 实时监视，写它会当场触发运行中宿主的全树重组。脚本只打印这些改动，不代劳。

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

**lane 表现得像是丢了 shell 工具。** preset 同时声明两个 shell —— `tool-bash` 与 `tool-pwsh` —— 各自按 `process.platform` 开关，所以在 Windows 上 preset 要的是 `pwsh`。在 profile 层**之后**应用的一层可以覆盖它，`~/.dsh/cordis.patch.yml` home 层就是这样一个地方：一个在 Windows 上只用 bash 的宿主，会在那里强制 `tool-bash: disabled: false` 与 `tool-pwsh: disabled: true`。这是**部署事实，不是缺陷** —— preset 不要求 `pwsh`，而「被禁用的工具」仍然是「已知的工具」，所以 lane 用 bash 一样派发和工作正常。看起来 lane 丢了 shell 时，先查你自己的 home 层或 profile 层，再怀疑 preset：home 层优先，而且是静默优先。另需注意，生成器派生 lane 闸的 deny 名单里那个 shell 名字时，读的是 host 层与 preset 自己各行**两处**的生效值，所以改动那个 override 就意味着要重跑 `node tools/gen-cordis-patch.mjs`。本 preset 不为迁就任何特定 shell 安排而改动任何 tool 行、filter 或 persona。

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
