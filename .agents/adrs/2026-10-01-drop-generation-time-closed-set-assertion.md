# ADR: 不做生成期工具名闭集断言 —— `toolFilter` 写错名字的兜底是 child 首次 setup 时的 loud 失败

状态：已采纳（第 6 轮用户裁决删除了原机制；本 ADR 记录的是**删除后**的立场）

## 背景

§3.3.2 约束 2 更正了一个文档与实现不符的说法。`dsh-tool-subagent` 的类型文档写「unknown names
fail startup」，但实现不是这样：

- `dsh-tool-subagent/lib/index.js:370` 的 `apply()` **只校验 `allow` / `deny` 非空**，`:518` 把
  `config.toolFilter` **原样透传**，不校验名字；
- 真正的名校验在 `dsh-tools/lib/index.js:2895-2908` 的 `restrict()`（抛
  `names unknown global tool "…"`，并列出已知名），调用点是 `dsh-subagent/lib/index.js:522` 的
  `childCtx.tools.restrict(composition.toolFilter)`，它在 `applyChildComposition` 内、由
  `materializeTracked` 的 **child setup 回调**（`dsh-subagent/lib/index.js:1065-1074`）触发。

也就是说：**写错 deny 名不会让 preset 挂载失败，只会让那个 lane 的第一次派发炸掉**。这条事实
决定了「在生成期做工具名闭集断言」到底能买到什么。

## 决定

生成器与声明**不做任何工具名闭集断言**。§9「失败与降级处理」第 2 条写得很直白：「⛔ 无机械门：
生成期闭集断言已被第 6 轮用户裁决删除（§3.3.4 的 ⛔ 段）。兜底 = **child 首次 setup 时的 loud
失败**。」

`LEGAL_TOOL_NAMES` 因此降级为**参考清单（REFERENCE list），⛔ 不是门**：只供人读与产物自检
（「本 preset 声明的 row 确实产出了这些名字」），**不得**用它拦 deny / allow 名单。

同样的纪律写进了三处代码注释与文档（`tools/preset-declaration.mjs` 文件头 36–38 行、
`tools/gen-cordis-patch.mjs` 文件头 17–19 行、§3.3.2 约束 2 的「不要」段），因为一个叫
`LEGAL_TOOL_NAMES` 的常量留在代码里，下一个读到的人很容易把它当成门用。

## 考虑过的选项

1. **在生成期用 `LEGAL_TOOL_NAMES` 断言 deny / allow 里的每个名字。** 被否，三条理由（§3.3.2
   约束 2 的⛔ 段 + §9 第 2 条）：
   - **前提做不到**——MCP 工具由部署层按用户配置动态注册，不存在可穷举的静态闭集；
   - **收益被证伪**——错名**不是 mount 失败**，而是 child 首次 setup 抛 `names unknown global
     tool`，炸得 loud 且点名未知名并列出已知名，对已经 §3.3.2 约束 1「被过滤工具从 child prompt
     消失且调用被拒」那样 loud 的失败机制已经足够；
   - **成本是负的**——它会**主动阻止补齐真实安全边界**。

2. **在 `toolFilter.deny` 里**预留**未挂载工具的名字（§14 D17 的选项 B：`create_goal` /
   `get_goal` / `update_goal` / `present`）。** 被否，§14 D17 给的理由：「B 会让 child 首次 setup
   抛 `names unknown global tool`（**不是 mount 失败**，§3.3.2 约束 2 的更正）。」本 design 取 **A
   （不预留）**，只写确实挂载的工具。

3. **新增插件代码级硬原语，在 agent 创建时按当时注册表收紧。** 被否，§14 D24 已表态（2026-09-25
   用户裁决）= **D：落纪律约束，不新增代码**。§14 D24 同时记录了「能力存在」的源码事实（每个含
   depth 0 的 agent 都有自有 scope + 通用 `restrict()`），否掉的理由是**用户明确选择不新增代码**，
   不是技术上做不到。

## 后果

- **失败点被后移到运行期，这是明知的代价。** 一个 deny 名单写错的 lane 能正常挂载、能被常驻路由表
  点名，直到第一次真的派发它才抛。发布前没有任何机械门提示这件事。
- **「不预留未挂载工具的名字」与「不挂载不需要的行」是成对的联动规则。** §14 D17 的联动规则写明：
  「若未来加回 `tool-goal` 或 `present`，**必须同步在所有只读 lane 的 deny 里加回对应名字**。」
  漏掉第二步的后果不是 mount 失败，是那个 lane 第一次派发时抛。
- **通道残余如实记着，不假装解决。** §14 D24 明确记录：`mcp__*` 面**未被机械收窄**，只读 lane 仍
  可能在工具面里看到真实 MCP 工具，该面**记为已知残余 / 未验证**，与 V14 / V15 / V24 / V25 / V29b
  同列入待验证区。
- **`LEGAL_TOOL_NAMES` 这个名字有误导性。** 它现在只是参考清单。任何后来的人看到「LEGAL」二字就
  想拿它当门——所以它的定义处必须留着「⛔ 不是门 / 禁止用它拦 deny、allow 名单」的那几行注释。
- **什么时候重新审视**：DSH 把 `toolFilter` 的名字校验移到 mount 期（那时闭集断言的收益才真正
  成立），或者 MCP 工具名变得可以静态穷举。