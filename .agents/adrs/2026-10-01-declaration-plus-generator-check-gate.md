# ADR: 用「声明清单 + 生成器 + 入库的产物 + `--check` 门」取代手维护 `cordis.patch.yml`

状态：已采纳（`--check` 的机器绑定缺陷已于 2026-10-01 拆成「硬门 + 警告」两截并闭合，见「已闭合项」）

## 背景

§2.1 的推论（DSH 无 preset 继承）⇒ 必须逐行重复声明完整 `plugins[]`，其中大量是官方 row 的逐字复制。
§7.3「D9 的重估」把这个新事实写得很清楚：**v1 的 D9 曾推荐「不引入生成器」**，理由是「旧生成器
已是死代码 + 自用不维护」；但 §2.1 的新事实改变了这个判断——「官方 row 的配置值（`maxDepth`
语义、`isolate` realm、`toolFilter` 名字）一旦变化，手工同步 28 行极易漂移」。

§2.2 的备注补明了两个脚本的定位：`preset-declaration.mjs`「**不是新交付面，是实现的单一来源**」，
`gen-cordis-patch.mjs` 是「§14 D9『引入生成器』的直接产物」。

**计数口径（必读；三套数，混用会得出假结论）** —— 本 ADR 下文与
[`2026-10-01-no-preset-inheritance-full-restatement.md`](2026-10-01-no-preset-inheritance-full-restatement.md)
都按这张表说话：

| 数字 | 定义 | 今天实测 |
|---|---|---|
| **28** | DESIGN §2.4（`:271`）的算式：13 顶层 + 3 group + 3 delegation 控制 + 9 lane | **已过时**：13 顶层是 2026-09-25 之前 T16 之前的数 |
| **29** | `countRows(d)` = `topRows` + `groups` + `delegation.rows`（生成器打印的 `rows-detail`） | ✅ 当前声明口径。14 顶层 + 3 group + 12 delegation（3 控制 + 9 lane） |
| **33** | 产物里 `plugins[]` 下的**全部** `- id:` 行（`countFileEntries(d)`） | ✅ 29 + 4（`planning` 1 + `compaction` 3 的子行，它们**确实渲染**，只是被 §2.4 的算式折进 group 条目里） |
| **36** | 产物里的 `- id:` 行总数 | ✅ 33 + 3（preset 行 + 两个 bundle 级挂载行） |

**29 与 28 的那 1 行差 = `lane-composition`**（T16 / 2026-09-25 新增的挂载行，见
[`2026-10-01-keep-lane-composition-lead-own-scope-only.md`](2026-10-01-keep-lane-composition-lead-own-scope-only.md)）。
DESIGN §2.3 的顶层表（`:224`–`:240`）只有 13 行，**没有**记这一行，且 §3.3.4 的变化表（`:462`）写的是
`lane-composition` 行**删除** ⇒ 权威文档与产物在这一点上是对立的。本 ADR 引 DESIGN 原文时保留它的
「28 行」字样（引文就是引文），但**本仓的当前数字是 29 / 33 / 36**，以生成器 stdout 为准。
`tools/preset-declaration.mjs:40` 那句「12 个顶层 row」同样是过时注释（同文件 `:452` 写的是 14）。

## 决定

三件事绑成一个机制：

1. **声明清单是单一事实源。** `tools/preset-declaration.mjs` 持有全部 row 的声明数据；散文里
   不再有两份可编辑的 row 清单。
2. **生成器渲染，产物入库。** `tools/gen-cordis-patch.mjs` 渲染出 `cordis.patch.yml`；该产物**提交
   进版本库**并随包发布（`package.json` 的 `files` 白名单含它、`exports` 导出它、`dsh.bundle.patch`
   指向它）。§2.4 把它列为正式交付文件。产物头三行固定写死「DO NOT EDIT BY HAND」与再生成命令。
3. **`--check` 是拦「手改产物」的主门 —— 判据已拆成「硬门 + 警告」两截（2026-10-01）。** `--check`
   重新渲染后与现有文件比较，一致 `ok` + exit 0，不一致 `stale` + exit 1。**它不依赖 Git**——
   §7.3 更正了这一点：参考项目用的是 CI 门 `generate && git diff --exit-code`，但当时工作区不是
   Git 仓库（实测 `exit=129` + `warning: Not a git repository`），所以主门选的是生成器自带的
   `--check`，`git diff --exit-code` 只是「未来建仓（§14 D14 转开源）后」的辅助 CI 门。
   > **硬门 = 机器无关的逐字节比较**（产物内容 == 声明），任何差异 → exit 1；
   > **警告 = provenance 行的差异**（本机宿主配置的指纹），逐字段打 stderr，**退出码不受影响**。
   > 这条拆分及其实测闭合记录见「已闭合项」。

## 考虑过的选项

1. **手维护 `cordis.patch.yml`。** §15 R5 逐字记录了这个选项与被否理由：「**v2 改判**：v1 曾以
   『旧生成器是死代码 + 自用不维护』否掉生成器。但 §2.1 的新事实（**DSH 无 preset 继承 ⇒ 必须
   逐行重复声明 28 个 row**）改变了成本结构：手工同步 28 行的漂移风险 + 许可署名边界的维护成本，
   已超过生成器本身的维护成本。生成器约 120–180 行，无第三方依赖。」注意被否理由里自带成本数字
   ——生成器是 120–180 行无依赖脚本，手工方案的成本是「每个 row 每次都要人肉核对」（DESIGN §15 R5
   原文写的是 28 个 row；当前实际是上文「计数口径」表里的 **29** 个，多出的那一行见
   [`2026-10-01-keep-lane-composition-lead-own-scope-only.md`](2026-10-01-keep-lane-composition-lead-own-scope-only.md)）。

2. **以 `generate && git diff --exit-code` 为**主**门。** §7.3 明确更正：主门不是它。理由有实测
   支撑（当时工作区非 Git 仓库，`exit=129`）。降级为辅助 CI 门，不是被否，是换个位置。

3. **产物不入库，安装时现生成。** 与 §2.4 的交付物清单冲突：`cordis.patch.yml` 是 bundle 的**唯一
   挂载入口**（§2.2），`package.json` 的 `files` / `exports` / `dsh.bundle.patch` 三处都指向它。
   现生成会让 npm 产物面多一个构建步骤、让 `--check` 失去比对对象（没有「已提交的产物」可比），
   也让 §12.6 的发布边界清单多一项要证明的东西。

## 后果

- **多了一件要同步的东西：声明 + 产物。** 这是这个决定的直接代价，也是 §7.3 说 `git diff` 门禁
  「当前不可运行」时要格外小心的原因。
- **`--check` 只能抓一类漂移：「声明改了但产物没重新生成」。它抓不到「生成器自己产出了结构上错误
  的东西」**——判据是同一份 `render()` 的输出与文件逐字节相等，生成器整体改错时两边一起错，
  `--check` 仍然 exit 0。补法是架构契约测试 `tools/patch-contract.test.mjs`：它抓形状（顶层只有
  `insert`）、行 id 集合（由声明推导，不复制产物）、与官方 preset 的关系（§2.3 删除的行不许复活）、
  行边界（每个 lane 行恰好一个 `toolFilter`；`allow` / `deny` **二选一**是**本项目房规**，依据
  §3.3.3 共同约定 `:433`「只读 lane 用 deny；reader 用 allow 白名单」——**不是**宿主的约束：
  宿主只在两者**皆空**时抛（`dsh-tool-subagent/lib/index.js:370`，DESIGN §3.3.2 约束 3 `:414`
  说的也只是「不能同时为空」），allow 与 deny 同时给**不被宿主拒绝**）。
- **三条「值级别」的不变量曾经零覆盖，现在被断言钉住了**（2026-10-01 补，均为 mutation 实测：
  改声明 → 重新生成 → `--check` exit 0 → 旧测试全绿）：
  ① 官方保留行的 `config` 值（`agent-instructions.maxBytes`、`tool-fs-search.sampleOverCapGlobResults`、
  `tool-todo.allowParallelInProgress`、`tool-web.fetch/searchTimeoutMs`、`tool-result-pruner.*`）
  与**已安装的权威骨架**逐字一致（期望值在测试运行时从骨架文件现场读，不写死字面量 ⇒ 骨架仍是权威，
  也不重新引入 §3.3.4 `:495` 那个已被用户裁决删除的闭集门）；② 9 个 lane 的 `maxDepth` 全为 `1`
  （§3.3.3 lane 表 `:437-445` / §7.3 `:1204` / §15 R11 `:1754`）；③ `delegation` 组**不带** `isolate`
  （§14 D21 `:1708` = 删）。这三条在 mutation 下各自**恰好**让一条断言失败，且 `--check` 同时 exit 0。
- **产物里有一行按机器派生：shell 来源的 provenance。** 它的每个字段都来自**本机**的宿主侧已组装
  配置，换一台机器必然不同 ⇒ 这一行**整体**不参与「产物 == 声明」的逐字节门禁，只作为
  **宿主漂移信号**逐字段打到 stderr（见「已闭合项」）。
  **遮蔽它不等于放过它**：真正决定工具面的 `bash=` / `pwsh=` 两项仍在警告里**逐字段点名**，
  且契约测试继续对**产物内容**（provenance 之外的全部行）逐字节断言。
  ⇒ 「`npm test` 绿」现在的含义是「**除 provenance 行以外**，产物与声明同步」—— 这正是设计要的
  含义，也正是 `--check` 的含义；两者用**同一个函数**判定（`compareMachineIndependent`）。
- **官方骨架取不到时必须 loud 停（exit 2），不许默认值兜底**（§2.2 G5）。四条候选
  （`--skeleton` > `$DSH_SKELETON` > `<DSH home>/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml`
  > 仓内 vendor 骨架）全落空就停，不编造。
- **什么时候重新审视**：官方 `preset-standard` 的 row 集合稳定到不再需要逐行复制（DSH 加了继承），
  或者仓库建起 CI 后 `--check` 可以并进流水线、逐字节比较的假失败面自然消失。


## 已闭合项（2026-10-01：`--check` 拆成两个判据）

**原先的债**：`--check` 逐字节比较含 provenance 行 ⇒ 一个**已提交**的产物在任何别的机器上都被判
`stale`（未改动的树上 exit 1），差异只有 `normalized-digest`（产物 `f3e18fa917d1` vs 本机
`75a5bad3bdc0`）。**用户裁决**：把两个不同的问题拆开。

| 判据 | 问的问题 | 机器相关 | 处置 |
|---|---|---|---|
| **硬门** | 产物内容 == 声明的渲染结果？ | **否** | 任何差异 → `stale` + **exit 1** |
| **警告** | 本机解析出的 provenance 指纹与产物记录的不同？ | 是 | 逐字段打 **stderr**，**退出码不受影响** |

- **实现**：`--check` 现在用 `compareMachineIndependent(existing, rendered)`（`tools/gen-cordis-patch.mjs`，
  紧邻 `render()`）判定。**硬门 = 遮蔽 provenance 行之后的逐字节相等**；遮蔽规则是
  `MACHINE_DERIVED_LINE`（**整行**匹配，`.*$` 不可省 —— 只匹配前缀的话，行尾那串 token 会留在被
  比较的文本里，机器相关性根本没去掉）。
- **判据的单一 home**（本仓规则「一个事实只有一个 home」）：这条规则**住在生成器里**并导出，
  `tools/patch-contract.test.mjs` **import 同一个函数**。两处各写一份遮蔽规则 = 两个 home =
  迟早分叉 = 又一层「绿色掩盖红色」。测试还额外断言：改掉 provenance 行**不得**让比较失败，
  改坏一行真实内容**必须**失败。
- **为什么不另开 `tools/provenance.mjs`**：`.gitignore` 对 `tools/` 是**逐个文件放行**
  （`/tools/*` + 一串 `!`），新文件默认被忽略、不进版本库，而 `.gitignore` 当时正由另一条 lane 编辑。
  这条规则是 `render()` 自己的性质，住在渲染器旁边本来就是它该在的地方。
- **为什么遮蔽整行、而不只遮蔽 digest**：这一行的**五个字段全都按机器变化** ——
  `kind`（链上哪一项命中）、`fallback`（是否回退）、`bash=` / `pwsh=`（**生效值** + **来源行号**，
  后者是宿主组装文本里的行号）、`normalized-digest`。只遮 digest 的话，宿主多装一个插件就会让
  `@258` 变成别的数 ⇒ 门**仍然**跨机器不成立。实测（合成 home，五个字段全不同）仍 exit 0。
- **警告里哪一项该管**：`bash=` / `pwsh=` 决定产物里 shell 工具的启用面，**它们不同才需要人看**；
  `normalized-digest` 是纯指纹，不影响产物行为。警告逐字写明「门已通过、退出码不受影响」，
  并且明确劝人**不要**为了消掉它而在某台机器上重新生成再提交（那只是把指纹换成那台机器的）。
- **没有削弱任何别的东西**：写盘路径（`wrote`）与 `render()` 的模板**逐字未改**；骨架解析、
  loud 停、crosscheck、计数打印全部原样；`stale` 现在还会**指名道姓**报出第一处不同的行与两行原文
  （报的行号取自**机器无关**文本，所以它指向真正坏掉的那行，而不是那条本来就该不同的 provenance 行）。
- **闭合判据三条，全部达成**（实测记录见 `.dsh/evidence/forge-check-gate-machine-independent.md`）：
  ① 本机 `--check` → **exit 0**；② 合成 `DSH_HOME`（骨架 + 装配配置都指向别处、五个字段全不同）
  → **exit 0**（默认 crosscheck 也开着）；③ 契约测试的遮蔽**已删**，套件 14/14 通过。
- **残留的诚实边界**：硬门对 **provenance 行**不再有约束 —— 那一行被手改成乱码也只会得到一条
  「无法逐字段解析」的警告（`provenanceWarnings` 的空字段分支），不会 exit 1。这是「机器无关」的
  必然代价：那一行的内容按定义不属于「产物 == 声明」。要防手改，防线是产物头三行的
  `DO NOT EDIT BY HAND` 与本 ADR，不是门。
