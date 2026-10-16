/**
 * Lane tool gate for the `dsh-orchestrator-preset` agent presets.
 *
 * Every lane is a delegated child with a deliberately narrowed tool surface: the
 * read-only lanes must not be able to write, and no lane may address its
 * siblings. Until host 0.2.1-alpha.3 that narrowing was declared as
 * `toolFilter.deny` on each lane's `tool-subagent` row. alpha.3 removed
 * `persona` and `toolFilter` from that row's Config
 * (`dsh-tool-subagent/lib/index.js:355` throws on either key) and moved tool
 * composition into the Agent Preset — but a preset's `plugins[]` can only ADD
 * plugins, so there is no longer any way to EXCLUDE a host tool from a lane
 * declaratively.
 *
 * The one per-agent lever left is `tools.guard()`, which the registry evaluates
 * along the calling agent's own scope chain (`dsh-tools` `guardReason` walks
 * `chainLayers(exec.agent)`). Mounting this plugin inside a lane's preset
 * therefore scopes the denial to that lane alone: the parent and every sibling
 * lane keep their full surface.
 *
 * This is NOT the same instrument as the `toolFilter` it replaces, and the
 * difference is deliberate rather than incidental. A restriction removes the
 * tool from the model's visible surface; a guard leaves the tool visible and
 * refuses the call with a reason. Where a restriction could hide a capability,
 * a guard can only decline it. Verified on 0.2.1-alpha.3: a gated child's call
 * returns `tool "bash" is not available to this delegated lane` with no shell
 * spawned, while the parent's identical call succeeds.
 *
 * @module lane-tool-gate
 */

/** Cordis plugin name. */
export const name = 'lane-tool-gate'

/** The tools registry is the only service this needs. */
export const inject = ['tools']

/**
 * Refuse the configured tool names for every agent under this scope.
 *
 * An empty or absent list is a no-op rather than an error: lanes that deny
 * nothing should not have to mount a gate at all, and a materialized-empty list
 * is legitimate here — unlike in `tools.restrict()`, where an empty filter means
 * a caller built its config wrong.
 *
 * @param ctx - the preset scope context; the guard covers only agents joined under it.
 * @param config - `deny`: host tool names this lane may not call.
 */
export function apply(ctx, config) {
  const deny = new Set(Array.isArray(config?.deny) ? config.deny : [])
  if (deny.size === 0) return
  ctx.tools.guard((exec) => (deny.has(exec.name)
    ? `tool "${exec.name}" is not available to this delegated lane`
    : undefined))
}
