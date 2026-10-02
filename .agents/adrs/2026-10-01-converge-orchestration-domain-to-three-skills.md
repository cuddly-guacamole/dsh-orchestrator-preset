# ADR: 编排域 6 重 owner 收敛 —— 三个 aegis 技能按入口条件各占一个互斥场景，后三个全部退役

状态：已采纳（§4.2 标注为「本设计的核心裁决」；**已落地，但第二段 owner 又被进一步收窄** —— 见「后果」里的已知偏差）

## 背景

`docs/DESIGN.md` §4.2（`:758`，标题里就写着「**本设计的核心裁决**」）要处理的是**同一个编排问题
有 6 个 owner**这件事。`:760` 把这 6 个列全了：

- `aegis-executing-plans`
- `aegis-subagent-driven-development`
- `aegis-dispatching-parallel-agents`
- `aios`（整条调度权）
- `dsh-batch-delivery`
- 旧 `sisyphus.md` 人设

6 个 owner 并存的代价不是「文件多了 6 份」：它们对「什么时候该派谁」给出**互相冲突**的答案，而
DSH 没有 `alwaysApply`（§3.6）⇒ 没有一个位置能在每回合把它们摊开给模型看。裁决的前提是 §4.1 的两条：
owner 是**技能或服务**而不是 persona（persona 只做路由）；上游技能名不改（`aegis-*` 命名空间已被
`aegis-skill-prefix` 占据，改名会与它的注册逻辑打架）。

`:762` 一句话给出裁决：**不合并前三个；按「入口条件」三分，各自独占一个互斥场景；后三个全部退役。**

## 决定

**编排域收敛为三个互斥入口 + 零个本地替代实现。** 判据只有一条：**入口条件**，不是「任务大小」、
不是「几个人」、不是「哪个技能名字更顺口」。

| 候选 | 裁决 | 独占的入口条件（`:764` 表） |
|---|---|---|
| `aegis-executing-plans` | 保留 | 有**书面计划** + 执行**跨会话**或**带审查检查点** |
| `aegis-subagent-driven-development` | 保留 | 有**书面计划** + 任务**基本独立** + **同会话**执行 |
| `aegis-dispatching-parallel-agents` | 保留 | **无书面计划** + `2+` 独立任务 + 无冲突共享可变状态 + 无顺序依赖 |
| `aios`（整条调度权） | **退役** | 与 `aegis-using-aegis` 的每回合最小路由**主权冲突**；它的调度机制被拆成 6 组落进 §6，调度权本身不保留（`:769`） |
| `dsh-batch-delivery` | **退役** | 已被 `dsh-auto-approval-llm` 的技能取代（实测 149 行、6 处 `REQUIRED aegis:`、专设的 aegis 路由表），**且它是死技能**（无 frontmatter，§3.6）（`:770`） |
| 旧 `sisyphus.md` 人设 | **退役** | 与 master persona 职责重叠（§3.1）（`:771`） |

**互斥性是「被声明出来的」，不是「被相信的」**：`:782` 记着三个上游技能的 `description` 字段
本身已声明两两互斥（上游路径 `aegis/skills/{executing-plans,subagent-driven-development,dispatching-parallel-agents}/SKILL.md`
的 frontmatter `description`；本轮已对着已安装副本
`~/.dsh/profiles/desktop/node_modules/aegis/skills/*/SKILL.md` 逐条核对，三句确实是「跨会话/检查点」、
「同会话独立任务且委派优于内联」、「无书面计划的 2+ 独立任务」三种互斥入口），上游负责互斥；
本地唯一职责是**把判据提到每回合可见的位置** —— 即 `:773` 说的「三者互斥性的机械表达」：写进 §5 的
常驻路由 section。§4.3（`:790`）的域 owner 表随之只留一行：「编排 ｜ 三技能按入口条件分派 ｜
6 → 3，且三者互斥」。

**被否的替代方案**（`:784` 转指 §15 R1 `:1744`）：① 合并成一个自研编排技能；② 只保留
`aegis-subagent-driven-development` 一个。

## 考虑过的选项

1. **合并成一个自研编排技能。** §15 R1 逐字记着被否理由：「自研编排技能 = 重新发明 aegis 已写好的
   三套互斥流程，且必然与 aegis 上游漂移；用户要的『编排层自研』是**壳**（lane 能力边界 + 路由），
   不是流程正文。」⇒ 推论：**撤销本裁决的代价**主要不在编排域本身，而在 22 个 aegis 技能的纪律上 ——
   三个入口条件要重新落到某个地方承载，而 §15 R8 / R9（`:1751`/`:1752`）明确禁止改上游技能正文，
   于是只剩「塞进 persona」一途，等于把每回合 token 成本换回来（与 §15 R12 同源）。
2. **只保留 `aegis-subagent-driven-development` 一个。** §15 R1 第 ② 条：「丢掉跨会话执行与临时并行
   两个真实场景」—— 这两个场景在本仓是活的（跨会话用 `writing-plans` + checkpoint；临时并行用
   `aegis-dispatching-parallel-agents` 的六条 Dispatch Gate）。
3. **保留前三个，另外三个只「降级为文档」不退役。** 被否：退役的对象是**主权**不是文件。`aios` 留着
   调度权就与 `aegis-using-aegis` 的每回合最小路由冲突（`:769`）；`dsh-batch-delivery` 留着就与
   `dsh-auto-approval-llm` 重复（`:770`）；旧 `sisyphus.md` 留着就与 master persona 职责重叠（`:771`）。
4. **把判据写进 `orchestrator.md` 正文。** 被 §15 R14（`:1757`）否掉：行为引导放 system 会衰减甚至
   反向（参考项目实测路由崩到 67%），其主线已改为「常驻静态段 + `order` 优先级」⇒ 落点 C
   （`routing-sections.mjs`）。**这条不是本裁决的内容，但它是本裁决能不能落地的前提** —— 判据必须
   每回合可见，否则「唯一 owner」只是一句文档里的话。

## 后果

- **编排域的入口条件从此是互斥的枚举，不是权重排序。** 派发前先判入口条件；判不出归属就是判据不足
  （写不成计划 / 任务不独立），不是「挑一个顺眼的技能」。
- **⛔ 已知偏差（本轮未修，因不在授权内）：第二段 owner 已被进一步收窄到本 preset 自己的 lane 纪律。**
  `:767` 与 `:778` 写的是「同会话独立任务 → `aegis-subagent-driven-development`」，而**已发布的常驻
  路由 section 写的是**「written plan + same-session independent tasks → **this preset's own lane
  discipline**」（`routing-sections.mjs:37`），并在 `:92` 逐条给出理由：该技能的「fresh subagent per
  task」与「never inherit your session's context or history」与本 persona 的复用不变量 I6 冲突，其
  commit 步骤在本工作区不是 Git 仓库时没有意义。
  ⇒ **今天真实的收敛是 6 → 2 个上游技能 + 1 段本地纪律**，不是 6 → 3。
  两点必须一并说清：① 那个理由里的「工作区不是 Git 仓库」**今天已经不成立**（本仓已 `git init`
  并发布），该条理由只剩前半段仍然有效；② 修 `:767` / `:778` 的措辞要改 `docs/DESIGN.md`，
  不在本轮写入范围内。该偏差登记在 [`../README.md`](../README.md) 的「已知当前偏差」。
- **退役三者的联动成本是「删掉三处纪律的载体」，不是删三个文件。** `aios` 的调度机制已被拆成 6 组落进
  §6（`:769`）—— 机制留下了，**主权**不留；`dsh-batch-delivery` 的内容被 `dsh-auto-approval-llm` 接走；
  旧 `sisyphus.md` 的定位由 `wright` 覆盖（§3.3.4 变化表）。所以恢复任何一个 owner 都是**新增主权**，
  不是「打开一个开关」。
- **本地只做壳。** 本 preset 自己新增的编排能力只有四项：lane 能力边界（`toolFilter` + `maxDepth`）、
  常驻路由 section、委派函与证据协议两个技能。流程正文一律不重写（§15 R7 `:1750` 的「结构尽量薄」）。
- **机械门**：常驻路由 section 是**静态文本**（`routing-sections.mjs:33` 的 `DOMAIN_OWNERS` 常量），
  它是否真的每回合注册由 §2.3（`:245`）负责 —— 那一行逐字写着「**运行期是否真的注册，由 N2-b
  （T24 的 V29b 真跑）验证，本节不声称已证**」⇒ **不由本 ADR 声称**。可机械核对的部分是：产物里
  那一行的 `name` 指向本包（`cordis.patch.yml:23-24`），且它与官方 id 不撞名
  （`tools/patch-contract.test.mjs` 的「preset 内的本包自写挂载行」那条断言）。
- **什么时候重新审视**：DSH 获得技能常驻语义（`alwaysApply` 或等价机制）⇒ 判据不必再靠 section 承载；
  或上游三个技能的互斥声明被改掉（`:782` 的前提失效）；或 Team 族真的进入编排路径（则入口条件要重开，
  见 [`2026-10-01-keep-lane-composition-lead-own-scope-only.md`](2026-10-01-keep-lane-composition-lead-own-scope-only.md)）。
