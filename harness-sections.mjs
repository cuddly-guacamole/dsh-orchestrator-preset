/**
 * harness-sections.mjs — drop two harness-owned prompt sections on the minimal profile.
 *
 * The preset's `promptProfile` switch trims the text this package writes. What it
 * cannot reach is the text the HARNESS writes: a handful of standing sections that
 * `dsh-system-prompt` assembles from other packages on every turn. This plugin is
 * the seam for those — it hooks the assembly waterfall and removes two sections by
 * name, leaving every other section byte-identical.
 *
 *   `team:policy`      the Agent Teams standing policy
 *   `app:web-surface`  the Web GUI orientation paragraph
 *
 * Both are read-only observations: this plugin never rewrites a section's text, it
 * only decides which sections survive. Deleting a section does NOT delete its
 * sibling runtime CONTEXT — `app:web-surface` also registers a context carrying
 * "Current DeepSeek Harness Web GUI URL: ..." and that one is kept, so the URL the
 * model needs is still in the prompt after this plugin removes the paragraph.
 *
 * ## Why these two
 *
 * `team:policy` is the Team tool set's usage manual. This preset routes its own
 * orchestration through the `subagent_*` lanes, and the persona already carries the
 * one rule that must survive the removal: the two id spaces (Team names vs lane
 * names) are never interchangeable. See {@link DROPPED_SECTION_NAMES} for the
 * measurement behind the call, and the evidence file for what is lost.
 *
 * `app:web-surface` is GUI orientation prose. The GUI URL survives in the context
 * named the same thing, so removing the paragraph costs a paragraph of orientation,
 * not a fact.
 *
 * ## What is NOT dropped
 *
 * Only the two names above. In particular the harness's per-tool guidance sections
 * (`tool:bash`, `tool:pwsh`, `tool:fs-search`, `tool:jobs`, `tool:web`,
 * `tool:subagent`, ...) and `harness:source` / `harness:identity` all stay: they are
 * how the model learns to call the tools this preset hands it. An earlier draft of
 * this change measured a contiguous 4202-character region as "team:policy" — that
 * region actually contains `team:policy` (1851 chars) followed by those `tool:*`
 * sections (2351 chars). Dropping the region would have been a real regression, so
 * the match here is on exact section names and nothing else.
 *
 * @module harness-sections
 */

export const name = 'harness-sections'

/**
 * `systemPrompt` is what makes the `system-prompt/assemble` waterfall exist for this
 * scope. Declared even though the handler only listens, matching `routing-sections`.
 */
export const inject = ['systemPrompt']

/**
 * The section names this plugin removes under the minimal profile, matched EXACTLY
 * (no prefix, no wildcard) against `section.name`.
 *
 * `team:policy` — `dsh-experimental-tool-agent-team/lib/index.js:235` registers it;
 * the body is `teamPolicy(interrupt)` (`:21-27`), **1851 characters** as assembled in
 * the reference session (measured at `system/message`, offsets 7459..9310).
 *
 * `app:web-surface` — `dsh-harness-dev-context/lib/index.js:27` defines the constant
 * and `:111` registers the section; the body is `WEB_SURFACE_PROMPT` (`:28`),
 * **1005 characters** in source / **1002** as assembled (the join trims a trailing
 * newline). ⚠️ The name is `app:web-surface`, NOT `web-surface` — verified against
 * the installed `0.2.1-rc.2` and `0.2.1-rc.3` trees, in both `~/.dsh/node_modules` and
 * the npm-global install. Matching the bare `web-surface` would have silently filtered nothing.
 *
 * The bare `web-surface` spelling is kept as a second exact match purely so a host
 * that renames the constant back still gets trimmed; it is not a wildcard and it
 * cannot collide with any other registered name.
 */
export const DROPPED_SECTION_NAMES = Object.freeze(['team:policy', 'app:web-surface', 'web-surface'])

/** `true` when this profile should leave the assembly untouched. */
function keepsEverything(profile) {
  return profile === 'full'
}

/**
 * Hook `system-prompt/assemble` and, on the minimal profile, drop the sections named
 * in {@link DROPPED_SECTION_NAMES}.
 *
 * `{ prepend: true }` puts this handler first in the waterfall, so it sees the
 * assembly the harness built rather than another plugin's rewrite of it. The handler
 * still awaits `next()` first: the waterfall is the harness's chain, and returning a
 * value without letting it run would hide every other plugin's contribution.
 *
 * ## The three failure modes this guards
 *
 * 1. **Empty result.** If filtering leaves nothing, the model would get no system
 *    prompt at all. Warn once and return the original assembly instead — a too-long
 *    prompt beats an empty one. (Same shape as the liangshen reference.)
 * 2. **A `complete` section.** `dsh-system-prompt/lib/index.js:382` throws when more
 *    than one section is `complete: true`, and `:403` replaces the waterfall's result
 *    with `sections: [completeSection]` when exactly one is. Both happen OUTSIDE this
 *    handler, so a complete section wins over anything returned here either way. We
 *    still return the assembly untouched when one is visible, because filtering is
 *    pointless then and an empty-filter warning would be noise.
 *    ⚠️ In `0.2.1-rc.2` the flag is **not** propagated into `assembly.sections` —
 *    `:386-393` copies only `name` / `text` / `interpolate` into each assembled
 *    entry. Re-checked on `0.2.1-rc.3`: same shape at `:384-390`. So `section.complete` is normally `undefined` here and the check below is
 *    forward-compatibility, not a live path; the harness's own `:403` restore is what
 *    actually protects the prompt today. Do not read the check as evidence that a
 *    complete section is observable at this seam.
 * 3. **A non-array `sections`.** Another plugin may hand back a shape this plugin does
 *    not understand. Leave it alone rather than throw inside the waterfall.
 *
 * @param ctx - cordis context; `ctx.logger.warn` is used for the empty-filter warning.
 * @param config - optional `{ promptProfile }`; absent means minimal (filtering on).
 */
export function apply(ctx, config) {
  const profile = config?.promptProfile
  if (keepsEverything(profile)) return

  const drop = new Set(DROPPED_SECTION_NAMES)
  let warnedEmpty = false

  const warnOnce = (message) => {
    if (warnedEmpty) return
    warnedEmpty = true
    try {
      ctx.logger?.warn?.(message)
    } catch {
      // A logger that throws must not take the prompt down with it.
    }
  }

  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const assembled = await next()
    if (!Array.isArray(assembled?.sections)) return assembled
    // A visible complete section owns the whole prompt; the harness restores it after
    // this waterfall regardless, so there is nothing here to improve.
    if (assembled.sections.some((section) => section?.complete === true)) return assembled

    const kept = assembled.sections.filter((section) => !drop.has(section?.name))
    if (kept.length === assembled.sections.length) return assembled
    if (kept.length === 0) {
      warnOnce(
        `${name}: dropping ${JSON.stringify([...drop])} would leave no prompt section — `
        + 'keeping the assembled prompt instead of sending an empty one',
      )
      return assembled
    }
    return { ...assembled, sections: kept }
  }, { prepend: true })
}
