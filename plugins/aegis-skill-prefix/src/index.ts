/**
 * aegis-skill-prefix
 *
 * 当 dsh 加载 aegis 方法包后：
 * 1. 为 aegis 包提供的技能名统一添加 "aegis-" 前缀（runtime skill 遮蔽 bundled 原名）。
 * 2. 把技能描述正则替换为压缩中文（用户端/agent 目录同源），保留英文触发词
 *    （caveman、aegis:update、/aegis-goal、TDD Route: strict 等）。
 *
 * 原理：
 * - aegis 通过 dsh-skill-filesystem 注册技能 provider "aegis-method-pack"
 *   （bundled source，rank 600），技能名取自各 SKILL.md frontmatter 的 name 字段。
 * - 本插件把每个 aegis 技能以 "aegis-<原名>" 注册为 runtime skill（rank 250，
 *   优先级高于 bundled），内容与原技能一致；同时以原技能名注册一个
 *   modelInvocable=false / userInvocable=false 的占位 runtime skill —— 同名时
 *   runtime 优先，占位技能因不可调用而不会出现在技能目录、也不可被 skill 工具加载。
 * - 描述中文化用精确正则匹配英文原文；若上游 aegis 更新了描述导致匹配不上，
 *   description 保留英文原样 —— 用户端（skill.list 菜单）可见英文，
 *   即"该补录映射"的信号。
 *   维护：ZH_DESCRIPTIONS 以 SKILL.md 的 description 原文为键（不是技能名），
 *   故 aegis 每次升级后需用 profiles/desktop/node_modules/aegis/skills/<name>/SKILL.md
 *   的 frontmatter 对照本表 —— 键失配的条目会静默回退英文。
 *   例：aegis v2.10.6 把 dispatching-parallel-agents 的 "no shared state"
 *   收紧为 "no conflicting shared mutable state"，本表已同步。
 * - aegis 未加载时 no-op；插件卸载时自动移除全部注册，可随时停用。
 */

import type { Context } from "@deepseek-ai/cordis"

const AEGIS_PROVIDER = "aegis-method-pack"
const PREFIX = "aegis-"

/** 技能描述中文化映射：en=英文原文（精确匹配基准），zh=压缩中文（保留英文触发词）。 */
const ZH_DESCRIPTIONS: Array<{ en: string; zh: string }> = [
  {
    en: "Use when touching retiring old logic, collapsing duplicate owners, removing fallbacks, or schema/persistence/source-of-truth boundaries; identify opportunities automatically; destructive execution requires explicit confirmation.",
    zh: "退役旧逻辑/合并重复owner/移除回退/动数据源边界时用；自动识别机会，破坏性执行需确认。"
  },
  {
    en: "Use when defining ambiguous or high-complexity new features, product behavior, UI/component design, architecture choices, contract changes, or when grilling/pressure-testing a plan or design. Routine small requests stay on the fast path.",
    zh: "模糊/高复杂度新功能、UI/组件、架构选择、合同变更，或盘问/压力测试方案时用；常规小请求走快路径。"
  },
  {
    en: "Use when the user asks for caveman mode, fewer tokens, brief responses, compressed communication, or otherwise explicitly requests a much shorter answer.",
    zh: "用户要求 caveman 模式/少 token/简短回答/压缩沟通时用。"
  },
  {
    en: "Use when facing 2+ independent tasks without a written plan, with no conflicting shared mutable state or sequential dependencies, where parallel delegation beats inline cost; otherwise inline. Planned tasks use subagent-driven-development.",
    zh: "2+ 独立无依赖任务、无书面计划、无冲突共享可变状态/顺序依赖、并行派发优于内联时用；有计划的任务用 subagent-driven-development。"
  },
  {
    en: "Use when the user asks to establish shared project language, or project work exposes a conflicting, renamed, or deprecated domain term that needs active semantic modeling. Routine small tasks stay on the fast path.",
    zh: "建立共享项目语言，或领域术语冲突/重命名/过时需要语义建模时用；常规小任务走快路径。"
  },
  {
    en: "Use when executing a written implementation plan across sessions or with review checkpoints. Small or single-slice plans stay inline. For same-session independent tasks, use subagent-driven-development instead.",
    zh: "跨会话或带审查检查点执行书面实现计划时用；小/单切片计划内联；同会话独立任务用 subagent-driven-development。"
  },
  {
    en: "Use when verified work needs integration or cleanup of an existing task-created branch/worktree, or the user explicitly requests merge, PR, or branch lifecycle handling.",
    zh: "已验证工作需集成/清理任务分支或 worktree，或用户明确要求 merge/PR/分支生命周期处理时用。"
  },
  {
    en: "Use when asked for first-principles or Occam's-razor review, or when high-risk decisions involve competing constraints, fallback growth, duplicate owners, or architecture direction risk. Ordinary bug fixes stay on the fast path.",
    zh: "被要求第一性原理/Occam 剃刀审查，或高风险决策（竞争约束/回退增长/重复owner/架构方向风险）时用；普通 bug 修复走快路径。"
  },
  {
    en: "Use when the user explicitly sets an Aegis goal with /aegis-goal, Aegis goal:, or asks to define goal, success evidence, stop condition, or task boundaries before work.",
    zh: "用户用 /aegis-goal、Aegis goal: 显式设目标，或要求定义成功证据/停止条件/任务边界时用。"
  },
  {
    en: "Use when a task is multi-step, may span context resets or sessions, uses subagents, or risks losing state before completion.",
    zh: "任务多步骤、跨上下文重置/会话、用子代理、或有完成前丢失状态风险时用。"
  },
  {
    en: "Use when receiving code review feedback before implementing suggestions, especially when feedback is unclear, risky, disputed, or technically questionable.",
    zh: "收到代码评审反馈、实施建议前用，尤其反馈不清晰/有风险/有争议/技术上可疑时。"
  },
  {
    en: "Use when the user asks to create, write, update, amend, supersede, or evaluate an ADR, architecture decision record, durable architecture decision, decision log, or baseline sync after architecture-changing work.",
    zh: "用户要求创建/编写/更新/修订/废止/评估 ADR 或架构决策记录、决策日志、基线同步时用。"
  },
  {
    en: "Use when requesting independent code review, after implementation slices, before merging high-risk work, or when verification exposes evidence, baseline, architecture, compatibility, or retirement uncertainty.",
    zh: "请求独立代码评审：实现切片后、合并高风险工作前、或验证暴露证据/基线/兼容性/退役不确定性时用。"
  },
  {
    en: "Use when executing a written implementation plan with independent tasks in the current session where delegation beats inline coordination cost; otherwise inline. Ad-hoc 2+ tasks without a plan use dispatching-parallel-agents.",
    zh: "执行书面实现计划、当前会话独立任务委托优于内联时用；临时 2+ 无计划任务用 dispatching-parallel-agents。"
  },
  {
    en: "Use when encountering a bug, test failure, or unexpected behavior, before proposing fixes",
    zh: "遇到 bug、测试失败或意外行为、提出修复前用。"
  },
  {
    en: "Use when the user explicitly requests strict or test-first TDD, or when the current conversation already contains an explicit `TDD Route: strict` decision from another Aegis workflow.",
    zh: "用户显式要求严格/测试优先 TDD，或会话已有 TDD Route: strict 决策时用。"
  },
  {
    en: "Use when the user says `aegis:update`, asks to update or upgrade an installed Aegis method-pack, wants the latest Aegis version, or asks whether Aegis is current on this host.",
    zh: "用户说 aegis:update、要求更新/升级已装方法包、要最新版本或询问是否最新时用。"
  },
  {
    en: "Use when starting a turn or checking Aegis skill routing.",
    zh: "回合开始或检查 Aegis 技能路由时用。"
  },
  {
    en: "Use when a coding task needs a concurrent checkout, unrelated dirty state blocks safe branch switching, or the user or repository explicitly requires a worktree.",
    zh: "编码任务需并发 checkout、无关脏状态阻止安全切分支、或用户/仓库明确要求 worktree 时用。"
  },
  {
    en: "Use when about to claim work is complete, fixed, passing, verified, release-ready, or ready to commit, merge, publish, or hand off.",
    zh: "声称完成/修复/通过/可发布，或准备提交/合并/发布/移交时用。"
  },
  {
    en: "Use when you have an approved spec or written requirements for a multi-step task that needs a durable plan document before touching code. Small, single-owner, or fast-path tasks do not need this skill.",
    zh: "有已批准规格/书面需求的多步骤任务、动代码前需持久计划文档时用；小/单owner/快路径任务不需要。"
  },
  {
    en: "Use when creating new skills, editing existing skills, or verifying skills work before deployment",
    zh: "创建新技能、编辑现有技能、或部署前验证技能可用时用。"
  }
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** 精确正则匹配英文原文 → 压缩中文；未匹配（上游描述已变更）保留英文原样。 */
function zhDescription(description: string): string {
  for (const entry of ZH_DESCRIPTIONS) {
    if (new RegExp("^" + escapeRegExp(entry.en) + "$").test(description)) return entry.zh
  }
  return description
}

export const name = "aegis-skill-prefix"
export const inject = ["skills"]

export function apply(ctx: Context) {
  const skills = (ctx as any).skills as {
    list: (options?: any) => Promise<any[]>
    get: (name: string, options?: any) => Promise<any>
    register: (skill: any) => () => void
  }

  const done = new Set<string>()
  const disposers: Array<() => void> = []
  let syncing = false

  async function sync() {
    if (syncing) return
    syncing = true
    try {
      const summaries = await skills.list()
      const aegisSkills = summaries.filter((s) => s.provider === AEGIS_PROVIDER)
      if (aegisSkills.length === 0) return // aegis 未加载，no-op
      for (const summary of aegisSkills) {
        if (done.has(summary.name)) continue
        const skill = await skills.get(summary.name)
        if (!skill) continue
        const prefixedName = PREFIX + skill.name
        disposers.push(skills.register({
          name: prefixedName,
          description: zhDescription(skill.description),
          ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
          invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true },
          source: "aegis-skill-prefix",
          content: skill.content,
          ...(skill.resourceBase !== undefined ? { resourceBase: skill.resourceBase } : {}),
          ...(skill.path !== undefined ? { path: skill.path } : {}),
          ...(skill.metadata !== undefined ? { metadata: skill.metadata } : {})
        }))
        disposers.push(skills.register({
          name: skill.name,
          description: `Renamed to ${prefixedName}; load that name instead.`,
          invocation: { modelInvocable: false, userInvocable: false },
          source: "aegis-skill-prefix",
          content: `This skill was renamed to ${prefixedName}.`
        }))
        done.add(summary.name)
        ctx.logger.info(`[aegis-skill-prefix] "${summary.name}" -> "${prefixedName}"`)
      }
    } catch (error) {
      ctx.logger.warn(`[aegis-skill-prefix] sync failed: ${String(error)}`)
    } finally {
      syncing = false
    }
  }

  void sync()
  ctx.on("skills/change", () => { void sync() })
  ctx.effect(() => () => { for (const dispose of disposers) dispose() })
}
