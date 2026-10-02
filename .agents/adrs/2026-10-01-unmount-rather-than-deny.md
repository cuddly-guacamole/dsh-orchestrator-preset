# ADR: 不需要的官方 row 一律**不挂载**，而不是「挂载后在各 lane 里 deny 掉」

状态：已采纳

## 背景

§2.3 给了一张「删除项与理由」表，逐条对照 `preset-standard` 的 row 列表。§7.3 把这条纪律列为
强制手段而不是偏好——「机械化 vs 散文纪律的分界表」里，「`workflow` / `ralph` **真的不存在**」这一
行的机械手段写的是「**不挂载对应 row**（§2.3）」，同表里「Team 工具族真的不存在」写的是「bundle 的
`plugins[]` **不声明任何 Team 行**（§5.6「物理上只剩一套」）」。

这些行并不是「没用但无害」：§7.3 记着 `workflow-ptc` 强制要求 `isolate: {workflowEngine: true}`
（它 provide `workflowEngine`），挂载它会带进来一层 realm 边界需求；§3.3.3 的差异表记着裸
`tool-subagent` 行带 `modelSelectionSettings` 键，而该键在一个 tool scope 内最多一个实例能拥有
（§3.3.2 的其他硬约束表）。

## 决定

以下 10 个官方 row id **不出现在** `cordis.patch.yml` 的 `plugins[]` 里（§2.3 删除项表 + §15 R16）：

| row | §2.3 给的理由 |
|---|---|
| `command-goal` / `tool-goal` | 本 preset 不需要运行期 goal 服务。目标定义域由 `aegis-goal-framing` 的 `TaskIntentDraft` 写入 `.dsh/goals/`（§4.3） |
| `present` | 本 preset 的交付物是代码与 Markdown，不需要文件卡片 |
| `tool-plugin-manager` | `preset-standard` 里本就是 `disabled: true`；不需要 |
| `tool-ralph` | `preset-standard` 里本就是 `disabled: true`；且与「只用 `subagent_*`」的意图不符 |
| `tool-subagent-codex` / `tool-subagent-claude-code` | 生产 DSH 未安装这两个 provider；`preset-standard` 里本就是 `disabled: true` |
| `workflow-ptc` / `tool-workflow` | **主动删除**。C2 的意图是「不用工作流引擎」 |
| 裸 `tool-subagent` 行 | 被 9 个具名 lane 行取代 |

派生的第二条决定：`delegation` 组**删掉** `isolate: {workflowEngine: true}`（§14 D21 = 删）。
§2.3 给的推导是：删掉 workflow 两行后，组内不再有任何 provide service 的 row，`isolate` 就只增加
一层不必要的 realm 边界；§3.3.2 的其他硬约束表记着「任何 provide service 的 row 必须在带
`isolate` 的 group 内，否则 mount 抛 `Preset services require isolate realms: <names>`」——
没有 service 就没有这条约束。

这些被删掉的工具名**同时也不进**任何 lane 的 `toolFilter.deny` 名单（§15 R16 的第 ③ 条联动）。

## 考虑过的选项

1. **挂载它们，但用 `toolFilter.deny` 在各 lane 里禁掉。** §15 R16 逐字记录了这个选项与被否理由：
   - ① 「不挂载 ⇒ 不存在」比「存在但 deny」更彻底（§5.6「物理上只剩一套」）；
   - ② 挂载会带来额外的 row 维护与 isolate 需求（`workflow-ptc` 强制
     `isolate: {workflowEngine: true}`）；
   - ③ **但必须连带从 deny 名单里移除它们的名字，否则 child 首次 setup 抛
     `names unknown global tool`（不是 mount 失败，§3.3.2 约束 2 的更正）——这个联动成本是本决策
     的代价**。

   注意第 ③ 条被 §15 R16 明写为「本决策的代价」而不是「否决理由」：这条纪律**买到了**①②，
   **付出的是**③。这一点在这里如实重复一遍，免得后来的人以为它是白捡的。

2. **只删 `workflow` / `ralph`，goal 与 `present` 留着备用。** 这是 §14 D17 的选项 B（「在
   `toolFilter.deny` 是否预留 `create_goal` / `get_goal` / `update_goal` / `present`」），被否的理由
   与选项 1 的第 ③ 条同源。§14 D17 取 A（不预留）。

## 后果

- **加回任何一行，都是一处两改。** 必须在声明里挂载它，**并且**在所有只读 lane 的 deny 里加回对应
  的工具名（§14 D17 的联动规则）。漏掉第二步的后果不是 mount 失败，是那个 lane 第一次派发时抛。
- **这条纪律已经被机械化钉住。** `tools/patch-contract.test.mjs` 把这 10 个 id 写成常量断言：既要求
  它们确实存在于权威官方骨架里（防止清单过期成空话），又要求它们一个都不许出现在产物里（防止悄悄
  复活）。
- **裸 `tool-subagent` 被 9 个具名 lane 行取代之后，`modelSelectionSettings` 不需要裁决给谁。**
  该键在「一个 tool scope 内最多一个实例」的限制下 9 个 lane 同时挂载时必然冲突，所以 §14 D18 取
  「全不设」，行为可预测。
- **同一条纪律的另两次应用**（不是「删官方行」，是同一条纪律）：§2.2 记 `lane-composition.mjs`
  **不迁移**（752 行归零，§1.3），`personas/sisyphus.md` 与 `personas/atlas-aegis.md` **不迁移**
  （前者与 master 职责重叠，后者主体是旧编排规则、只有表结构被 §5 借形）。「搬进来的东西要逐条判」
  是同一个判断，不是两套标准。
  ⚠️ **其中 `lane-composition` 那一条后来被推翻了**（2026-09-25 的 T16 重写了它，行数从 752 变成 288，
  职责从「给 Team 路径补 persona + toolFilter」变成「给 Lead own scope 补 3 个 lane 寻址工具」，
  该行**已在产物里**）。推翻记录见
  [`2026-10-01-keep-lane-composition-lead-own-scope-only.md`](2026-10-01-keep-lane-composition-lead-own-scope-only.md)；
  本条保留原样，是因为「当时确实判了删」这个事实本身也是决策轨迹的一部分。
- **什么时候重新审视**：需要运行期 goal 服务（→ `tool-goal`）、需要文件卡片（→ `present`）、或者
  需要工作流引擎（→ `workflow-ptc` / `tool-workflow`）中的任何一项成为真实需求。届时按 §14 D17 的
  联动规则两处一起改，不要只改一处。