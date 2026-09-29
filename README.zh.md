# dsh-orchestrator-preset

[English](README.md) · **中文**

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

九条 lane 是 preset 自己的行：`planner`、`scout`、`archivist`、`seer`、`reader`、`analyst`、`auditor`、`wright`、`forge`。每条自带 persona 文件与 `toolFilter`，所以能力边界是**声明式的，不是建议式的** —— 只读 lane 的 `deny` 清单会把 `write`、`edit`、`todo_write`、其它所有 lane 的派发工具，以及面向 lead 的子代寻址工具，从它的座位上摘掉。正是这些 deny 清单阻止 lane 重新滑回协调者角色。

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
| `personas/` | 十份 persona：orchestrator、planner，以及每条 lane 一份。 |
| `skills/` | 四个自研技能。本目录就是它们的权威清单。 |
| `extensions/dsh/` | 本包的两个插件：技能 provider，以及 aegis 前缀桥。 |
| `docs/` | **不分发。** 设计史被留存；上文的设计一节即是规范。 |
| `README.zh.md` | 本文件。 |
| `install.sh` | 把下面这些装进一个 DSH home。 |
| `LICENSE` | MIT 许可 + 第三方归属。 |

**改 preset 的正确姿势**：`cordis.patch.yml` 带「DO NOT EDIT BY HAND」头，是生成出来的。改 `tools/preset-declaration.mjs`，然后：

```sh
node tools/gen-cordis-patch.mjs
```

生成器需要一个用来合并的骨架 patch：依次找 `--skeleton <path>`、`$DSH_SKELETON`、宿主自己的 `standard.patch.yml`，都找不到就**拒绝编造**。本仓库里的 `cordis.patch.yml` 与该命令从已提交声明产出的结果逐字节一致。

---

## 安装

安装方式是 **`link:` 依赖**，不是 npm 发布。`package.json` 带 `"private": true`，**正是**为了保证 `@local/` 作用域的名字永不被误发布 —— 这个守卫就是当前名字安全的原因，也是真正发布那一刻要移除的标志位。本包**不**声明任何 `dependencies`：运行时一切由宿主提供。但它**声明了 `peerDependencies`**，四条全部标 `optional` —— 这样「我们测过什么」被写了下来，而任何安装都不会因为它失败：

| 包 | 范围 | 为什么 |
|---|---|---|
| `@deepseek-ai/dsh-skill-filesystem` | `>=0.2.0-rc.2 <2` | 本 bundle 挂载的 provider |
| `@deepseek-ai/dsh-tools` | `>=0.2.0-rc.2 <2` | `defineTool`，`lane-composition.mjs` 用 |
| `@deepseek-ai/cordis` | `>=4.0.1 <5` | 插件契约；这是真实的大版本边界 |
| `@deepseek-ai/schemastery` | `>=3.18.0 <4` | 设置卡片据以生成的 `Config` schema |

**下界写的是实际跑过的版本**，不是设计稿恰好参照过的更早版本。上界沿用已发布的 `@quill507/dsh-auto-approval-llm` 对同一批宿主包的写法。`optional: true` 是让这份声明保持诚实的关键：这里的耦合很深 —— `ctx.skills.registerProvider` 是宿主 API —— 大版本改动可能让它静默坏掉，写出这件事比假装这个范围有强制力更值。**它确实没有强制力。**

### 0. 宿主版本门

```sh
dsh --version          # 低于 0.1.7-rc.1 时 install.sh 拒绝继续
```

这是 `install.sh` 内部的硬检查，而且它**刻意比上面的 `peerDependencies` 更宽松**：0.1.7-rc.1 是设计所依据的版本，0.2.0-rc.2 是实际跑过的版本。**两者之间诚实的答案是「未测」**，这两个数字保持分开正是为此，而不是悄悄合并成一个。`install.sh --check` 只跑这个门，不写任何东西。

### 1–4. 安装

```sh
./install.sh                  # 装进 $DSH_HOME，或 ~/.dsh
DSH_HOME=/some/other/home ./install.sh
```

手做的话：

```sh
# 1. 复制 bundle
cp -r . ~/.dsh/plugins/dsh-orchestrator-preset-bundle/

# 2. 装进某个 profile：见下面「接入 profile」一节的 package.json 行，然后在该 profile 目录
#    跑 `pnpm install` —— 链接由 pnpm 从 link: 依赖生成。
#    用 test -L 校验，绝不用 test -e：Git Bash 会把链接静默降级成复制，
#    而复制品能通过 test -e，却会冻结此后对 bundle 的每一次编辑。

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

开发机上唯一**确实有**设置卡片的第三方插件（`@quill507/dsh-auto-approval-llm`）走的也不是这条：它自带一个浏览器客户端插件和一条自己的 GET 路由，而且它源码里管那条路由叫「**给没有宿主表单的卡片（条目非 ACTIVE）的降级来源**」。所以这里要一个开关，意味着写一个**客户端插件**：`dsh.client` 声明、独立的浏览器入口、一条读路由、以及一张绑定到本条目 id 的表单。**那是一个小项目，不是这个 schema 上的一个字段，而且它还没做。**

**客户端页面支持已列入计划并在此记为未完成。** 在它落地之前，两个开关只能改配置文件；想知道为什么，看这一节。

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

---

## 故障排查

**在 GUI 里选的 preset 不会自己回来。** preset 选择器经由配置编辑器持久化，而后者就地重写 profile 自己的 `cordis.patch.yml`。在那里选过的 preset 会覆盖 `selectedDefault`，且没有任何东西会把它恢复。bundle 自己的 patch 没被动 —— 只有 profile 的。重新应用上面那段行即可回来；没有状态需要重置。

**`cordis.yml` 是空的，而这是正确的。** 宿主把空列表定义成字面量，并在每次启动时重写以让它保持为空；组合出来的行由 loader 写回其中，否则下一次启动会把每一条 bundle insert 都复制一遍。**所以 grep `cordis.yml` 永远无法告诉你当前选中了哪个 preset** —— 要看 `cordis.patch.yml`。

**bundle 加载了却找不到它的文件。** 用 `test -L` 查链接。目录存在但不是符号链接，那就是复制品，不会跟踪后续编辑。

**lane 表现得像是丢了 shell 工具。** preset 同时声明两个 shell —— `tool-bash` 与 `tool-pwsh` —— 各自按 `process.platform` 开关，所以在 Windows 上 preset 要的是 `pwsh`。在 profile 层**之后**应用的一层可以覆盖它，`~/.dsh/cordis.patch.yml` home 层就是这样一个地方：一个在 Windows 上只用 bash 的宿主，会在那里强制 `tool-bash: disabled: false` 与 `tool-pwsh: disabled: true`。这是**部署事实，不是缺陷** —— preset 不要求 `pwsh`，而「被禁用的工具」仍然是「已知的工具」，所以 lane 用 bash 一样派发和工作正常。看起来 lane 丢了 shell 时，先查你自己的 home 层或 profile 层，再怀疑 preset：home 层优先，而且是静默优先。另需注意，生成器派生 lane `toolFilter` 里那个 shell 名字时，读的是 host 层与 preset 自己各行**两处**的生效值，所以改动那个 override 就意味着要重跑 `node tools/gen-cordis-patch.mjs`。本 preset 不为迁就任何特定 shell 安排而改动任何 tool 行、filter 或 persona。

**persona 前缀是空的。** `plan-aware-persona` 对缺失或空的 persona 文件**响亮失败**，而不是悄悄剥掉 agent 的身份。读报错：它会点名那个文件。

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
