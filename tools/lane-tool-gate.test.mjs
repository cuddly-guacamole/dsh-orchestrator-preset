// ============================================================================
// lane-tool-gate.test.mjs — the RUNTIME half of a lane's tool boundary
// ============================================================================
//
// Why this file exists. The lane's surface is narrowed in two separate places, and
// until now only one of them had any coverage:
//
//   · ARTIFACT side — each `preset-orch-lane-<lane>` row carries a `lane-gate`
//     plugin whose `official` is a LITERAL array of permitted tool names. Covered
//     by `tools/patch-contract.test.mjs` (shape, literal table, forbidden names).
//   · RUNTIME side — `lane-tool-gate.mjs` computes
//     `deny = (names known to the live registry) − official` when the lane mounts
//     and again on EVERY `tools/change`. That recomputation is what keeps a tool
//     registered LATER — an MCP server's `mcp_<server>` registering in its own
//     `apply()` — out of a lane that mounted before it. THIS FILE covers that half.
//
// The distinction is not academic. The check 13 legs that used to prove "the deny
// moves between machines" were deleted with the `official` migration (a literal
// allow-list is identical on every machine, so those legs had no subject left).
// Their replacement proved the artifact's shape only, so the guarantee that
// actually strips a late tool was, for a while, guaranteed by construction and
// untested. These six cases are that guarantee, exercised against the real module.
//
// How. Every case calls the REAL exported `apply(ctx, config)` — no copy of its
// logic lives here, because a copy would keep passing after the module broke. The
// fake scope below is the only fiction: it owns the registry the gate reads
// (`ctx.tools.view`), records what the gate asks for (`ctx.tools.restrict`),
// captures the `tools/change` handler (`ctx.on`), and records warnings
// (`ctx.logger.warn`).
//
// ⚠️ `restrict()` in the real host emits `tools/change` itself. The fake models
//    exactly ONE such emission per call (guarded against re-entry), which is what
//    case 4 needs to prove the de-dup key is stored BEFORE the call. Modelling
//    every emission would turn a broken ordering into a stack overflow instead of
//    a clean failed assertion.
//
// Run: `npm test`, or `node --test tools/lane-tool-gate.test.mjs`.
// Zero third-party dependencies, same rule as the rest of `tools/`.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply } from '../lane-tool-gate.mjs'

/**
 * A fake preset scope. Nothing here is a second implementation of the gate: it only
 * supplies the four things `apply()` touches and records what the gate does to them.
 *
 * @param knownNames - the tool names the fake registry already knows at mount.
 * @param options.throwingRestricts - how many `restrict()` calls throw before one
 *   succeeds. Used to prove the failure path is retried rather than remembered.
 */
function makeScope(knownNames, options = {}) {
  const state = {
    known: [...knownNames],
    restrictCalls: [],
    warnings: [],
    handler: null,
    throwingRestricts: options.throwingRestricts ?? 0,
    // Re-entry latch for the modelled `tools/change` emission.
    emitting: false,
  }
  const scope = {
    tools: {
      // `knownNames` is the branch lane-tool-gate.mjs prefers; `visible` is here so
      // a change to that preference still reads something truthful in these tests.
      view: () => ({
        knownNames: state.known.slice(),
        visible: new Map(state.known.map((name) => [name, name])),
      }),
      restrict: (argument) => {
        state.restrictCalls.push(argument)
        if (state.throwingRestricts > 0) {
          state.throwingRestricts -= 1
          throw new Error('names unknown global tool')
        }
        // The emission `restrict()` performs itself. One level only (see the note
        // at the top of this file), and only once a handler exists — during the
        // mount pass the plugin has not registered its handler yet, exactly like
        // the real module.
        if (state.handler !== null && !state.emitting) {
          state.emitting = true
          try { state.handler() } finally { state.emitting = false }
        }
      },
    },
    logger: { warn: (message) => state.warnings.push(String(message)) },
    on: (event, fn) => { if (event === 'tools/change') state.handler = fn },
  }
  return {
    scope,
    state,
    /** Fire the captured `tools/change` handler, as a registering tool would. */
    fire: () => {
      if (state.handler === null) throw new Error('the gate registered no tools/change handler')
      state.handler()
    },
    /** A tool that registers after the lane mounted. */
    register: (name) => { state.known.push(name) },
  }
}

// ── 1. the first pass ────────────────────────────────────────────────────────
test('mount: restrict is called once with deny = known − official, sorted', () => {
  const { scope, state } = makeScope(['zeta', 'alpha', 'mid'])
  apply(scope, { official: ['mid'] })
  assert.deepEqual(state.restrictCalls, [{ deny: ['alpha', 'zeta'] }])
  assert.deepEqual(state.warnings, [])
})

// ── 2. the regression this whole file exists for ─────────────────────────────
test('a tool registered AFTER mount is still stripped on tools/change', () => {
  const { scope, state, fire, register } = makeScope(['read', 'bash'])
  apply(scope, { official: ['read'] })
  assert.deepEqual(state.restrictCalls, [{ deny: ['bash'] }])

  // The server finishes registering after the lane is up. Without the
  // `tools/change` recomputation the lane keeps `mcp_late` for the whole run —
  // a silent permission grant, not a visible failure.
  register('mcp_late')
  fire()

  assert.equal(state.restrictCalls.length, 2, 'the late name was never re-evaluated')
  assert.deepEqual(state.restrictCalls[1], { deny: ['bash', 'mcp_late'] })
})

// ── 3. the de-dup key keeps the loop finite ──────────────────────────────────
test('de-dup: an unchanged registry does not re-restrict, and repeated changes do not loop', () => {
  const { scope, state, fire } = makeScope(['read', 'bash'])
  apply(scope, { official: ['read'] })
  fire()
  fire()
  assert.equal(state.restrictCalls.length, 1, 'an unchanged deny list must not reach restrict() again')
})

// ── 4. the key must be stored BEFORE restrict() ──────────────────────────────
test('key is stored before restrict(): the tools/change that restrict() emits is a no-op', () => {
  const { scope, state, fire, register } = makeScope(['read', 'bash'])
  apply(scope, { official: ['read'] })
  // The mount pass happens before ctx.on(...), so it cannot re-enter here.
  assert.equal(state.restrictCalls.length, 1)

  register('mcp_late')
  // This call reaches restrict(); the fake emits tools/change from inside it. The
  // re-entrant pass must see the key as already applied and return.
  fire()
  assert.equal(state.restrictCalls.length, 2, 'the emission restrict() triggers caused a second narrowing')
})

// ── 5. a failure is retried, never remembered as "already narrowed" ──────────
test('a throwing restrict() warns and clears the key, so the next tools/change retries', () => {
  const { scope, state, fire } = makeScope(['read', 'bash'], { throwingRestricts: 1 })
  apply(scope, { official: ['read'] })

  assert.equal(state.restrictCalls.length, 1)
  assert.equal(state.warnings.length, 1, 'a lane that could not be narrowed must not fail silently')
  assert.match(state.warnings[0], /failed to narrow this lane/)

  // The registry did not change, so this only reaches restrict() if `last` was
  // cleared on failure. Keeping it would leave the lane wide for the whole run.
  fire()
  assert.equal(state.restrictCalls.length, 2, 'the failed narrowing was remembered as already applied')
  assert.deepEqual(state.restrictCalls[1], { deny: ['bash'] })
  assert.equal(state.warnings.length, 1)
})

// ── 6. nothing to deny ───────────────────────────────────────────────────────
test('nothing to deny: an official list covering every known name calls restrict zero times', () => {
  const { scope, state } = makeScope(['read', 'glob'])
  apply(scope, { official: ['read', 'glob'] })
  assert.deepEqual(state.restrictCalls, [])
  assert.deepEqual(state.warnings, [])
})
