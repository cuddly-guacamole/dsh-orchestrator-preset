/**
 * Namespaces the aegis methodology pack's skills with an `aegis-` prefix, and
 * optionally localises their descriptions.
 *
 * WHY THE PREFIX LIVES HERE
 * The preset's resident routing table names twenty-one skills by their prefixed
 * name, while the upstream pack registers them bare — it is host-agnostic and has
 * no reason to know this preset exists. Nothing bridged that, so every aegis row
 * in the routing table pointed at a name resolving to nothing, and the failure was
 * silent: a routing entry that matches no skill simply never fires.
 *
 * WHY THE DESCRIPTION SWAP IS A SECOND, OFF-BY-DEFAULT FLAG
 * Translating the catalogue is a reader preference, not a routing requirement, and
 * forcing it on everyone who installs this preset would be wrong. It is OFF by
 * default and turned on per deployment, in a layer the reader owns.
 *
 * WHY BOTH LIVE IN ONE PLUGIN
 * They were briefly two plugins: this bridge for the prefix, a separate local one
 * for descriptions. That produced a race — this bridge copies a description while
 * registering, so whichever plugin ran first decided whether Chinese or English
 * got copied, and the observed result was neither: twenty-one routing targets
 * resolved, but only four descriptions were localised. Two plugins mutating the
 * same registrations need a load-order contract to be correct, and such a contract
 * is only correct until somebody reorders the bundle array. Doing both in one pass
 * at registration removes the question instead of answering it.
 *
 * `skills/change` is still observed rather than reading the catalogue once, so a
 * pack that registers late still gets namespaced.
 */

import z from '@deepseek-ai/schemastery'

const AEGIS_PROVIDER = 'aegis-method-pack'
const PREFIX = 'aegis-'

/** The id `cordis.patch.yml` gives this plugin's row. The settings plane calls
 *  the row id the namespace, so this one string names the row, the settings
 *  namespace, and the key the Plugins page dispatches for it. */
const ROW_ID = 'orch-aegis-prefix'

/** Read route the browser half falls back to when no host form is handed over.
 *  The web carrier mounts the Fetch registry under `/api`, hence the prefix. */
const VALUES_ROUTE = '/api/orch-aegis-prefix/values'

/** The stored values of a volatile boolean field, or `undefined` when the row
 *  does not name it. Read per request from the loader entry, never cached: the
 *  entry object is replaced by a reload, and a stale copy would report a value
 *  the running plugin is not using. */
function storedSwitches(entry) {
  const config = entry?.options?.config
  const raw = config !== null && typeof config === 'object' ? config : {}
  const out = {}
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key]
  }
  return out
}

/** Whether a request may read this route: a privileged configuration surface is
 *  loopback-same-origin only, mirroring the official settings fence. */
function isLoopbackSameOrigin(request) {
  let url
  try {
    url = new URL(request.url)
  } catch {
    return false
  }
  const host = request.headers.get('host') ?? url.host
  if (host === '') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (origin === null) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** One JSON answer with a status. */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/**
 * Register the read route the browser half uses when the Plugins page hands it
 * no host form.
 *
 * Registration rides the carrier-neutral Fetch registry rather than the web
 * server: a native registration would shadow the carrier's `/api` prefix route
 * and bypass its request fence. The binding waits for `connection.fetch`
 * instead of probing once, because composition rows mount in dependency order
 * and the registry may not exist when `apply` runs.
 *
 * This route owns NO write path. The card writes through the host form the page
 * hands it; GET is the degradation source for an entry the Host does not serve
 * to the client, and the carrier of the effective values for a plain fetch.
 */
function installValuesRoute(ctx) {
  const bind = (carrier) => {
    const registry = carrier?.fetch
    if (registry === undefined || typeof registry.register !== 'function') return
    ctx.effect(
      () =>
        registry.register({
          path: VALUES_ROUTE,
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: (request) => {
            if (!isLoopbackSameOrigin(request)) return json(403, { ok: false, error: 'forbidden' })
            if (request.method !== 'GET') return json(405, { ok: false, error: 'method-not-allowed' })
            const declared = storedSwitches(ctx.fiber?.entry)
            const value = { ...DEFAULTS, ...declared }
            return json(200, {
              ok: true,
              value: {
                value,
                declared,
                // Whether the settings document accepts writes at all. The row's
                // own form is the writer; this only says the plane is live.
                writable: ctx.get('settings')?.writable === true,
              },
            })
          },
        }),
      'orch-aegis-prefix: values route',
    )
  }
  const direct = ctx.get('connection')
  if (direct !== undefined) {
    bind(direct)
    return
  }
  if (typeof ctx.inject !== 'function') return
  ctx.inject(['connection'], (connectionCtx) => bind(connectionCtx.get('connection')))
}

/** Cordis plugin name. */
export const name = 'orch-aegis-prefix'

/** The skill registry, and the carrier the read route rides.
 *  Still no `settings` injection: this plugin serves a read route, it does not
 *  own a settings surface. See the note above `installValuesRoute`. */
export const inject = ['skills', 'connection']

/** Behaviour defaults, shared by the schema below and by the read in `apply`.
 *  Declared once so the schema's default and the code's default cannot drift. */
const DEFAULTS = Object.freeze({
  prefixAegisSkills: true,
  describeAegisSkillsInZh: false,
})

/**
 * The two switches.
 *
 * There is no UI, and this is now a measured architectural boundary rather than
 * pending work. Two mechanisms were checked; the first does not reach a
 * patch-inserted row at all, and the second reaches the row but cannot reach the
 * browser.
 *
 * why the settings card never appears
 * `dsh-settings.describe()` builds its forms from `entry.fiber.runtime.Config`
 * via `volatileForm()` — which this schema satisfies, both fields being
 * `.volatile()` — but it only ever visits entries returned by
 * `dsh-config-editor.entries()`, and that filters to rows whose
 * `parent.tree.ctx.fiber.entry?.id === "include"`
 * (`@deepseek-ai/dsh-config-editor/lib/index.js:31`). A row inserted by a bundle
 * patch is not one of those, so nothing here appears on the settings page.
 *
 * why the Plugins page reaches the row but not the browser
 * That page keys a row's configuration `<package name>#<row id>`, projects the
 * key from the `plugins.row.config` slot ledger, and hands the entry the Host
 * form of the row's settings namespace — the row id — so the row itself is
 * reachable, and it does not consult the `include` filter. What cannot be
 * reached is the browser half: the switches need a client bundle, and the
 * client-bundle scanner (`@deepseek-ai/dsh-client-modules`) enumerates the ROOT
 * loader tree, while a preset's rows are mounted into a detached `PresetTree` of
 * their own (`@deepseek-ai/dsh-agent-preset-registry`, `mountPreset()` ->
 * `new PresetTree(ctx)` + `tree.root.update(...)`). `PresetTree` extends
 * `EntryTree` but deletes the owner's `subtree` pointer in its constructor, so
 * its rows are enumerated by nothing the scanner walks. A `dsh.client`
 * declaration in this package's manifest is therefore never read and the bundle
 * is never served — measured on this host, not assumed. There is no supported
 * way around it either: `ClientModuleRegistry` exports `compose` /
 * `bundleResource` / `onGraphChanged` and keeps its response map private, so no
 * registration door exists. A UI would have to live in a profile bundle, i.e. a
 * separate package, not in this preset.
 *
 * The settings form itself is not in doubt: `POST /api/settings/describe`
 * answers a namespace `orch-aegis-prefix` whose schema carries both keys and
 * whose value carries both stored booleans, so the read route below is a real
 * degradation source and not a placeholder.
 *
 * Editing without a UI works, and is supported: the home layer
 * `$DSH_HOME/cordis.patch.yml` applies after this bundle's, so a row there wins.
 * Restate both keys, because a patch replaces a row's config rather than
 * deep-merging it.
 */
export const Config = z.object({
  prefixAegisSkills: z.boolean().default(DEFAULTS.prefixAegisSkills).volatile(),
  describeAegisSkillsInZh: z.boolean().default(DEFAULTS.describeAegisSkillsInZh).volatile(),
})

/**
 * English original -> compressed Chinese. The English string is the match key,
 * taken verbatim from each SKILL.md, so an upstream rewrite falls through to
 * English rather than mismatching into something garbled. `tools/verify-install.sh`
 * checks every key against the installed pack, so a stale table announces itself.
 */
const ZH_DESCRIPTIONS = [
  ['Use when touching retiring old logic, collapsing duplicate owners, removing fallbacks, or schema/persistence/source-of-truth boundaries; identify opportunities automatically; destructive execution requires explicit confirmation.', '退役旧逻辑/合并重复owner/移除回退/动数据源边界时用；自动识别机会，破坏性执行需确认。'],
  ['Use when defining ambiguous or high-complexity new features, product behavior, UI/component design, architecture choices, contract changes, or when grilling/pressure-testing a plan or design. Routine small requests stay on the fast path.', '模糊/高复杂度新功能、UI/组件、架构选择、合同变更，或盘问/压力测试方案时用；常规小请求走快路径。'],
  ['Use when the user asks for caveman mode, fewer tokens, brief responses, compressed communication, or otherwise explicitly requests a much shorter answer.', '用户要求 caveman 模式/少 token/简短回答/压缩沟通时用。'],
  ['Use when facing 2+ independent tasks without a written plan, with no conflicting shared mutable state or sequential dependencies, where parallel delegation beats inline cost; otherwise inline. Planned tasks use subagent-driven-development.', '2+ 独立无依赖任务、无书面计划、无冲突共享可变状态/顺序依赖、并行派发优于内联时用；有计划的任务用 subagent-driven-development。'],
  ['Use when the user asks to establish shared project language, or project work exposes a conflicting, renamed, or deprecated domain term that needs active semantic modeling. Routine small tasks stay on the fast path.', '建立共享项目语言，或领域术语冲突/重命名/过时需要语义建模时用；常规小任务走快路径。'],
  ['Use when executing a written implementation plan across sessions or with review checkpoints. Small or single-slice plans stay inline. For same-session independent tasks, use subagent-driven-development instead.', '跨会话或带审查检查点执行书面实现计划时用；小/单切片计划内联；同会话独立任务用 subagent-driven-development。'],
  ['Use when verified work needs integration or cleanup of an existing task-created branch/worktree, or the user explicitly requests merge, PR, or branch lifecycle handling.', '已验证工作需集成/清理任务创建的分支/worktree，或用户明确要求 merge/PR/分支生命周期处理时用。'],
  ["Use when asked for first-principles or Occam's-razor review, or when high-risk decisions involve competing constraints, fallback growth, duplicate owners, or architecture direction risk. Ordinary bug fixes stay on the fast path.", '被要求第一性原理/Occam 剃刀审查，或高风险决策（竞争约束/回退增长/重复owner/架构方向风险）时用；普通 bug 修复走快路径。'],
  ['Use when the user explicitly sets an Aegis goal with /aegis-goal, Aegis goal:, or asks to define goal, success evidence, stop condition, or task boundaries before work.', '用户用 /aegis-goal、Aegis goal:，或要求定义目标、成功证据、停止条件、任务边界时用。'],
  ['Use when a task is multi-step, may span context resets or sessions, uses subagents, or risks losing state before completion.', '任务多步骤、跨上下文重置/会话、用子代理、或有完成前丢失状态风险时用。'],
  ['Use when receiving code review feedback before implementing suggestions, especially when feedback is unclear, risky, disputed, or technically questionable.', '收到代码评审反馈、实施建议前用，尤其反馈不清晰、有风险、有争议或技术上可疑时。'],
  ['Use when the user asks to create, write, update, amend, supersede, or evaluate an ADR, architecture decision record, durable architecture decision, decision log, or baseline sync after architecture-changing work.', '用户要求创建/编写/更新/修订/废止/评估 ADR、架构决策记录、持久化架构决策、决策日志或基线同步时用。'],
  ['Use when requesting independent code review, after implementation slices, before merging high-risk work, or when verification exposes evidence, baseline, architecture, compatibility, or retirement uncertainty.', '请求独立代码评审：实现切片后、合并高风险工作前、或验证暴露证据/基线/架构/兼容性/退役不确定性时用。'],
  ['Use when executing a written implementation plan with independent tasks in the current session where delegation beats inline coordination cost; otherwise inline. Ad-hoc 2+ tasks without a plan use dispatching-parallel-agents.', '执行书面实现计划、当前会话独立任务委托优于内联时用；临时 2+ 无计划任务用 dispatching-parallel-agents。'],
  ['Use when encountering a bug, test failure, or unexpected behavior, before proposing fixes', '遇到 bug、测试失败或意外行为、提出修复前用。'],
  ['Use when the user explicitly requests strict or test-first TDD, or when the current conversation already contains an explicit `TDD Route: strict` decision from another Aegis workflow.', '用户显式要求严格/测试优先 TDD，或会话已有 TDD Route: strict 决策时用。'],
  ['Use when the user says `aegis:update`, asks to update or upgrade an installed Aegis method-pack, wants the latest Aegis version, or asks whether Aegis is current on this host.', '用户说 aegis:update、要求更新/升级已装方法包、要最新版本或询问是否最新时用。'],
  ['Use when starting a turn or checking Aegis skill routing.', '回合开始或检查 Aegis 技能路由时用。'],
  ['Use when a coding task needs a concurrent checkout, unrelated dirty state blocks safe branch switching, or the user or repository explicitly requires a worktree.', '编码任务需并发 checkout、无关脏状态阻止安全切分支、或用户/仓库明确要求 worktree 时用。'],
  ['Use when about to claim work is complete, fixed, passing, verified, release-ready, or ready to commit, merge, publish, or hand off.', '声称完成/修复/通过/可发布，或准备提交/合并/发布/移交时用。'],
  ['Use when you have an approved spec or written requirements for a multi-step task that needs a durable plan document before touching code. Small, single-owner, or fast-path tasks do not need this skill.', '有已批准规格/书面需求的多步骤任务、动代码前需持久计划文档时用；小/单owner/快路径任务不需要。'],
  ['Use when creating new skills, editing existing skills, or verifying skills work before deployment', '创建新技能、编辑现有技能、或部署前验证技能可用时用。'],
]

const ZH_BY_EN = new Map(ZH_DESCRIPTIONS)

export function apply(ctx, rawConfig) {
  // Read the two switches off the raw patch value, applying DEFAULTS for whatever
  // the row does not set. Schemastery schemas are not zod's: there is no `.parse`
  // here, and calling the schema does not fill defaults either — so the defaults
  // have to come from the shared constant, which is also what the card shows.
  const raw = rawConfig !== null && typeof rawConfig === 'object' ? rawConfig : {}
  const pick = (key) => (typeof raw[key] === 'boolean' ? raw[key] : DEFAULTS[key])
  const wantPrefix = pick('prefixAegisSkills')
  const wantZh = pick('describeAegisSkillsInZh')

  if (!wantPrefix) {
    ctx.logger.info("[orch-aegis-prefix] prefix disabled by config; the preset's routing table will not resolve")
    return
  }

  const skills = ctx.skills
  const done = new Set()
  const disposers = []
  let syncing = false

  async function sync() {
    if (syncing) return
    syncing = true
    try {
      const summaries = await skills.list()
      const targets = summaries.filter((s) => s.provider === AEGIS_PROVIDER && !done.has(s.name))
      for (const summary of targets) {
        const skill = await skills.get(summary.name)
        if (!skill) continue
        const bare = skill.name
        const prefixed = bare.startsWith(PREFIX) ? bare : PREFIX + bare
        // The swap happens HERE, in the same pass as the rename, so no window
        // exists in which another plugin could copy the un-swapped text.
        const description = wantZh
          ? (ZH_BY_EN.get(skill.description ?? '') ?? skill.description)
          : skill.description
        disposers.push(
          skills.register({
            name: prefixed,
            ...(description !== undefined ? { description } : {}),
            ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
            invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true },
            source: 'orch-aegis-prefix',
            content: skill.content,
            ...(skill.resourceBase !== undefined ? { resourceBase: skill.resourceBase } : {}),
            ...(skill.path !== undefined ? { path: skill.path } : {}),
            ...(skill.metadata !== undefined ? { metadata: skill.metadata } : {}),
          }),
        )
        if (prefixed !== bare) {
          // Tombstone the bare name. Runtime beats bundled on collision, so this
          // wins over the provider's entry and the old spelling stops being
          // loadable — one skill, one name, no way to reach it by the other.
          disposers.push(
            skills.register({
              name: bare,
              description: `Renamed to ${prefixed}; load that name instead.`,
              invocation: { modelInvocable: false, userInvocable: false },
              source: 'orch-aegis-prefix',
              content: `This skill was renamed to ${prefixed}.`,
            }),
          )
        }
        done.add(summary.name)
        ctx.logger.info(`[orch-aegis-prefix] "${bare}" -> "${prefixed}"${wantZh ? ' (zh)' : ''}`)
      }
    } catch (error) {
      ctx.logger.warn(`[orch-aegis-prefix] sync failed: ${String(error)}`)
    } finally {
      syncing = false
    }
  }

  ctx.logger.info(`[orch-aegis-prefix] applied; zh=${wantZh}, ${ZH_DESCRIPTIONS.length} mappings available`)
  installValuesRoute(ctx)
  void sync()
  ctx.on('skills/change', () => {
    void sync()
  })
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose()
  })
}
