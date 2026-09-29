/**
 * Lane composition for the `dsh-orchestrator-preset` agent preset — child addressing.
 *
 * The preset's nine named `subagent_*` lanes are rows of the preset itself, so
 * each lane keeps its own persona and `toolFilter` (those faces travel on the
 * lane row). What the Team layer takes over is the coordinator's control
 * surface: on the Lead's seat `send_message` / `list_agents` / `interrupt_agent`
 * resolve to the Team implementations, which address a teammate by NAME and
 * cannot reach a `subagent_*` child at all, so a Lead delegating through
 * `subagent_*` lanes has no tool to list, continue, or interrupt them — which is
 * exactly the three actions this plugin supplies, and nothing else.
 *
 * Names are new because `NamedEntries.insert` throws on a duplicate inside one
 * layer (`dsh-scope/lib/index.js:27-29`) and `tool-agent-team` registers its ten
 * names under a SINGLE try/catch over its whole set: reusing the Team names
 * would collide in the Lead's own layer and unwind every Team tool, shared task
 * board included.
 *
 * The tools are registered GLOBALLY — `ctx.tools.register`, once, at mount — and
 * never into a per-agent scope. Two measured reasons. First, `tools.restrict()`
 * accepts only GLOBALLY registered names: a scoped registration makes every
 * lane's deny entry illegal (`tools.restrict() names unknown global tools …`) and
 * the lane's whole setup then throws, which is how this plugin once took the
 * entire lane family down. Second, the preset's own control tools
 * (`send_message` / `list_agents` / `interrupt_agent`) already have exactly this
 * shape: registered globally by `tool-subagent-control`, then denied per lane by
 * the same deny lists. Those lists are what keeps these three names off a lane's
 * seat; the Lead, not being a lane, keeps them.
 *
 * Each action passes the live calling Agent (`exec.agent`) as sender/authority and
 * leaves ownership to the service (`agents.isOwnedBy` is not a gate: it accepts
 * only live resident children and would reject cold resume). One residual: the
 * adjacent-agent resume pointer is not injected under the Team assembly, so that
 * contract is carried by the persona and the `orch-delegation-brief` skill instead.
 *
 * @module lane-composition
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'lane-composition'

/**
 * Three services, and the first is not optional: `tools` is the registry this
 * plugin registers INTO — reading `ctx.tools` without it throws `cannot get
 * property "tools" without inject` (cordis' context proxy), which an earlier
 * revision caught into a warning and thereby registered nothing at all. The
 * sibling row `@deepseek-ai/dsh-tool-subagent-control` declares `tools` on this
 * same plane: the precedent that it is reachable here.
 *
 * `subagents` is the continuation seam and its catalog; `agents` is the live Agent
 * registry that turns a durable child id into a status. Both come from `dsh-base`.
 * No Team service is declared or read: registration is decision-free (no
 * membership test, no per-agent hook), so an assembly WITHOUT the Team bundle
 * behaves exactly like one with it.
 */
export const inject = ['tools', 'subagents', 'agents']

/**
 * Refine one child's status through the live Agent registry: `running` for an
 * active driver, `idle` for a resident Agent between turns, and `ready` when no
 * live Agent remains. `ready` keeps resumability visible without presenting an
 * inactive conversation as terminal.
 *
 * @param agents - the live Agent registry (`ctx.agents`).
 * @param id - the child's durable session id.
 * @returns the status to report for that child.
 */
function childStatus(agents, id) {
  const live = agents.get(id)
  if (live === undefined) return 'ready'
  return live.status === 'running' ? 'running' : 'idle'
}

/**
 * Project one catalog entry into the model-facing row, or drop a one-shot child.
 *
 * A child whose `mode` is not `continuable` can never accept a message, so
 * offering it would only invite an unaddressable id. The label falls back to the
 * id because the schema promises a string and the catalog records `label` as
 * optional.
 *
 * @param agents - the live Agent registry (`ctx.agents`).
 * @param entry - one row from `listChildren`.
 * @returns the row to report, or undefined for a one-shot child.
 */
function projectChild(agents, entry) {
  if (entry.mode !== 'continuable') return undefined
  return {
    id: entry.id,
    label: entry.label ?? entry.id,
    status: childStatus(agents, entry.id),
  }
}

/**
 * Build the Lead-side `subagent_children` tool: enumeration of the caller's own
 * continuable `subagent_*` children by durable agent id.
 *
 * The listing is scoped CONSTRUCTIVELY — it queries the caller's own session id
 * — so every row is necessarily one of the caller's own children.
 *
 * @param ctx - the preset's scope context, where `subagents` and `agents` were injected.
 * @returns the tool definition.
 */
function childrenTool(ctx) {
  return defineTool({
    name: 'subagent_children',
    description: 'List YOUR OWN continuable `subagent_*` children by durable agent id, label, and live status. '
      + '`running` means the child is working now; `idle` means it is resident but between turns; `ready` means no '
      + 'live Agent remains although the durable session still exists, so it can still be resumed. The `id` reported '
      + 'here is exactly the `agent_id` that `subagent_send` and `subagent_interrupt` take. This is NOT the Team '
      + 'roster: `list_agents` lists the Lead and every durable teammate by teammate NAME and cannot address a '
      + '`subagent_*` child at all. One-shot children are omitted because they cannot be messaged.',
    parameters: {},
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            label: { type: 'string', required: true },
            status: { type: 'string', required: true, enum: ['running', 'idle', 'ready'] },
          },
        },
      },
      render: (_args, entries) => [{
        type: 'text',
        text: entries.length === 0
          ? '(no subagent children)'
          : entries.map((entry) => `${entry.id} [${entry.status}] — ${entry.label}`).join('\n'),
      }],
    },
    async execute(_args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('subagent_children requires a calling agent (exec.agent was undefined)')
      const entries = await ctx.subagents.listChildren(parent.session.header.id, exec.signal)
      return entries.map((entry) => projectChild(ctx.agents, entry)).filter((entry) => entry !== undefined)
    },
  })
}

/**
 * Build the Lead-side `subagent_send` tool: continuation delivery to one of the
 * caller's own `subagent_*` children by durable agent id.
 *
 * @param ctx - the preset's scope context, where `subagents` was injected.
 * @returns the tool definition.
 */
function sendTool(ctx) {
  return defineTool({
    name: 'subagent_send',
    description: 'Deliver a message to a DIRECT continuable child of your own, addressed by the agent id that '
      + '`subagent_children` reported. A child that is still working is steered at its nearest step boundary; an '
      + 'idle child starts a turn; a child that is no longer resident is cold-resumed from its durable session, '
      + 'which is what makes this the continuation tool. The call returns only confirmation that the message was '
      + 'DELIVERED — never the child\'s reply — so a failure means the message was NOT delivered. This is NOT the '
      + 'Team tool: `send_message` addresses a teammate by NAME and cannot reach a `subagent_*` child at all.',
    parameters: {
      agent_id: {
        type: 'string',
        required: true,
        description: 'The durable agent id of your direct continuable `subagent_*` child, as reported by `subagent_children`.',
      },
      message: {
        type: 'string',
        required: true,
        description: 'The message to deliver to the child.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { messageId: { type: 'string', required: true } },
      },
      render: (args, _value) => [{ type: 'text', text: `message delivered to agent ${args.agent_id}` }],
    },
    async execute(args, exec) {
      const sender = exec.agent
      if (sender === undefined) throw new Error('subagent_send requires a calling agent (exec.agent was undefined)')
      const content = [{ type: 'text', text: args.message }]
      return { messageId: await ctx.subagents.sendMessage(sender, args.agent_id, content, { signal: exec.signal }) }
    },
  })
}

/**
 * Build the Lead-side `subagent_interrupt` tool: cancellation of one running
 * `subagent_*` child's CURRENT TURN by durable agent id.
 *
 * @param ctx - the preset's scope context, where `subagents` was injected.
 * @returns the tool definition.
 */
function interruptTool(ctx) {
  return defineTool({
    name: 'subagent_interrupt',
    description: 'Request cancellation of one running `subagent_*` child\'s CURRENT TURN, addressed by its agent id. '
      + 'Only the current turn stops: messages already queued for the child stay parked until a later '
      + '`subagent_send`, agents the child started keep running, and the child itself stays available for '
      + 'follow-ups. The call returns as soon as the stop request is accepted, so the target may keep running '
      + 'briefly, and interrupting an already-finished agent is an accepted no-op. Address DIRECT children only; to '
      + 'stop a grandchild, have the intermediate child interrupt it. This is NOT the Team tool: `interrupt_agent` '
      + 'addresses a teammate by name and cannot reach a `subagent_*` child at all.',
    parameters: {
      agent_id: {
        type: 'string',
        required: true,
        description: 'The durable agent id of the running `subagent_*` child whose current turn should stop.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { accepted: { type: 'boolean', required: true } },
      },
      render: (args, _value) => [{ type: 'text', text: `interrupt requested for agent ${args.agent_id}` }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('subagent_interrupt requires a calling agent (exec.agent was undefined)')
      await ctx.subagents.interrupt(args.agent_id, { kind: 'ancestor', agent: caller })
      return { accepted: true }
    },
  })
}

/**
 * Build the three Lead-side child-addressing tools.
 *
 * Exported so the definitions can be constructed and inspected without a live
 * host: `defineTool` compiles every schema eagerly, so building them IS the
 * check that the declarations are valid.
 *
 * @param ctx - a context carrying the `subagents` and `agents` services.
 * @returns the enumeration, delivery, and cancellation tools.
 */
export function buildChildTools(ctx) {
  return { children: childrenTool(ctx), send: sendTool(ctx), interrupt: interruptTool(ctx) }
}

/**
 * Register the three tools into the GLOBAL layer, once, at mount.
 *
 * Global is not a preference: `tools.restrict()` resolves its names against the
 * global registry, so a lane's deny entry is legal only if the name was
 * registered here (see the module doc). Registration therefore depends on no
 * agent, no membership, and no Team service.
 *
 * A failure is still contained: a throwing register must not take the preset
 * down with it, and the warning names the error so a silent feature outage is
 * still visible in the log.
 *
 * @param ctx - the preset's scope context, where the injected services live.
 * @returns the three tool names and whether registration succeeded.
 */
function applyGlobalTools(ctx) {
  const definitions = Object.values(buildChildTools(ctx))
  const tools = definitions.map((tool) => tool.name)
  try {
    for (const definition of definitions) ctx.tools.register(definition)
    return { tools, registered: true }
  } catch (error) {
    ctx.logger.warn(`lane-composition: child-addressing tools failed to register: ${String(error)}`)
    return { tools, registered: false }
  }
}

/**
 * Register the child-addressing tools once, globally, when this row mounts.
 *
 * Every agent then inherits them, which is why the preset's lane deny lists name
 * all three: the lists are what keeps the names off a lane's seat while the Lead
 * keeps them. Nothing here waits on, reads, or depends on the Team bundle.
 *
 * @param ctx - the preset's scope context.
 */
export function apply(ctx) {
  const registration = applyGlobalTools(ctx)
  ctx.logger.info(
    `lane-composition: registered ${JSON.stringify(registration.tools)} registered=${registration.registered}`,
  )
}

