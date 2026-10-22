/**
 * routing-sections.mjs — 常驻静态路由 section（DESIGN.md §5.2 落点 C）。
 *
 * 定位：域 owner 表 / 触发词裁决 / L0 判据索引 / MCP 纪律，四条**固定文本**段，
 * 每回合由 `systemPrompt` registry 重新装配，靠 `order` 控制优先级。
 *
 * 两档文本（`config.promptProfile`）：`'full'` 用上面那组原文，缺省与 `'minimal'` 用压缩组。
 * **两档的段名与 order 完全相同**，只有 text 不同 —— 切档不改装配形状，也不改判据的可见性。
 *
 * 为什么不是 persona 正文（DESIGN.md §5.2R14）：行为引导写进 persona 会稀释行为信号；
 * 常驻 section 是独立段、order 可控、文本固定（缓存友好）。
 *
 * ⛔ 段 4（MCP 纪律）是这条纪律的**唯一 owner**（DESIGN.md §5.8 / §14 D24）：禁止在
 *    `personas/orchestrator.md` / 本地技能 `orch-evidence-protocol` / `lanes.md` 里重复其正文；
 *    `orch-delegation-brief` 只能**引用**本段，不得复制。
 *
 * ⛔ 本模块**不含任何机械门**：没有工具名闭集断言、不调用 `tools.restrict`、
 *    不因任何名字越界而报错（该机制已按用户裁决删除，见 DESIGN.md §3.3.4 的 ⛔ 段）。
 *
 * ⛔ 文本必须是**静态常量**：不得拼接、不得时间戳 / 路径注入 / 动态时钟 / 环境变量读取
 *    （system 前缀动态化会让整个会话缓存全量 miss，DESIGN.md §5.5）。
 *
 * ⛔ 不得注册 persona 的 prefix / suffix 两个部署槽（它们归 `plan-aware-persona.mjs`，
 *    DESIGN.md §2.3「恰好一个」）。
 *
 * @module routing-sections
 */

/** Cordis plugin name. */
export const name = 'routing-sections'

/** Only the prompt registry is needed: this module only registers static text. */
export const inject = ['systemPrompt']

/** §4.2 编排域：三 owner 按**入口条件**互斥选一 + §4.3 其余域各一行 owner 指针。 */
const DOMAIN_OWNERS = `Domain routing — pick exactly one owner per task by entry condition.

Orchestration domain (the three entry conditions are mutually exclusive; pick by entry condition):
- written plan + cross-session or review checkpoints -> aegis-executing-plans
- written plan + same-session independent tasks -> this preset's own lane discipline: the persona's reuse invariant (I6) plus the routed orch-evidence-protocol skill
- no written plan + 2+ independent tasks (no conflicting shared state, no ordering) -> aegis-dispatching-parallel-agents

Cross-domain lane (not a fourth entry condition; the three above stay mutually exclusive):
- a decision that needs adversarial judgement rather than more material -> the seer lane
  (read-only; returns one recommendation, its trade-offs, and the condition that would
  flip it). This is not a competitor to the first-principles or grilling rows below:
  those are METHODS to apply, this is a JUDGEMENT to obtain. The test is the material —
  if what is missing is still facts, it is not a seer question.
- When the seer is raised: before you commit to a direction at cost - before a plan or a
  design fork is written down, before a destructive or contract-breaking step whose price
  the user cannot judge, or before a completion claim the evidence gate cannot check (it
  proves artifact against scope, never scope against goal). Not on a schedule and not at
  every state transition: it is a must at those instants, it fires at most once per
  commitment, and it is forbidden when you cannot write your own conclusion and one
  interrogable open point (that is confirmation, not judgement - verify instead). A
  second question is the same lane's next round, not a new child.
- Nothing enforces that must. The preset has no mechanism that can force a dispatch -
  only tool filters and depth limits exist, and they can suppress a call, never cause
  one. Treat this row as a self-check you perform, in the same species as the
  pre-dispatch self-proof, and not as a gate; an ungated must is stated honestly, or it
  is a lie the next reader will discover. Neighbour boundaries, one line each: the
  auditor judges a plan that exists and answers one word, the seer picks among routes
  that do not; the analyst resolves a fact gap into instructions, the seer resolves a
  choice gap into one recommendation; the discussion protocol is the method that gates
  this call, not a rival owner of it.

Other domains (one owner each):
- goal definition -> aegis-goal-framing (writes .dsh/goals/<slug>.md; TaskIntentDraft is the only format)
- skill authoring -> aegis-writing-skills
- grilling / pressure-testing -> aegis-brainstorming (Grilling Mode)
- pre-completion verification -> aegis-verification-before-completion (real-path testing is its sub-check)
- long-task continuation -> aegis-long-task-continuation
- memory / decision persistence -> aegis-recording-architecture-decisions (docs/aegis/ vs .dsh/state/ by path)
- review request -> aegis-requesting-code-review; review response -> aegis-receiving-code-review
- first principles -> aegis-first-principles-review
- writing plans -> aegis-writing-plans
- debugging -> aegis-systematic-debugging
- strict TDD -> aegis-test-driven-development
- worktree creation -> aegis-using-git-worktrees; branch finish -> aegis-finishing-a-development-branch
- project context / terminology -> aegis-establishing-project-context
- UI/UX design, interaction flows, and API changes that alter visible states or recovery -> aegis-ui-ux-governance (composed with the task owner; backend-only work with no user-visible effect stays on its existing route)
- anti-entropy / retirement -> aegis-anti-entropy-governance
- aegis self-update -> aegis-update-aegis
- DSH host routing check -> aegis-using-aegis (load it only when the user names it)
- delegation briefs (capability tasks) -> orch-delegation-brief (local skill)
- discussion protocol (pre-dispatch self-proof) -> orch-discussion-protocol (local skill)
- evidence protocol / path audit gate / lane ledger -> orch-evidence-protocol (local skill)`

/** §4.3 / §6.2 / §6.6：显式冲突的触发词 → 唯一 owner。 */
const TRIGGER_ARBITRATION = `Trigger arbitration — when two triggers look alike, each resolves to exactly one owner.

- "is this idea any good?" / "is this sentence any good?" -> aegis-brainstorming, Grilling Mode (both phrasings, one owner)
- before authoring a skill, ask: with no instructions at all, would the model already do this? If yes, do not ship a skill -> skill-authoring precondition
- truth of a claim / north-star dimension / tension confirmation -> aegis-goal-framing, extra TaskIntentDraft fields
- execution of a written plan inside one session -> this preset's own lane discipline; aegis-subagent-driven-development is not loaded here: its "fresh subagent per task" and "never inherit your session's context or history" contradict I6, and its commit step has no meaning in a workspace that is not a Git repository
- teammates / wait_agent -> present or absent per the WS2 staged measurement: a Team tool of the same name can shadow this preset's lane controls. **Two id namespaces, never mixed**: this preset's lanes are addressed by **durable agent id** through \`subagent_children\` / \`subagent_send({agent_id})\` / \`subagent_interrupt({agent_id})\`; teammates are addressed by **name** through Team's \`list_agents\` / \`send_message\` / \`interrupt_agent\`. ⛔ Never assume \`send_message\` takes \`agent_id\` — it cannot reach a \`subagent_*\` child at all.`

/** L0：只放索引指针，不复制 persona 正文（去重原则，V31）。 */
const L0_INDEX = `Invariants and the orch-delegation-brief template live in the persona. This section carries routing only: consult the persona for hard invariants, lane boundaries, and the evidence protocol pointer.`

/** §5.8 的四条纪律（本段是唯一 owner；委派函只引用、不复制）。 */
const MCP_DISCIPLINE = `MCP discipline (single owner: this section) — read-only lanes must not call real mcp__* tools.

- Read-only lanes: scout, archivist, seer, analyst, auditor, planner (the six deny-list lanes) plus reader (its allow-list excludes those tools by construction). Even when a real mcp__<server>__<tool> name appears in such a lane's visible tool set, the lane must not call it. Route MCP work through the orchestrator instead.
- This is discipline, not a hard gate. The lane toolFilter denies only the four loader names and only for non-holders; the holder surface is NOT narrowed at configuration level by this preset. Do not read this section as "the MCP surface is mechanically closed".
- Holder propagation, stated as measured: once the orchestrator has loaded a server, every lane child becomes a holder through ancestryIds, so denyFor returns only the configured hidden set and the real mcp__<server>__<tool> names stay visible to that lane. That surface cannot be enumerated statically: deny matching is exact and does not support wildcards.
- The only mechanical remedies sit outside this preset: profile-level loader hiddenTools, profile-level disabled: true, or a new plugin. All three were excluded by user decision (D24), so this discipline has no mechanical enforcement. Carry it to a lane through the delegation brief; the brief references this section and must not restate it.`

// ── minimal 档（`promptProfile: 'minimal'`，缺省）─────────────────────────────
// 与上面四个常量**同段名、同 order**，只是文本更短。四条段的**存在**不变（ADR
// `2026-10-01-converge-orchestration-domain-to-three-skills.md:63-66`：判据必须由常驻静态段
// 每回合可见），压缩只发生在文本层面。
//
// ⛔ 与 full 档同一约束：静态常量，不拼接、不读环境、不含时间戳或路径。
//
// 砍掉的只有两类东西：
//   ① `Other domains` 那 20 行清单 —— 技能目录的 description 已带同样的事实，这里是重复；
//   ② 写给维护者的元叙述（holder 传播实测 / 唯一机械补救在 preset 之外 / 未加门的 must）——
//      它们解释「为什么这样设计」，不是模型每回合要执行的指令。
// 保留的是**判据**：编排域三入口互斥的枚举、seer 那一行的触发条件与边界、双 id 空间、只读 lane 不调 mcp。

/** §4.2 编排域：三 owner 按入口条件互斥选一 + seer 交叉域 lane（minimal 档）。 */
const MIN_DOMAIN_OWNERS = `Domain routing — pick exactly one owner per task by entry condition.

Orchestration domain (the three entry conditions are mutually exclusive; pick by entry condition):
- written plan + cross-session or review checkpoints -> aegis-executing-plans
- written plan + same-session independent tasks -> this preset's own lane discipline: the persona's reuse invariant (I6) plus the routed orch-evidence-protocol skill
- no written plan + 2+ independent tasks (no conflicting shared state, no ordering) -> aegis-dispatching-parallel-agents

Cross-domain lane (not a fourth entry condition; the three above stay mutually exclusive):
- a decision that needs adversarial judgement rather than more material -> the seer lane
  (read-only; returns one recommendation, its trade-offs, and the condition that would
  flip it). Missing facts is not a seer question. Raise it before a plan or a design fork
  is written down, before a destructive or contract-breaking step, or before a completion
  claim the evidence gate cannot check; at most once per commitment, and never when you
  cannot state your own conclusion plus one open point you can interrogate.

Every other domain's owner is stated in its skill description — load the skill and read it there.`

/** §4.3 只留两条真正会撞车的裁决（minimal 档）。 */
const MIN_TRIGGER_ARBITRATION = `Trigger arbitration — when two triggers look alike, each resolves to exactly one owner.

- "is this idea any good?" / "is this sentence any good?" -> aegis-brainstorming, Grilling Mode (both phrasings, one owner)
- Two id namespaces, never mixed: \`subagent_*\` lanes are addressed by durable agent id (\`subagent_children\` / \`subagent_send({agent_id})\` / \`subagent_interrupt({agent_id})\`); Team's \`list_agents\` / \`send_message\` / \`interrupt_agent\` address a teammate by name. ⛔ \`send_message\` cannot reach a \`subagent_*\` child at all.`

/** §5.8 MCP 纪律压成可执行的两句（minimal 档）。 */
const MIN_MCP_DISCIPLINE = `MCP discipline (single owner: this section) — read-only lanes must not call real mcp__* tools.

- The six deny-list lanes (scout, archivist, seer, analyst, auditor, planner) and reader must not call a real mcp__<server>__<tool> even when one is visible to them. Route MCP work through the orchestrator instead.
- Nothing enforces this mechanically, so carry it to a lane through the delegation brief; the brief references this section and must not restate it.`

/** L0 判据索引：两档共用同一份文本（199 字符，没有可压的余量）。 */
const MIN_L0_INDEX = L0_INDEX
/** 四段按固定顺序装配；`order` 全部由 registry 的 PLAN_POLICY 派生（不硬编码魔数）。 */
const SECTIONS = [
  { name: 'routing:domain-owners', offset: 0, text: DOMAIN_OWNERS },
  { name: 'routing:trigger-arbitration', offset: 1, text: TRIGGER_ARBITRATION },
  { name: 'routing:l0-index', offset: 2, text: L0_INDEX },
  { name: 'routing:mcp-discipline', offset: 3, text: MCP_DISCIPLINE },
]

/** minimal 档：段名与 offset **与上面逐条相同**，只有 text 换成长度更短的那组。 */
const MINIMAL_SECTIONS = [
  { name: 'routing:domain-owners', offset: 0, text: MIN_DOMAIN_OWNERS },
  { name: 'routing:trigger-arbitration', offset: 1, text: MIN_TRIGGER_ARBITRATION },
  { name: 'routing:l0-index', offset: 2, text: MIN_L0_INDEX },
  { name: 'routing:mcp-discipline', offset: 3, text: MIN_MCP_DISCIPLINE },
]

/**
 * 按档选段组。**缺省 = minimal**（省 token 是默认意图，完整版要显式要）。
 *
 * @param profile - `'full'` | `'minimal'` | undefined.
 * @returns 该档的段数组；未知取值按 minimal 处理（与 `plan-aware-persona.mjs` 同一极性）。
 */
function sectionsFor(profile) {
  return profile === 'full' ? SECTIONS : MINIMAL_SECTIONS
}

/**
 * Register the routing sections.
 *
 * `PLAN_POLICY` = 500 in the registry's SECTION_ORDERS, so the derived base is 400:
 * after the persona prefix (0) and before the plan policy (500) — identity first,
 * then route, then plan rules.
 *
 * 段文本按 `config.promptProfile` 分档（见 {@link sectionsFor}）；**派生的 base order 与档无关**，
 * 两档的 `order` 完全相同 —— 切换档位不改装配顺序，只改每段文本。
 *
 * @param ctx - the preset's agent scope context.
 * @param config - optional `{ promptProfile }`; absent means minimal.
 * @returns the derived base order (useful for evidence).
 */
export function apply(ctx, config) {
  const base = ctx.systemPrompt.getSectionOrder('PLAN_POLICY') - 100
  for (const s of sectionsFor(config?.promptProfile)) {
    ctx.effect(
      () => ctx.systemPrompt.section({ name: s.name, order: base + s.offset, text: s.text }),
      'routing-sections: ' + s.name,
    )
  }
  return base
}

/**
 * 供证据/测试读取段清单（返回固定文本的浅拷贝，不暴露可变状态）。
 *
 * 与 {@link apply} 同一档位语义：`sectionList('full')` 给出 full 档的四段，
 * 其余（含不传）给出 minimal 档的四段。**段名与顺序两档一致** —— 证据可以逐段对账。
 *
 * @param profile - `'full'` | `'minimal'` | undefined.
 * @returns 该档的 `{ name, offset, text }` 浅拷贝数组。
 */
export function sectionList(profile) {
  return sectionsFor(profile).map((s) => ({ name: s.name, offset: s.offset, text: s.text }))
}
