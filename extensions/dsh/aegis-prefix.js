/**
 * Namespaces the aegis methodology pack's skills with an `aegis-` prefix.
 *
 * WHY THIS EXISTS IN THE PRESET RATHER THAN IN A SEPARATE PACKAGE
 * The preset's resident routing table names twenty skills by their prefixed
 * name — aegis-brainstorming, aegis-goal-framing, aegis-verification-before-
 * completion and so on. The upstream pack registers them under BARE names
 * (brainstorming, goal-framing, …), because it is host-agnostic. So without
 * this step the preset's whole routing table points at twenty names that do not
 * exist. The prefix is therefore not a convenience; it is this preset's contract
 * with the pack it depends on, and it ships with the preset.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not touch descriptions. Translating the catalogue into another
 * language is a reader preference, not a routing requirement, and forcing it on
 * everyone who installs this preset would be wrong. That belongs to whatever
 * local plugin a given user happens to run.
 *
 * LOAD ORDER
 * Nothing here assumes it runs before or after anything else. It reacts to
 * `skills/change` rather than reading the catalogue once at boot, so a pack that
 * registers later — or a description plugin running in either direction — does
 * not change the outcome. That is the point: the two concerns are decoupled by
 * reacting to events rather than by ordering the bundle array.
 *
 * `prefixAegisSkills: false` turns the whole step off. Do that only together
 * with rewriting the routing table, because the table names the prefixed form.
 */

import { z } from 'zod'

const AEGIS_PROVIDER = 'aegis-method-pack'
const PREFIX = 'aegis-'

/** Cordis plugin name. */
export const name = 'orch-aegis-prefix'

/** Only the skill registry: this plugin registers names, it serves none. */
export const inject = ['skills']

/** Rendered by the host as a settings switch. The default is the safe answer:
 *  off would leave the routing table pointing at names nothing provides. */
export const Config = z.object({
  prefixAegisSkills: z.boolean().default(true),
})

export function apply(ctx, rawConfig) {
  let enabled
  try {
    enabled = Config.parse(rawConfig ?? {}).prefixAegisSkills
  } catch {
    enabled = true // a malformed setting must not silently disable routing
  }
  if (!enabled) {
    ctx.logger.info('[orch-aegis-prefix] disabled by config; the preset routing table will not resolve')
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
      // Identify by PROVIDER, not by name: a bare-name skill is exactly what we
      // are here to namespace, and a name test would be ambiguous the moment
      // something else prefixes too.
      const targets = summaries.filter((s) => s.provider === AEGIS_PROVIDER && !done.has(s.name))
      for (const summary of targets) {
        const skill = await skills.get(summary.name)
        if (!skill) continue
        const prefixed = PREFIX + skill.name
        if (prefixed === skill.name) continue // already namespaced upstream
        disposers.push(
          skills.register({
            name: prefixed,
            ...(skill.description !== undefined ? { description: skill.description } : {}),
            ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
            invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true },
            source: 'orch-aegis-prefix',
            content: skill.content,
            ...(skill.resourceBase !== undefined ? { resourceBase: skill.resourceBase } : {}),
            ...(skill.path !== undefined ? { path: skill.path } : {}),
            ...(skill.metadata !== undefined ? { metadata: skill.metadata } : {}),
          }),
        )
        // Tombstone the bare name. Runtime beats bundled on collision, so this
        // wins over the provider's entry and the old spelling stops being
        // loadable — one skill, one name, no way to reach it by the other.
        disposers.push(
          skills.register({
            name: skill.name,
            description: `Renamed to ${prefixed}; load that name instead.`,
            invocation: { modelInvocable: false, userInvocable: false },
            source: 'orch-aegis-prefix',
            content: `This skill was renamed to ${prefixed}.`,
          }),
        )
        done.add(summary.name)
        ctx.logger.info(`[orch-aegis-prefix] "${summary.name}" -> "${prefixed}"`)
      }
    } catch (error) {
      ctx.logger.warn(`[orch-aegis-prefix] sync failed: ${String(error)}`)
    } finally {
      syncing = false
    }
  }

  void sync()
  ctx.on('skills/change', () => {
    void sync()
  })
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose()
  })
}
