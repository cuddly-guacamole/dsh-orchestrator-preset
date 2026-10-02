# `.agents/` — 本仓库的事实归档

**一条规则：一个事实只有一个 home。** 同一条事实不许在两个地方各写一份；两个 home 说法不一致时，
先问「哪个是权威」，再把另一个改成指向它，而不是各改一半。

| 事实的类型 | home | 状态 |
|---|---|---|
| 术语的含义（一个词在本仓指什么） | [`CONTEXT.md`](CONTEXT.md) | **尚未创建** |
| 怎么写、怎么验证（可执行的规矩） | [`standards/`](standards/) | **尚未创建** |
| 设计与取舍（方案 A/B 的比较） | ~~`designs/`~~ | ⛔ **不要创建** —— 见下方「已知当前偏差」第 2 条 |
| **难以回退的决定及其理由** | [`adrs/`](adrs/)（本目录） | **已创建** |
| 已知并接受的技术债 | `adrs/` 里各篇的「已知未闭合项」小节 | **已创建**（`debts/` 暂不建，避免同一个 home 记两遍） |
| 包的门面（装什么、怎么装） | [`README.md`](../README.md) | 已存在 |

标「尚未创建」的是**约定好的位置，不是已存在的目录** —— 空目录不写进版本库，凭空造一个没内容的
home 会让人以为那里已经有东西了。

## 谁是权威：不是 `docs/DESIGN.md`

`adrs/` 逐条指回 [`docs/DESIGN.md`](../docs/DESIGN.md) 的章节，但**该文件自己在第 3 行就声明了**
（⚠️ 历史设计草案 —— 不是当前权威）：

> **当前的设计说明是仓库 [README](../README.md) 的 "Design" 一节。** 该节才是「这个 preset
> 是什么、怎么工作」的权威。本文件保留的是它背后的推理与决策轨迹。

所以分工是三层，不是两层：**README 的 Design 一节 = 当前规格**；**`docs/DESIGN.md` = 推理与决策
轨迹**（其中的文件计数、行号、宿主探针取自 2026-09 的更早时刻，文件头逐条列了「刻意过时」之处）；
**`adrs/` = 单个决定的记录**（决定了什么、为什么、代价是什么、当初还有什么选项被否掉了）。
ADR 里写「依据 §3.3.2」指的是**推理出处**，不是「当前规格写在这里」—— 两者混用会让人拿一份考古
材料当实现依据。

## 已知当前偏差（KNOWN CURRENT DEVIATION）

规则已经被违反的三处。**记录它们比悄悄修掉它们有用**：每一处都注明了「对账要改哪一处」，而权威
那一侧本轮不在写入范围内。改动前先读这一节。

### 1. 「§2.3 删除的 10 个官方 row」有四个 home，其中一个只列了 6 个

| home | 位置 | 列了几个 |
|---|---|---|
| 权威（`docs/DESIGN.md` §2.3「删除项与理由」表） | `:216-222` | **10** |
| ADR | [`adrs/2026-10-01-unmount-rather-than-deny.md`](adrs/2026-10-01-unmount-rather-than-deny.md) `:21-29` | **10**（逐条带 §2.3 的理由） |
| 契约测试常量 | [`tools/patch-contract.test.mjs`](../tools/patch-contract.test.mjs) 的 `DELETED_BY_DESIGN_2_3` | **10** |
| 声明文件的注释 | [`tools/preset-declaration.mjs`](../tools/preset-declaration.mjs) `:453-454` | **6** ⛔ |

**分歧点**：`preset-declaration.mjs:453-454` 写「权威骨架 standard.patch.yml **自身带** 6 个 row
（command-goal / tool-goal / workflow-ptc / tool-workflow / tool-ralph / present）⇒ 本 preset 不得含
这 6 个」。**这句话对骨架的事实描述是错的**：已安装的
`~/.dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml` 还带
`tool-plugin-manager`（`:144-146`）、`tool-subagent-codex`（`:103-110`）、
`tool-subagent-claude-code`（`:111-118`）、裸 `tool-subagent`（`:90-96`）—— 四个**也**在 §2.3 的
删除项表里。那句注释因此**低估了**约束：按它写声明，会把那 4 行合法地挂回去。

**对账要做的**（唯一一处要改的：`tools/preset-declaration.mjs:453-454` 的注释）：把 6 改成 10，或直接
写「10 个，清单见 ADR `unmount-rather-than-deny` 与测试常量」并删除那份重复枚举。**权威侧不动**
（DESIGN 的 10 个是对的，ADR 的 10 个与它逐条一致，测试的 10 个与它逐条一致）。
本轮不改：该文件在禁写清单内。

### 2. `designs/` 这个 home 已经被占用了 —— 不要创建

表格里原本给「设计与取舍（方案 A/B 的比较）」安排的 `designs/` 位置**不能建**：`docs/DESIGN.md`
里已经有两个现成的 home 承担同一件事 —— §5.2「三个候选落点的取舍」表（`:827-831`，A/B/C 方案与
判定）和 §15「风险与取舍」表（`:1742-1759`，16 条决策 + 替代方案 + 被否理由）。再开一个
`designs/` 就是第三个 home，规则在**落地的当天**就被违反。要补一条新的方案比较，进 `adrs/` 的
「考虑过的选项」。

### 3. 声明口径的 row 数有 28 与 29 两个数

`docs/DESIGN.md:271` 的算式是「13 顶层 + 3 group + 3 delegation 控制 + 9 lane = **28**」；当前
声明清单是 **29**（多出的那一行是 T16 加的 `lane-composition`，2026-09-25）。三套数字的完整定义见
[`adrs/2026-10-01-declaration-plus-generator-check-gate.md`](adrs/2026-10-01-declaration-plus-generator-check-gate.md)
的「计数口径」表；生成器 stdout 每次都把三套数一起打印。**对账要做的**：`docs/DESIGN.md:224` 的那句「顶层 row = 12 个保留 + 1 个新增 = 13 个」与 `:226-240`
的顶层表、`:271` 的算式要补第 14 行。本轮不改（`docs/**` 禁写）。

**另一处同源偏差**：`tools/preset-declaration.mjs:40` 写「12 个顶层 row（配置值与 preset-standard
逐字一致）」，同文件 `:452` 写「14 个顶层 row」—— 一个文件里的两条注释已经互相矛盾（`:40` 那条过时）。
且「12 个保留行逐字一致」有一个实现里已存在的例外：第 1 行 `persona` 是**替换**行，官方那行的
`config.prefix`（骨架 `:15`）本 preset 不设（`cordis.patch.yml:19-22`）⇒ 二者按设计就不逐字。
契约测试因此把 `persona` 排除在逐字比对之外，其余 11 行比对。

## 本目录目前的形态

本仓目前只有 `adrs/` 有内容。两篇 ADR 记录了**推翻了权威文档**的决定 —— 它们与 `docs/DESIGN.md`
的冲突是**被记录的、不是被掩盖的**，冲突本身写在各自的「后果」一节里，指向本节的偏差条目。
