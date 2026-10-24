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
 * ── Why `restrict` and not `guard` ──────────────────────────────────────────
 * An earlier revision of this file used `tools.guard()`, which refuses a call
 * but leaves the tool **visible**. That was the wrong instrument. The thing
 * being reproduced is `toolFilter`'s behaviour, and `toolFilter` REMOVED the
 * tool from the model's surface. A guard cannot: a lane would keep reading
 * `write` and `ops_bash` in its own tool list and spend turns discovering it may
 * not use them. `tools.restrict({ deny })` is the same operation `toolFilter`
 * performed, so the narrowed surface is the one the lane actually sees.
 *
 * ── Why not `restrict({ allow })` ──────────────────────────────────────────
 * An allow-list is the more natural statement of the intent ("these lanes may
 * only use these tools"), and it is what the `reader` lane used to declare. It
 * is unusable here: `restrict()` refuses names that are not registered yet, and
 * the host's global tool set is not fixed at the moment a lane mounts. Third
 * party and MCP tools register later (`dsh-mcp-loader` registers in its own
 * `apply()`), so an allow-list written at mount time would either throw on a
 * machine that lacks one of the listed names or freeze the surface against
 * late arrivals. A deny-list computed from what is registered **right now**
 * degrades correctly instead: the first pass covers what exists, and the
 * recomputation below covers what shows up afterwards.
 *
 * ── Why the `tools/change` recomputation, and why de-duplicated ─────────────
 * `restrict()` itself emits `tools/change`. Reacting to that event without a
 * de-dup key makes the plugin recompute, re-restrict and re-emit forever. The
 * key is the deny list itself, and it must be stored **before** calling
 * `restrict()` so the emission that call triggers is already seen as a repeat.
 * Without the earlier second pass, a lane mounted before an MCP server would
 * keep that server's tools: the surface is computed once and the late names
 * never get stripped — a silent permission grant rather than a visible failure.
 *
 * @module lane-tool-gate
 */

/** Cordis plugin name. */
export const name = 'lane-tool-gate'

/** The tools registry is the only service this needs. */
export const inject = ['tools']

/**
 * Restrict every agent under this scope to the configured tool names.
 *
 * @param ctx - the preset scope context; the restriction covers only agents joined under it.
 * @param config - `official`: the host tool names this lane is allowed to see.
 */
export function apply(ctx, config) {
  const official = new Set(Array.isArray(config?.official) ? config.official : [])

  // The deny list is recomputed from the live registry rather than declared, so a
  // tool registered after this plugin mounted is still stripped. See the
  // `tools/change` note in the module comment.
  let last = ''

  const applyNow = () => {
    const view = ctx.tools.view(undefined)
    const known = view.knownNames ?? [...view.visible.keys()]
    const deny = [...known].filter((n) => !official.has(n)).sort()
    const key = deny.join('\u0000')
    // A no-op recomputation is the common case: every mount and every unrelated
    // tool change lands here. Returning early is what keeps the loop finite.
    if (key === last) return
    // Set `last` BEFORE restrict(): restrict() emits `tools/change`, and the
    // handler for that event must see this key as already applied.
    last = key
    if (deny.length === 0) return
    try {
      ctx.tools.restrict({ deny })
    } catch (error) {
      // A lane that cannot be narrowed must not take the whole preset down with
      // it, but it must not fail silently either: the warning names the error so
      // a widened lane is visible in the log rather than inferred from behaviour.
      ctx.logger.warn(`lane-tool-gate: failed to narrow this lane: ${String(error)}`)
      // Do not keep `last`: a transient failure would otherwise be remembered as
      // "already applied" and the lane would stay wide for the rest of the run.
      last = ''
    }
  }

  applyNow()
  ctx.on('tools/change', () => {
    try {
      applyNow()
    } catch (error) {
      ctx.logger.warn(`lane-tool-gate: failed to recompute the lane surface: ${String(error)}`)
    }
  })
}
