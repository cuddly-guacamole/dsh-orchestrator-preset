# ADR: 保留 `lane-composition` 行 —— 但只保留「Lead own scope 的三个 lane 寻址工具」这一种职责

状态：已采纳（2026-09-25 T16 实施；**它推翻了 `docs/DESIGN.md` 的相反记载** —— 见「后果」里的已知偏差）

## 背景

`docs/DESIGN.md` 在**四个地方**判定 `lane-composition` 归零，理由是 C2（Team 路径整条不进本 bundle）：

| 位置 | 原文（节选） |
|---|---|
| `:146`（§1.3 不是清单） | 「**不是** 一个自持编排引擎（不再有 752 行的 lane 组合器）」／「C2 的直接推论：`lane-composition.mjs` 存在的唯一理由是给 Team 路径补 persona + toolFilter；不用 Team ⇒ 该模块归零」 |
| `:200`（§2.2 不迁移清单） | 「**`lane-composition.mjs` 不迁移**（752 行归零，§1.3）」 |
| `:286`（§2.4 Bundle 合计） | 「净减主要来自：`lane-composition.mjs` 752 行归零 + …」 |
| `:462`（§3.3.4 变化表） | 「`lane-composition` 行 ｜ 存在（`:81-87`）｜ **删除** ｜ C2 推论（752 行归零）」 |

这四条在写下时是自洽的：Team 工具族按**名字**寻址 teammate（`send_message` / `list_agents` /
`interrupt_agent`），而本 preset 的 9 个 lane 全是 `subagent_*` 行（§2.3 的 `delegation` 组）。
⇒ 在「Team 接管 Lead 控制面」这个前提下，Team 那三个工具**够不到** `subagent_*` 子代，旧的
752 行模块也就没有存在理由。

**但这个前提在实现期不成立**，而 DESIGN 没有记这次反转。唯一的记录是代码注释
（`tools/preset-declaration.mjs:455-456`）：

> ⚠️ **第 2 个新增挂载行 = `lane-composition`（T16，2026-09-25）**：它注册 Lead own-scope 的 3 个
> lane 寻址工具（`subagent_children` / `subagent_send` / `subagent_interrupt`），形态照 `routing-sections`。

产物与发布面的现状（2026-10-01 实测）：

| 事实 | 位置 |
|---|---|
| 该行**在**产物里，`name` 指向本包 | `cordis.patch.yml:25-26` |
| 声明里有这一行（`topRows` 第 3 条） | `tools/preset-declaration.mjs:460` |
| 随包发布 | `package.json:51`（`exports`）、`package.json:77`（`files`） |
| 模块**不是** 752 行那个，是 288 行 | `wc -l lane-composition.mjs` = 288 |
| 它注册的 3 个名字进了 3 份 deny | `preset-declaration.mjs:126-146`（`READONLY_DENY` / `WRIGHT_DENY` / `FORGE_DENY`） |

**一个推翻权威文档的改动，只存在于一句代码注释里** —— 这正是 ADR 存在的理由。

## 决定

**保留 `lane-composition` 挂载行，且把它的职责收窄到唯一一件事：给 Lead 自己的座位补上寻址
`subagent_*` 子代的那三个动作。** 旧职责（给 Team 路径补 persona + toolFilter）**不恢复**。

具体边界（依据 `lane-composition.mjs:1-30` 的实现者注释）：

1. **只做子代寻址，不做编排。** 它注册 `subagent_children` / `subagent_send` /
   `subagent_interrupt` 三个工具，**不注册** persona、**不注册** `toolFilter`、**不决定**谁该被派发。
   派发纪律仍然由 `personas/orchestrator.md` 的不变量与常驻路由 section 承担。
2. **名字必须是新的三个。** 上游 aegis 包与 Team 族按裸名注册；复用 Team 名字会在 Lead 自己的层里
   撞名（`dsh-scope/lib/index.js:27-29` 的 `insert()` 对层内重名抛 `duplicateError` —— 本条已对着
   已安装的宿主源码核对），一次冲突会把整个 Team 工具集连同共享任务板一起回滚。
3. **工具必须**全局**注册**（`ctx.tools.register`），不能注册进某个 agent 的 scope。
   `tools.restrict()` 只接受**全局注册**的名字：一旦是 scoped 注册，9 份 lane deny 里的这 3 个名字
   就变成非法名，lane 的 setup 整体抛错 —— 该模块曾用这个方式把整个 lane 家族打挂。
4. **3 个名字必须同时出现在全部三份 deny 名单里**（只读 6 lane 共用 `READONLY_DENY`、`wright` 用
   `WRIGHT_DENY`、`forge` 用 `FORGE_DENY`）。漏掉的后果**不是** loud 失败，是 lane 获得了寻址
   其它 lane 的能力 —— 边界静默失效。这是本决定继承下来的联动成本（与 §14 D17 / §15 R16 的联动规则
   同源）。这 3 个名字对 lane 而言是**从 Lead 那一层继承来的**（`preset-declaration.mjs:122-125` 记着
   依据 `dsh-scope` 的 `chainLayers` 与 `dsh-tools` 的 scope 继承）⇒ 它们落在 `restrictableNames` 内
   ⇒ deny 合法且生效。

## 考虑过的选项

1. **保持 DESIGN 的原判：整行删除。** 被 2026-09-25 的实现事实推翻。理由链：Team 的三个控制面工具
   按**名字**寻址，够不到 `subagent_*` 子代；而本 preset 的编排**全部**走 `subagent_*`（§2.3）⇒
   删掉之后，Lead 没有任何工具能列出、续轮或中断自己的子代。**注意**：DESIGN 侧**没有**记录这次
   反转，本 ADR 是它目前唯一的记录（`preset-declaration.mjs:455-456` 那句注释是第二处）。
2. **恢复 752 行那个模块的原职责（给 Team 路径补 persona + toolFilter）。** 被 C2（`:124`）/ §5.6
   （`:918`「可迁移的思想：物理上只剩一套」，`:1205` 把它写成「Team 工具族真的不存在」的机械手段）
   否掉：Team 路径整条不进本 bundle，preset 也不该为一条不存在的路径预置组装逻辑。
3. **把这三个工具的说明写进 `orchestrator.md` 正文而不是做成插件。** 与 §15 R12（`:1755`）同源：
   persona 每回合注入，插件形态可被 `toolFilter` 机械地按 lane 切掉，正文形态不能 —— 而
   「lane 看不到寻址工具」正是本决定第 4 条要保证的。
4. **注册这三个工具但不加进任何 deny。** 被否：那只保证 Lead 能用，不保证只读 lane 看不到。三个名字
   对 lane 是**继承来的**（`dsh-scope` 的 `chainLayers` + `dsh-tools` 的 scope 继承），落在
   `restrictableNames` 内 ⇒ 不 deny 就会出现在 lane 的工具面里。取 deny。

## 后果

- **声明口径的 row 数从 28 变成 29。** DESIGN §2.4（`:271`）的算式是「13 顶层 + 3 group +
  3 delegation 控制 + 9 lane = 28」，第 14 个顶层行就是本 ADR 这一行。三套数字的完整定义见
  [`2026-10-01-declaration-plus-generator-check-gate.md`](2026-10-01-declaration-plus-generator-check-gate.md)
  的「计数口径」表。
- **⛔ 已知偏差（本轮未修，因不在授权内）：`docs/DESIGN.md` 仍写着这一行「删除」。** 上面那四处的
  依据是「Team 那三个工具够得到 `subagent_*` 子代」，而这个前提今天不成立。修它要改
  `docs/DESIGN.md`，本轮的写入范围不含 `docs/**`。该偏差同时登记在
  [`../README.md`](../README.md) 的「已知当前偏差」一节 —— **不要**把 DESIGN 的那一行当成现状。
- **删除这一行是「一处三改」的反向版**：要撤掉它，得同时删声明里的 row（`preset-declaration.mjs:460`）、
  产物里的行、3 份 deny 里的 3 个名字（否则 restrict 会因未知名抛错，把 lane 打挂）、以及
  `package.json` 的 `exports` / `files` 两处。四处一起改，漏一处的后果各不相同。
- **机械门（已钉住的部分）**：`tools/patch-contract.test.mjs` 断言 preset 内三个本包自写行的 id 集合
  恰为 `persona` / `routing-sections` / `lane-composition`、它们挂本包 specifier、且与官方 id 撞名的
  恰好只有 `persona`（**这一条挡住「顺手把它改名成 `orch-*`」**）。同时 `delegation` 组不带 `isolate`
  的断言也覆盖了本决定的第 4 条的一半。
- **机械门（未钉住的部分，如实记着）**：第 4 条「3 个名字必须出现在全部三份 deny 里」当时**没有**
  断言；已在本轮补上（`lane 寻址的 3 个工具名不得出现在任何 lane 的工具面里`），mutation 实测可失败。
- **什么时候重新审视**：Team 族真的进入本 preset 的编排路径（那时 §4.2 的第三个 owner 判定要重开），
  或者宿主给 `subagent_*` 子代提供了原生寻址工具（那这三个工具就该归零，且本 ADR 应标废止）。
