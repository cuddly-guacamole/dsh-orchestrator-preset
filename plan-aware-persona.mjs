/**
 * Plan-aware persona for the `dsh-orchestrator-preset` agent preset.
 *
 * The preset's identity is not one persona but two: Orchestrator orchestrates
 * normal turns, while `/plan` must replace that identity with Planner for the
 * whole planning session. Stacking a second prefix section cannot do that — the
 * persona prose would still be Orchestrator with a planning addendum — so this plugin
 * takes over the single persona-prefix slot the deployment owns
 * and chooses its text per assembly.
 *
 * The choice reads the public plan projection through the injected
 * `sessionProjections` service. The plan-mode service is NOT injected: it
 * lives inside its own `isolate` realm, so injecting it from
 * outside that realm would never resolve and the mount would stall.
 *
 * @module plan-aware-persona
 */

import { readFileSync } from 'node:fs'

/** Cordis plugin name. */
export const name = 'plan-aware-persona'

/**
 * The persona files are read from disk, so this plugin needs no other service
 * than the prompt registry and the session projections that carry plan state.
 */
export const inject = ['systemPrompt', 'sessionProjections']

/** Directory holding this plugin's persona prose, resolved beside this module. */
const personasDir = new URL('./personas/', import.meta.url)

/**
 * Read one persona file from {@link personasDir}.
 *
 * A missing or empty persona fails loud: an empty prefix silently strips the
 * agent's identity, which is far worse than a mount error that names the file.
 *
 * @param file - file name inside the personas directory.
 * @returns the persona text exactly as stored.
 */
function readPersona(file) {
  const url = new URL(file, personasDir)
  let text
  try {
    text = readFileSync(url, 'utf8')
  } catch (cause) {
    throw new Error(`plan-aware-persona: cannot read persona "${url.href}"`, { cause })
  }
  if (text.trim().length === 0) {
    throw new Error(`plan-aware-persona: persona "${url.href}" is empty`)
  }
  return text
}

/**
 * Register the plan-aware persona prefix and the configured suffix.
 *
 * @param ctx - the preset's agent scope context.
 * @param config - optional `suffix` rendered as the persona-suffix section.
 * @returns the configured suffix, matching the persona row this replaces.
 */
export function apply(ctx, config) {
  const orchestrator = readPersona('orchestrator.md')
  const planner = readPersona('planner.md')

  /**
   * Choose the prefix for one assembly: Planner while the session's plan
   * projection reports plan mode active, Orchestrator otherwise — including when the
   * projection is absent, which must degrade to the standing identity rather
   * than fail the assembly.
   *
   * @param context - the assembly context; `agent` is absent on diagnostics.
   * @returns the persona prefix text.
   */
  const prefixFor = (context) => {
    const agent = context?.agent
    if (agent === undefined) return orchestrator
    let plan
    try {
      plan = ctx.sessionProjections.stateOf(agent.session, 'plan')
    } catch {
      // A projection that cannot be read is not an active plan: keep Orchestrator.
      return orchestrator
    }
    return plan?.active === true ? planner : orchestrator
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'deployment:persona-prefix',
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    text: prefixFor,
  }), 'plan-aware-persona: prefix section')

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'deployment:persona-suffix',
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX'),
    text: config?.suffix ?? '',
  }), 'plan-aware-persona: suffix section')

  return config?.suffix ?? ''
}
