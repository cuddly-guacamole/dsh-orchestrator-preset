# ADR: DSH 没有 preset 继承 / 组合机制，所以 `plugins[]` 必须逐行完整重述

状态：已采纳

## 背景

`docs/DESIGN.md` §2.1「前置事实：DSH **没有** preset 继承 / 组合机制」列了三条经核对的事实：

- `PresetDefinition` 只有 5 个字段，**无** `extends` / `base` / `inherit` / `parent`（依据：`dsh-agent-preset-registry/lib/types/definition.d.ts`）；
- 只有「整体覆盖」：按 id 写覆盖补丁会**替换完整子插件列表，不自动合并**（依据：`dsh-agent-preset-registry/README.zh.md:48`、`:95`）；
- 组内可以用 `cordis:group`，但它**只对自己的内容有效**。

§2.1 据此判定两条路都不可行——「只声明自己的增量行」不可行，「引用官方 preset 作为 base」也不可行。

后果直接落在 §2.3：12 个保留行的配置值必须与 `preset-standard` **逐字一致**，包括 `tool-fs`、
`tool-fs-search`、`tool-jobs`、`tool-skill`、`agent-instructions`、`tool-ask-user`、`tool-todo`、
`tool-web` 这些原封不动的官方行。§2.2 的备注也点明了这件事的分量：它说「28 个 row 里大量是官方 row
的逐字复制」—— **28 是 DESIGN §2.4（`:271`）的算式**（13 顶层 + 3 group + 3 delegation 控制 + 9 lane）；
当前声明口径是 **29**（多出的那一行是 T16 加的 `lane-composition`），三套数字的完整定义见
[`2026-10-01-declaration-plus-generator-check-gate.md`](2026-10-01-declaration-plus-generator-check-gate.md)
的「计数口径」表。逐字一致这条**现在有测试钉住**：官方保留行的 `config` 值在测试运行时与**已安装的
权威骨架**逐字比对（`tools/patch-contract.test.mjs`）。

## 决定

本 preset 的 `cordis.patch.yml` **自己写完整 `plugins[]`，逐行声明官方插件名**，不引用、不继承、
不指望任何上层补齐（§2.1 的「✅ 唯一写法」）。

DSH 是 MIT（§12.3），逐字复制官方配置值合法，但必须署名。因此产物头部固定写一段归属注释，
`cordis.patch.yml` 第 8–9 行：

```
# Rows marked [official] below are configuration derived from DeepSeek Harness
# (MIT License, Copyright (c) 2026 DeepSeek); see LICENSE for the attribution.
```

同一事实也写进产物的另一处，避免下一个读产物的人不知道为什么要重复这么多行
（`cordis.patch.yml` 第 6–7 行）：

```
# This file's `plugins[]` rows are declared in full because DSH agent presets
# have no inheritance or composition mechanism (see DESIGN.md §2.1).
```

## 考虑过的选项

1. **只声明自己的增量行**——§2.1 明写不可行。没有任何合并语义，preset 里没写的官方行不会因为
   「官方 preset 装着它」就出现在本 preset 的 scope 里。
2. **引用官方 preset 作为 base（`extends: preset-standard`）**——§2.1 明写不可行：`PresetDefinition`
   没有这个字段。补一个继承语义是改 DSH，不是改本仓。
3. **把「没声明的官方行」交给 profile / home 层的 patch 补齐**——这是唯一还没被 §2.1 逐条否掉的
   写法，本仓**也**没用它。理由有据：§3.3.4 的 b1 注明确记载 profile / home patch **够不到**
   preset 的 `plugins[]`（装配产物里 `tool-bash` / `tool-pwsh` 两行**保留未求值的 `!!js`**，
   实测 `cordis.yml:670` / `:673`；依据 `dsh-app-boot/lib/index.js:2038-2043` 的
   `prepareProfileEntries` 只做兼容性预检）。让 preset 依赖某一层去补齐，等于把 preset 自身变成
   不自洽的东西。

## 后果

- **每次官方配置变化都要在这份 patch 里重新对齐。** 这正是引入生成器的直接原因
  （§7.3「D9 的重估」②：官方 row 的配置值一旦变化，手工同步每个 row 极易漂移 —— DESIGN 原文写的是
  「28 行」，当前实际 29 行，见上一节的计数口径表）。见
  [`2026-10-01-declaration-plus-generator-check-gate.md`](2026-10-01-declaration-plus-generator-check-gate.md)。
- **row 计数有两套口径，不能混。** 声明口径（§2.4 的算式：顶层 row + group + delegation 行）与
  「文件里渲染出来的 `- id:` 行数」不相等——多出来的部分是 `planning` 的 1 个子行与 `compaction`
  的 3 个子行，它们**确实渲染**，只是被 §2.4 的算式折进了 group 条目里。两套数字必须分开记，
  否则验收口径会打架。**今天实测三套数**（29 声明口径 / 33 条 `plugins[]` 条目 / 36 个 `- id:` 行），
  定义见
  [`2026-10-01-declaration-plus-generator-check-gate.md`](2026-10-01-declaration-plus-generator-check-gate.md)
  的「计数口径」表；生成器 stdout 每次都把三套数一起打印。
- **「12 个保留行逐字一致」这句话有一个例外，实现里已经存在：第 1 行 `persona`。** §2.3 表把
  `persona` 列进 12 个保留行，同时又写明它是**替换**（用本包的 `plan-aware-persona.mjs` 顶掉官方
  `@deepseek-ai/dsh-persona` 行），而官方那行的 `config` 有 `prefix`（`standard.patch.yml:15`）、
  本 preset 的那行没有（`cordis.patch.yml:19-22`）⇒ 二者按设计就**不**逐字。契约测试因此把
  `persona` 排除在「与骨架逐字比对」之外，其余 11 个原封不动的官方行逐字比对。**这是记录上的
  措辞与实现之间的偏差，不是实现的缺陷** —— 修措辞要改 `docs/DESIGN.md`（本轮不在授权内）。
- **许可署名边界需要机械化维护**（§7.3「D9 的重估」②），靠人记「哪几行是抄的」必然失准。
- **本决策与「删掉哪些行」是两个正交的决定**：既然不继承，`cordis:group` 只对组内内容有效这件事
  就只影响组内作用域，不影响「哪些行在不在」——后者见
  [`2026-10-01-unmount-rather-than-deny.md`](2026-10-01-unmount-rather-than-deny.md)。
- **什么时候重新审视**：DSH 给 `PresetDefinition` 加了 `extends` / `base`，或官方提供了 preset 级的
  合并语义。那时逐行重述的成本会从「必须」变成「历史包袱」，这份 patch 应当改为只声明增量。