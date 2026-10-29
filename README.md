<div align="center">

# @quill507/dsh-orchestrator-preset

**A thin-shell agent preset for DeepSeek Harness**

*The aegis method pack for methodology · a self-authored orchestration layer for delegation*

[![npm](https://img.shields.io/npm/v/@quill507%2Fdsh-orchestrator-preset?style=flat-square&label=npm&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
[![downloads](https://img.shields.io/npm/dm/@quill507%2Fdsh-orchestrator-preset?style=flat-square&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.3_%7C_0.2.1--rc.4_%7C_0.2.1--rc.5_%7C_0.2.2--alpha.2-4c6ef5?style=flat-square&labelColor=454a54)
[![license](https://img.shields.io/badge/license-MIT-3da639?style=flat-square&labelColor=454a54)](https://opensource.org/licenses/MIT)

[中文](README.zh.md) · [Notices](THIRD_PARTY_NOTICES.md) · [Issues](https://github.com/cuddly-guacamole/dsh-orchestrator-preset/issues)

</div>

A thin-shell agent preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
the **aegis methodology pack** (upstream, consumed at runtime, unmodified) plus a
**self-authored orchestration layer** — nine named lanes with mechanically declared tool
boundaries, resident routing sections, a plan-aware persona, and an evidence-based
completion gate.

The repository root **is** the bundle. There is no `bundle/` subdirectory: the files here
are exactly the files that get installed.

---

## Design

> **This section is the current and complete authority for what this preset is and how it
> works.** There is no separate design specification in this repository: the full design
> draft this grew out of — about 280K of design history, decision trail and rejected
> alternatives — is **not distributed here**. It is held back, and this section is the
> design description in its place. If you want the deeper reasoning, ask; it is not linked
> because a link to a file this repository does not contain would look authoritative and
> fail on click.

### What it is

DSH has no notion of an agent that delegates. A preset declares a set of tools and a
persona; nothing in that vocabulary says "this work belongs to someone else". This preset
supplies that missing layer. The orchestrator does not write code, search a codebase, or
review its own output — it routes each piece to a lane that is *declared* to be allowed to
do it, and then judges the result against evidence on disk.

### Lanes and their tool boundaries

Nine lanes are rows of the preset itself: `planner`, `scout`, `archivist`, `seer`,
`reader`, `analyst`, `auditor`, `wright`, `forge`. Each carries its own persona file and its
own Agent Preset, whose `lane-gate` plugin holds that lane's **allow-list** (`official`) and
whose remaining rows mount the official tool plugins that list names — so a lane's capability
boundary is **declarative, not advisory**. The allow-list is exclusive: a read-only lane's
`official` set is `read`, `read_image`, `glob`, `grep`, so `write`, `edit`, `todo_write`,
`bash`/`pwsh`, the four reminder tools, every other lane's dispatch tool and the lead-side
child-addressing tools are not narrowed but **absent** from its surface. Granting rather than
refusing is what keeps a lane from re-entering the coordinator role: a capability nobody
granted cannot drift back in.

`lane-composition.mjs` closes a gap the host leaves open. A Team assembly gives the lead
`send_message` / `list_agents` / `interrupt_agent`, which address teammates **by name** and
cannot reach a `subagent_*` child at all — so a lead delegating through `subagent_*` lanes
would have no way to list, continue, or interrupt them. This bundle registers exactly those
three actions under distinct names (`subagent_children`, `subagent_send`,
`subagent_interrupt`), addressed by **durable agent id**. Two id namespaces, never mixed.
The three names are registered *globally* on purpose: `tools.restrict()` resolves against
the global registry, so a scoped registration would make every lane's deny entry illegal and
take the whole lane family down.

### Routing sections

`routing-sections.mjs` registers four **static** text sections that are reassembled every
turn by the host's `systemPrompt` registry: the domain-owner table, the trigger-arbitration
table, a short index of standing judgements, and the MCP discipline. They are static
constants on purpose — a dynamic system prefix invalidates the session cache wholesale.

The single-owner rule is the point. The MCP discipline lives in exactly one section, the
orchestrator persona carries one pointer to it, and a delegation brief may *reference* it
but must never restate it. The same discipline governs the orchestration layer's own
content: the orchestrator persona explicitly disclaims the lane roster and the MCP rules,
because a second copy is a second owner.

**The four `orch-*` skill names are load-bearing, and renaming one is a two-file edit.**
`routing-sections.mjs` and `personas/orchestrator.md` both name `orch-evidence-protocol` and
`orch-delegation-brief` explicitly, and the routing table's rows resolve by that exact
string. Rename a skill directory and its frontmatter but not those references, and the row
keeps pointing at a name nothing provides — which is a silent failure, because a routing
entry that matches no skill simply never fires. `node tools/gen-cordis-patch.mjs` and
`node tools/audit-personas.mjs` catch a half-finished rename; neither is run automatically,
so run one after touching a skill name.

The `orch-` prefix itself is not decoration: these skills land in a registry that also holds
whatever else a given machine has installed, so an unprefixed `evidence-protocol` would be a
name waiting to collide.

### Evidence and state

Completion is a file, not a sentence. A task counts as done only when
`.dsh/evidence/<task-id>-<slug>.md` exists, is non-empty, and carries exactly one anchored
verdict line as its last line. Every path touched in a turn is classified at completion as
`in_scope`, `out_of_scope`, `undeclared` or `illegal`, and anything but `in_scope` blocks
the completion claim. State that must outlive a session — the lane ledger
(`.dsh/state/lanes.md`), direction-level ownership claims (`.dsh/state/claims.md`) and
goal frames (`.dsh/goals/<slug>.md`) — lives in files, so that a claim can be checked
against what other writers also see.

### How this differs from the upstream aegis pack

aegis supplies **method**: how to write a plan, run strict TDD, debug systematically, run a
review, verify before claiming done. It is a library of skills, and it assumes a single
coordinator doing the work.

This preset supplies **topology**: who does what, under which tool restrictions, with which
evidence. The two are orthogonal and complementary — aegis skills are routed *to* lanes
rather than executed in place. What the preset adds that aegis structurally cannot is
everything that presupposes more than one agent: the lane ledger and its three states, the
direction-level atomic claim with a staleness criterion for cross-session ownership, and
the independent-review rule. Those are not extensions to aegis; they are a different axis,
and no aegis skill is modified to accommodate them.

---

## Sourcing: what is upstream, what was measured here

Being precise about this matters more than it usually does, because a preset is a pile of
claims about someone else's runtime.

**Read the version numbers in this table as measurement sites, not as support claims.** The
supported host set is four versions, `0.2.1-rc.3`, `0.2.1-rc.4`, `0.2.1-rc.5` and
`0.2.2-alpha.2` — see [Host version gate](#0-host-version-gate).
Several rows below cite `0.2.0-rc.2`, `0.2.1-alpha.1` … `0.2.1-alpha.5`, `0.2.1-rc.2`; each of those is
where a measurement was taken, and every one of them is **out of support**. They are kept
because they are the evidence for decisions the artifact still embodies — which keys are
absent, why a gate exists, why the MCP names are computed rather than written. Rows that
record a fact about the *current* supported host say so.

| Claim | Status |
|---|---|
| A bundle declares a patch via the `dsh.bundle.patch` field in its `package.json`, e.g. `"patch": "./cordis.patch.yml"`. | **Upstream contract.** Verbatim in the published `@deepseek-ai/dsh-base` manifest, which also exports the patch as a subpath. |
| Later patch layers win, and a patch **replaces the whole row** rather than deep-merging it — so a row overriding `config` must restate every key it needs. | **Corroborated twice, independently.** |
| Exact layer order: bundle patches in `dsh.profile.bundles` order, then the profile's own `cordis.patch.yml`, then `$DSH_HOME/cordis.patch.yml`, then each `--patch` overlay. | **Verified on host version 0.2.0-rc.1.** Not confirmed against upstream documentation. |
| A profile lives at `~/.dsh/profiles/<name>/` containing `cordis.yml`, `cordis.patch.yml` and `package.json`. | **Verified on host version 0.2.0-rc.1.** Not confirmed against upstream documentation. |
| `config.selectedDefault` is in the preset schema and is the effective value; the schema also carries `config.default`, and `defaultId` resolves `selectedDefault ?? default`. | **Verified on host version 0.2.0-rc.1**, against `@deepseek-ai/dsh-agent-preset-registry`. |
| `{{cwd}}` is a registered prompt variable; an unknown `{{…}}` reference throws during assembly. | **Version-dependent, and measured on each version** (historical measurement — neither version named is supported). Registered on `0.2.0-rc.2` (`dsh-agent-loop` registers `provider`/`model`/`cwd`), **absent from `0.2.1-alpha.2` onward** (only `provider`/`model` — re-checked on the installed `0.2.1-alpha.5`, and again on all four supported versions, where `dsh-agent-loop`'s variable table is `provider`/`model` at rc. line `:1591-1592` / `0.2.2-alpha.2` `:1345-1346`, with no `cwd`). Reproduced against the installed host's own `renderPrompt`: `unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`. Upstream `dsh-system-prompt/README.md` now tells users to remove the clause. The `suffix` field itself is still in `dsh-persona`'s `Config`; what is absent is the variable it referenced, so a suffix can only be empty — which is why the `persona` row is written without one. See [Host version gate](#0-host-version-gate). |
| `tool-subagent`'s `Config` accepts `backgroundMode`. | **Version-dependent** (historical measurement — neither version named is supported). Present on `0.2.1-alpha.1` (`lib/index.js:257`), **absent from `0.2.1-alpha.2` onward**. schemastery tolerates the unknown key, so the removal is silent — verified by feeding both forms through the installed schema. Continuable is now decided by the provider's `prepareContinuable`: the spawn provider and the rc-line fork provider (`dsh-subagent-fork-in-process`) implement it — **read on the rc line; `0.2.2-alpha.2` was not read separately for that fork package**, which the contract matrix does not cover. The lane rows therefore write no `backgroundMode` at all. |
| The `standard` preset skeleton is the authority for which rows exist. | **Verified on each version** (historical measurement — none of the versions named is supported). It shrank from 162 lines (`0.2.0-rc.2`, `0.2.1-alpha.1`) to 137 (`0.2.1-alpha.2`), dropping `tool-ralph`, `tool-subagent-codex` and `tool-subagent-claude-code`; `tool-schedule` was added — **on alpha.1, not on rc.2**. Re-measured on the installed `0.2.1-alpha.5`: 128 lines, still carrying `time-context` and `tool-schedule`, still without the three dropped rows. **Read on all four supported versions:** the skeleton that matters is `dsh-web-app/presets/standard.patch.yml` — 128 lines / 33 rows on the rc. line (rc.3, rc.4 and rc.5 are byte-identical) and 127 lines / 32 rows on `0.2.2-alpha.2`, which drops exactly one row, `tool-subagent-list-agents`. `time-context` (`:19`) and `tool-schedule` (`:35`) are rows of *that* file on all four; `dsh-base/cordis.patch.yml` carries neither of them, and the pair it does carry is `working-directory` (`:166`) and `tool-working-directory` (`:169`). |
| `@deepseek-ai/dsh-tool-schedule` exists on every supported host. | **True, now that the supported set is the rc.3 + rc.4 + rc.5 + alpha.2 set.** Every supported host ships it, as an exact lockstep pin: `dsh@0.2.1-rc.3` depends on `@deepseek-ai/dsh-tool-schedule@0.2.1-rc.3`, and `dsh` at rc.4, rc.5 and `0.2.2-alpha.2` pin the matching `0.2.1-rc.4`, `0.2.1-rc.5` and `0.2.2-alpha.2`. This was **false** under the old three-version set — npm published it only at `0.0.1-rc.2` (a different generation) and `0.2.1-alpha.1` … `0.2.1-alpha.5`, and `dsh@0.2.0-rc.2` did not depend on it (rc.2's reminder tools were the optional, off-by-default `dsh-experimental-schedule-bundle`, which inserts `time-context`/`schedule`/`ui-schedule` and **not** `tool-schedule`). That history is why the four names used to be behind a conditional and are now static. |
| A deny name the host does not register fails loudly at delegation, not at mount. | **Verified on `0.2.0-rc.2` and `0.2.1-alpha.2`, identical behaviour** (historical measurement — neither version is supported). `tools.restrict()` throws `names unknown global tool` (rc. line `dsh-tools/lib/index.js:2991-3004` / `0.2.2-alpha.2` `:453-466` — same method body, same message text, different line), and `dsh-subagent` calls it unguarded when a child is composed (`lib/index.js`: rc. line `:401` / alpha.2 `:396`). This is why the `mcp_*` names are **computed per machine** rather than written as literals: a hardcoded list would break every delegation on a machine that lacks one of those servers. The `schedule_*` names are now static precisely because every supported host always has them. The class that owns `restrict()` was renamed `ToolRuntime` → `ToolsService` on alpha.2, but the service key it registers is still `"tools"`, so call sites that go through `ctx.tools` are unaffected. |
| `tool-subagent`'s row `Config` still accepts `persona` and `toolFilter`. | **False on every supported host.** `dsh-tool-subagent`'s `Config` literal declares neither key (rc. line `lib/index.js:311-324` / `0.2.2-alpha.2` `:301-315`), and `apply()` hard-throws on both at mount (rc. line `:355` / alpha.2 `:346` — the text is verbatim the same, only the line moved). The `Config` **key set** is not the same across the set either: alpha.2 replaces `modelSelectionSettings` with `modelSelection` + `modelDiscovery`, and a key the schema does not know is silently dropped rather than rejected — which is the whole reason the gate tests the version and not the `Config` shape. The bundle writes neither. It therefore emits **one** lane form, the Agent-Preset form — see [One lane form, and why](#one-lane-form-and-why). |
| An Agent Preset can express a tool **exclusion**. | **False, and it is why the bundle ships `lane-tool-gate.mjs`.** A preset's `plugins[]` can only ADD. Measured on `0.2.1-alpha.3` (historical measurement; that version is not supported): a persona-only preset gave the child **25** tools including `edit`/`bash`/`send_message`/`interrupt_agent`, and marking `tool-bash` `disabled: true` inside the preset left `bash` present (23 tools). `toolFilter` is also unreachable on that path: fresh dispatch sends `composition: { agentPreset }` only (`dsh-subagent/lib/index.js:1452`), and the single consumer at `:395` reads the field the **resume** path restores from a persisted descriptor (`:2177`). |
| `0.2.1-alpha.5` changes nothing this preset depends on. | **Measured against its own published tarballs, not inferred from its neighbour** (historical measurement — alpha.4 and alpha.5 are both out of support). alpha.4 → alpha.5 differs in exactly two packages: `dsh-tool-subagent` by **one prompt sentence** (the delegation hint at `lib/index.js:516` lost its "end your turn instead of sleeping" clause), and `dsh-tools` by **71 changed lines that all live in `run_code`'s parameter descriptions**. The surfaces this bundle actually leans on are **byte-identical**: `tool-subagent`'s `Config` literal (`:311-324`), its `apply()` reject loop (`:355`), and `dsh-tools`' `guard()` / `guardReason` / `restrict()` / `defineTool()` (same occurrence counts on both versions). `dsh-subagent`, `dsh-agent-preset`, `dsh-agent-preset-registry`, `dsh-persona`, `dsh-agent-loop`, `dsh-base` and `dsh-tool-schedule` are byte-identical apart from their own version strings. Kept as the record of why no gate change was needed when alpha.5 joined the set; that set no longer exists. |

DeepSeek Harness is MIT-licensed: [`github.com/deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness).
Unrelated projects sharing a similar name are not a source for anything in this repository.

---

## Repository layout

| Path | What it is |
|---|---|
| `cordis.patch.yml` | **Generated.** The preset's rows. Do not edit by hand — see below. |
| `tools/preset-declaration.mjs` | **The single source of truth** for the preset's rows. |
| `tools/gen-cordis-patch.mjs` | Generates `cordis.patch.yml` from the declaration. |
| `tools/audit-personas.mjs` | Static audit of the persona files (originality thresholds against an excluded upstream corpus). |
| `plan-aware-persona.mjs` | Swaps the persona between Orchestrator and Planner per assembly. |
| `routing-sections.mjs` | The four resident routing sections. |
| `lane-composition.mjs` | The three durable-agent-id child-addressing tools. |
| `lane-tool-gate.mjs` | The lane tool gate: `tools.restrict({ deny })`, mounted inside each lane's Agent Preset, because a preset cannot express a tool exclusion. The `deny` set is computed at runtime as **the globally registered names minus that lane's `official`**, and recomputed on `tools/change` — so a tool registered *after* the lane mounted is still stripped. See [One lane form, and why](#one-lane-form-and-why). |
| `personas/` | Ten persona files: orchestrator, planner, and one per lane. |
| `skills/` | The four self-authored `orch-*` skills. This directory is the authoritative list of them. |
| `extensions/dsh/` | The bundle's two plugins: the skills provider, and the aegis prefix bridge. |
| `docs/` | **Not distributed.** The design history is held back; the Design section above is the specification. |
| `install.sh` | Installs everything below into a DSH home. |
| `tools/verify-install.sh` | Thirteen read-only checks that the preset is installed and selected. |
| `README.zh.md` | The Chinese README. Same content, same obligations. |
| `LICENSE` | MIT, plus third-party attribution. |

**Editing the preset.** `cordis.patch.yml` carries a "DO NOT EDIT BY HAND" header and is
regenerated. Change `tools/preset-declaration.mjs` and run:

```sh
node tools/gen-cordis-patch.mjs
```

The generator needs a skeleton patch to merge against; it looks for `--skeleton <path>`,
then `$DSH_SKELETON`, then the host's own `standard.patch.yml`, and it refuses to invent one
if none is found. The `cordis.patch.yml` in this repository is byte-for-byte what that
command produces from the committed declaration.

---

## Installation

The install method is a **`link:`** dependency, and the package is **also published to npm**
as `@quill507/dsh-orchestrator-preset`.
`package.json` carries **no** `"private"` key. A profile projects the bundle under **the same
name** the registry publishes it under, so a local projection and the published package are
told apart by **where they point**, not by their names — see
[Publishing to npm](#publishing-to-npm) for what that costs and why it was accepted.
The package declares **no** `dependencies` — the host supplies everything at runtime. It does
declare `peerDependencies`, all four marked `optional`, so that what it was tested against is
written down without any install being able to fail over it:

| Package | Pinned version | Why |
|---|---|---|
| `@deepseek-ai/dsh-skill-filesystem` | `0.2.1-rc.3 \|\| 0.2.1-rc.4 \|\| 0.2.1-rc.5 \|\| 0.2.2-alpha.2` | the provider this bundle mounts |
| `@deepseek-ai/dsh-tools` | `0.2.1-rc.3 \|\| 0.2.1-rc.4 \|\| 0.2.1-rc.5 \|\| 0.2.2-alpha.2` | `defineTool`, used by `lane-composition.mjs` |
| `@deepseek-ai/cordis` | `4.0.5 \|\| 4.0.6-alpha.1` | the plugin contract |
| `@deepseek-ai/schemastery` | `3.18.5 \|\| 3.18.6-alpha.1` | the `Config` schema the settings card is built from |

Neither column is a range. The two dsh packages enumerate the supported set itself — the same
four names, in the same order, as [Host version gate](#0-host-version-gate) and as `install.sh`'s
own copy. `cordis` and `schemastery` enumerate **two** values rather than one, because the set
straddles two generations of them: `4.0.5` / `3.18.5` on the rc. line, `4.0.6-alpha.1` /
`3.18.6-alpha.1` on `0.2.2-alpha.2`, and no single value is true of all four. `||` is still an
**enumeration, not a range** — it names exactly the versions written down, and an install against
any other host is **out of contract by construction**: there is no band left for it to fall
inside. The earlier wording said the lower bounds named the oldest supported host
(`0.2.0-rc.2`); there is no band to bound any more, so there is nothing for a lower bound to name.

**npm does not enforce any of this — the host does, in two places, and only one of them is
`disabled`.** All four peers are marked `optional`, so npm itself will not refuse an install that
resolves a different host, and it will not warn in a way anyone acts on. What actually happens
depends on which of the two barriers the host meets first:

- **At load time, the peers are the barrier.** The host's own loader checks the bundle's
  `peerDependencies` against its own version and, when they do not cover it, **skips the bundle
  whole**:

  ```
  dsh: skipping profile bundle "@quill507/dsh-orchestrator-preset": Error: Plugin @quill507/dsh-orchestrator-preset@0.2.1 is incompatible with dsh 0.2.2-alpha.2: requirements {"@deepseek-ai/dsh-skill-filesystem":"0.2.1-rc.2 || 0.2.1-rc.3","@deepseek-ai/dsh-tools":"0.2.1-rc.2 || 0.2.1-rc.3"}. Running it may cause crashes or data loss. … Exact-version exemption: not active.
  ```

  Quoted from a run against the npm `0.2.2-alpha.2` tree carrying the **previous** peers;
  reproduce it with `dsh --profile <name> --dump-config 2>&1 | grep -i "skipping profile bundle"`.
  Read the `requirements` object closely, because its scope is **exact** rather than "every peer
  is checked": it names the two `dsh` packages and neither `@deepseek-ai/dsh-tool-subagent` nor
  `cordis` / `schemastery`, which are `optional` as well. When this fires, nothing mounts because
  nothing was composed — the nineteen rows never reach the point of being evaluated. An exemption
  door exists (`dsh plugin allow-version`, or the plugin manager); it is mentioned because the
  message names it, **not** as a route this file recommends.
- **At mount time, the artifact's own gate is the barrier.** When the peers *do* cover the host,
  the bundle is composed and each gated row's `disabled` expression compares the host's
  `@deepseek-ai/dsh-tool-subagent` **version** against `SUPPORTED_HOST_VERSIONS` — see
  [Host version gate](#0-host-version-gate). A host the peers let through but that set does not
  contain installs and mounts nothing.

**The two criteria differ on purpose.** The peer check is a **semver range** — it asks whether a
host is covered, and enumerating exact versions with `||` is the right shape for that question.
Two readings of the same string, worth keeping apart: what this file writes down is an
**enumeration** (no `>=` anywhere in it), while the loader reads that string as a **union of
intervals**; on every version the enumeration names, the two readings agree, and they can only
part company over versions that sit *between* the named ones — which is precisely the region this
preset refuses to claim. `SUPPORTED_HOST_VERSIONS`, by contrast, is a **literal membership
test** — it asks whether this is one of the versions somebody actually read. "The range lets it
through, the member test refuses it" is
therefore a legal and **intended** combination, not a contradiction: the range gates *loading*,
the member test gates *mounting*. `install.sh`'s version gate is a third copy of the member test,
and it stays **opt-in** — anyone installing by `npm install` or by hand-writing a `link:`
dependency never runs it.

**That is what makes this round's peer change load-bearing rather than bookkeeping.** The old
enumeration stopped at `0.2.1-rc.2 || 0.2.1-rc.3` while npm `latest` had moved to `0.2.1-rc.5` and
the `next` / `alpha` channel to `0.2.2-alpha.2` — so on those two channels the bundle was not
"switched off at mount", it was never loaded, and the nineteen expressions were never given a
chance to answer. Widening the enumeration to the four names is what lets those users reach the
`disabled` expression at all; with it, that same host composes the bundle and the gate answers
false — the tree the [§5 snippet](#5-wire-it-into-a-profile) was measured on.

**Why the artifact carries a host gate at all — the historical record.** Two host releases
broke something this preset relied on, in two different ways, and that is the whole reason a
`disabled` expression exists in the artifact. These are measurements, kept because they
explain the artifact's shape; they are **not** support claims, and none of the versions named
is supported:

- **`0.2.1-alpha.2` removed two keys** (historical measurement; that version is out of support).
  `{{cwd}}` stopped being a registered prompt variable,
  and `backgroundMode` disappeared from `tool-subagent`'s `Config`. Both removals were
  *absorbable*: the preset stopped writing either one, and the resulting `persona` row and lane
  row are legal on every supported host.
- **`0.2.1-alpha.3` removed the mechanism, not a key** (historical measurement; that version is
  out of support). `persona` and `toolFilter` left
  `tool-subagent`'s row `Config` entirely, and `apply()` now hard-throws if either is present.
  That one is **not** absorbable: the replacement (an Agent Preset) does not exist before
  alpha.3, and it cannot express a tool *exclusion* at all. So the lane rows ship in the
  Agent-Preset form, and that form carries a self-authored gate plugin. See
  [One lane form, and why](#one-lane-form-and-why).

Nothing that differs between host versions is silently tolerated (see
[Sourcing](#sourcing-what-is-upstream-what-was-measured-here)), because a preset that is only
correct on its newest host is not supported on any other — and a preset that is only correct
on its newest host *while appearing to load* is worse than one that fails.

**The reminder tools are the Lead's alone, and that is now a grant-shaped claim.** The durable
reminders (`schedule_create` / `schedule_list` / `schedule_update` / `schedule_delete`) come
from `@deepseek-ai/dsh-tool-schedule`. Every supported host **ships it itself**, as an exact
lockstep pin — `dsh@0.2.1-rc.3` depends on `@deepseek-ai/dsh-tool-schedule@0.2.1-rc.3`, and rc.4,
rc.5 and `0.2.2-alpha.2` pin their own matching versions — so the row that
mounts it is a **bare row**, the same shape the official skeleton uses, with no `disabled`
expression. The four names reach the Lead because that row sits in the preset's own
`plugins[]`, and they reach **no lane** because none of the nine `official` sets names them —
the gate strips them by default rather than by enumeration.

This is a simplification of an earlier conditional, and the reason it is safe is the reason it
is honest: an earlier version of this bundle evaluated the host at mount time and added the
four names only where the package resolved, because `0.2.0-rc.2` has no
`@deepseek-ai/dsh-tool-schedule`. With a supported set whose every member ships the package,
"resolves on this host" is no longer a question worth asking — a static list is the correct
expression of "every supported machine has this".

**A known, accepted degradation: on every supported host, a `subagent_fork` child can use the
reminder tools.** This is a correction of a claim 0.1.9 made, and the old claim was already
false on `0.2.1-alpha.4`/`alpha.5` — it is not a regression introduced here, and it is **not
fixed** by the fork row's `disabled` expression: that expression only switches the row off on an
*unsupported* host, where nothing mounts anyway. On **every** supported host the row is enabled,
and the degradation stands. The `subagent_fork` control row carries **no `toolFilter`** and no
equivalent deny list, because every supported host **hard-rejects that key**
(`dsh-tool-subagent/lib/index.js:355`), and the fork provider
reports `capabilities.agentPreset = false` — and that one is **read on the rc line; `0.2.2-alpha.2`
was not read separately for `dsh-subagent-fork-in-process`**, which the contract matrix does not
cover — and inherits its parent's composition — so there
is **no declarative path** to narrow a forked child. The consequence, stated without
softening: **a child created through `subagent_fork` can call the reminder tools, even though
the nine named lanes cannot.** The blast radius is bounded — the nine named lanes never grant
the four names through the gate, and a lane cannot fork (no `official` set contains
`subagent_fork`) — but the Lead's own forks are outside that boundary. Closing it would need
a runtime mechanism (the same gate applied to fork children), which means a new plugin file;
it is not in this release.

`tools/patch-contract.test.mjs` checks the lane gate's `official` lists and the `disabled`
probe against a simulated machine, so a machine-specific name creeping back into any lane's
grant fails loudly rather than at the next delegation.

### 0. Host version gate

```sh
dsh --version          # install.sh refuses anything below 0.2.1-rc.3
```

This is a hard check inside `install.sh`. The supported set and the floor are no longer the same
value, and that is a deliberate return to a distinction this file used to argue against: the
floor is the **lowest** supported version, `0.2.1-rc.3`, while the supported set is the four
versions in the table below. A host above the floor but outside the set also ends up mounting
nothing, but **in the default world it never even composes**: the host's own loader sees that its
`peerDependencies` do not cover that version and skips the bundle whole, so the artifact's
`disabled` gate never runs. Only if you exempt the peers by version (`dsh plugin allow-version`)
does the bundle compose — and then the artifact's own gate answers `true` and disables all
nineteen rows. Two stages, one outcome; `install.sh` names the case out loud instead of letting
the absence be discovered later, and what it decides is the **floor**, not the set.

The gate is a **floor**, not an equality check — `install.sh` refuses anything *older* than
`0.2.1-rc.3` and lets a newer host through, because a future host is not something a floor
can adjudicate. What actually decides whether the bundle works there is, in order, the host's own
loader (the peers) and then the artifact's `disabled` expression — described next — not this gate.

**The supported set is exactly four host versions:**

| Host version | npm dist-tag | What you get |
|---|---|---|
| `0.2.1-rc.3` | `next` when the previous table was written; the tree the desktop app ships at the time of writing | supported — carried over from the previous set, and measured on its own facets (below) |
| `0.2.1-rc.4` | published between rc.3 and rc.5, no dist-tag of its own | supported — **byte-identical to rc.3**: same sha256 for both skeletons and every host `lib/index.js` this preset reads (below) |
| `0.2.1-rc.5` | `latest` at the time of writing | supported — **byte-identical to rc.3**, same evidence |
| `0.2.2-alpha.2` | `next` / `alpha` at the time of writing | supported — a **different structure**, not a different label: ten contract items read off it one at a time, and then mounted for real (below) |

Four versions, not a band: every one is named exactly, and the artifact's gate is a membership
test against that list rather than a semver range. That is on purpose — a range would also admit
whatever sits *between* two named versions, and what sits between them is precisely the thing
nobody measured. The three rc names are the clearest case: they are byte-identical, which is why
one set of measurements can back all three, and *not* a reason a `>=` would be safe — the same
range would also readmit `0.2.1-rc.2`, which has left the set.

Everything else is out of support **and not compatible** — not merely untested. That covers
every `0.2.1-alpha.*`, `0.2.1-rc.1`, `0.2.0-rc.2`, `0.2.1-rc.2` (it left the set when the floor
moved to rc.3), and anything newer than `0.2.2-alpha.2`. There is no
"probably fine" tier and no partial credit: four versions, and the boundary is a contract.

**Why rc.3 is on that list, and what "measured" means here.** The claim is not "rc.2 worked, so
rc.3 will". Four facts were read off a real `0.2.1-rc.3` install (2026-10-24): every official
plugin row the artifact names — twenty-two `@deepseek-ai/*` packages, `dsh-tool-schedule` and
the `dsh-tool-subagent-control/list-agents` subpath included — resolves at `0.2.1-rc.3`;
`dsh-tool-subagent@0.2.1-rc.3` still declares `agentPreset` / `allowedAgentPresets` and still
declares no `persona` (`lib/index.js:311-324`), which is the structural half of the gate; the
artifact loads through the host's own patch loader, which keeps all nineteen gate expressions
intact as expressions; and all nineteen evaluate **false** on that host, so the rows mount.
What this is **not** is a full session driven on rc.3 as the author's own working host: the
evidence is resolution, structure, and gate evaluation, and the README says so rather than
rounding it up.

**Why rc.4 and rc.5 are on that list: on every surface this bundle leans on, they *are* rc.3.**
The evidence is byte identity, not a second pass over the same facets — convenient, but it is
also the strongest form the evidence can take. The two skeletons (`dsh-base/cordis.patch.yml`,
`dsh-web-app/presets/standard.patch.yml`) and the seven host `lib/index.js` files this preset
reads (`dsh-tool-subagent`, `dsh-tools`, `dsh-agent-loop`, `dsh-agent-tool-presentation`,
`dsh-experimental-tool-agent-team`, `dsh-harness-dev-context`, `dsh-web-app`) have the same
sha256 on rc.3, rc.4 and rc.5. The manifests are **not** part of that identity and are not
claimed to be: their `package.json` files differ, and have to, because they carry the version
string and the lockstep dependency pins. The claim is exactly the one above — the code and
skeleton files this preset reads are identical. Byte
identical means identical line numbers and identical text, so three names rest on one set of
readings — which is exactly why the numbers quoted in this file are given once for "the rc.
line" rather than three times.

**Why alpha.2 is on that list: ten contract items were read off it, one at a time.** It is the
one member that is not the same file under a different name, so it was compared against the rc.
line item by item — the same ten items, one row per version, a line number for every cell. Most
of the difference is displacement: the `tool-subagent` reject loop, the three `dsh-tools` entry
points, the `fs-search` and `web` registration lines all moved. The substantive ones, and what
each costs this preset:

- `dsh-tools`' main class is `ToolsService`, not `ToolRuntime` — and the **service key is still
  `"tools"`**, so nothing that reads `ctx.tools` is affected.
- `modeFor(scope)` is gone, replaced by `selectExecutor(scope)` (`:624`). The rc. line has
  `modeFor` at `:2862` and no `selectExecutor` at all. The preset calls neither.
- `tools.mode` became `z.never()` (`:407`; on the rc. line it is
  `z.union(['native','ptc']).default('native')` at `:2763`), so writing `tools.mode` on alpha.2
  fails at schema validation rather than being ignored. The `mode` this bundle writes belongs to
  the `tool-presentation` row, not to `dsh-tools`, so it stays legal.
- `tool-subagent`'s `Config` swaps `modelSelectionSettings` for `modelSelection` +
  `modelDiscovery` (`:301-315` vs rc. `:311-324`), and an unknown key there is **silently
  dropped** rather than rejected. That is why the gate tests the version and not the `Config`
  shape. The bundle writes neither key.
- `PresetSelectionConfig.validate(ctx)` no longer exists, so a misconfigured `agentPreset` moves
  from a mount-time error to a runtime one. All nine lane rows carry one; it is a real behaviour
  difference, accepted with the version.
- `dsh-agent-tool-presentation` is `@deprecated` as a package (`:8`, `:19`, `:26`), and the base
  skeleton now mounts `tool-executor-native` (`:497`) and `tool-executor-ptc` (`:500`) itself.
  That is the one difference that bit this preset: the `tool-presentation` row would mount a
  native executor a second time, so it now carries a **structural** gate — see
  [One lane form, and why](#one-lane-form-and-why).
- `cordis` / `schemastery` sit on `4.0.6-alpha.1` / `3.18.6-alpha.1` rather than `4.0.5` /
  `3.18.5`, so the two peer entries name both generations instead of pinning one.

**And alpha.2 was not only read: it was mounted.** On an isolated `DSH_HOME` with the npm
`0.2.2-alpha.2` CLI, the bundle's rows composed and mounted, and the gate answered exactly as
this section says it would: all **nineteen** gated rows evaluated **`disabled: false`** — the
nine lane rows, the nine lane preset rows and the `subagent_fork` control row, because alpha.2
is inside the set. The `tool-presentation` row's **structural** gate evaluated **`true`**, so
that row is off and the host's own `tool-executor-native` (enabled) and `tool-executor-ptc`
(`disabled: true`) rows are the ones in the tree. A full scan of the boot log for `error`,
`warn`, `duplicate`, `already registered`, `EEXIST` and `conflict` returned **zero** lines — no
double registration, which is precisely what that structural gate exists to prevent. The web app
came up and served its root page: **HTTP 200, 38,581 bytes**.

**What that establishes, and what it does not.** Mounted and served is a real boot, not an
argument — but it is not a conversation: no agent session was driven on it, which needs a model
key and the runtime API route. So "the artifact mounts, gates and serves on alpha.2" is
measured; "a lane delegated a task on alpha.2" is neither proven nor disproven here. For rc.3,
rc.4 and rc.5 the evidence stays what it was — the rc.3 facet readings above, byte identity for
rc.4/rc.5, and the real boot on rc.2 kept as history in
[One lane form, and why](#one-lane-form-and-why) — no boot was re-driven on those three.

**What an unsupported host actually does.** The bundle's nine lane rows, its nine lane preset
rows and the `subagent_fork` control row all carry the **same** `disabled` expression — the same
text, the same polarity. It resolves the host's own `@deepseek-ai/dsh-tool-subagent`, walks up
to that package's `package.json`, reads `version`, and asks one question: **is this one of the
four?** Anything else — newer, older, or a different build — leaves the expression
**true**, and true means `disabled`:

| Host | What the nineteen gated rows do |
|---|---|
| `0.2.1-rc.3`, `0.2.1-rc.4`, `0.2.1-rc.5` or `0.2.2-alpha.2` | **mount** — the four hosts the artifact is built for |
| **every other version**: `0.2.0-rc.2`, `0.2.1-alpha.1` … `0.2.1-alpha.5`, `0.2.1-rc.1`, `0.2.1-rc.2` and anything not yet published | **nothing mounts.** In the default world the loader skips the bundle on the peers first, so none of the nineteen expressions is ever evaluated; **only after** a version exemption (`dsh plugin allow-version`) does this gate answer `true` and disable all nineteen rows |

So there are **four** supported hosts and **one** failure mode for everything else. The preset
mounts **nothing**: no lanes, no lane presets, no fork row, so there is no way to delegate at
all. It does not fall back to mounting lanes with no narrowing. The fork row matters here
specifically: it is the one row through which a child could be created *without* going through
a lane, so gating it is what makes "no delegation at all" true rather than merely "no named
lanes". This is what "retired, not compatible" means, and it is now **mechanically true** rather
than a documentation claim — the bundled gate and the prose agree by construction.

**Three barriers, in the order a host meets them: the peers at load, the gate at mount,
`install.sh` only if you use it.** It is worth being precise about which is which, because they
overlap and it is easy to mistake a written-down intention for an enforced one:

- The four `peerDependencies` are the **first** barrier, and they are **not** advisory: the host's
  loader skips the whole bundle when they do not cover its version (the line is quoted above, in
  [Installation](#installation)). npm ignores them — all four are `optional` — and that is
  precisely why it is easy to miss that the loader does not.
- The artifact's own `disabled` expression is the barrier at **mount** time. **When it is
  evaluated** — i.e. when the peers did cover the host, or when they were exempted by version — it
  reads the host at mount time and shuts every lane row off on any version outside the set. In the
  default world the loader has already skipped a bundle whose peers do not cover that host, so
  this gate never runs there at all.
- `install.sh`'s version gate refuses a host below the floor and reports a host above the floor
  but outside the set. It is real but **opt-in** —
  it only runs for someone who uses `install.sh`; installing by `npm install` or by hand-writing
  a `link:` dependency never executes it.

The versions inside those first two bullets: the two dsh packages enumerate the supported set
(`0.2.1-rc.3 || 0.2.1-rc.4 || 0.2.1-rc.5 || 0.2.2-alpha.2`); `cordis` and `schemastery` enumerate
the two generations the set straddles (`4.0.5 || 4.0.6-alpha.1`, `3.18.5 || 3.18.6-alpha.1`).

**One accepted edge, stated plainly.** The gate cannot always read a version. If the resolved
package has no readable `package.json` version — a renamed or missing manifest — it falls back
to the older structural test: does the `Config = z.object({…})` literal still declare
`persona:`? An old-contract host is still disabled on that path, but a **new-contract** host
with an unreadable manifest would mount. That is deliberate, and the reason is the direction of
the cost: failing closed on an unreadable host would take the lanes away from the *supported*
host in exactly the case where someone has a slightly unusual install, which is worse than the
residual it avoids. So the fallback is a **best-effort** net, not a second guarantee — do not
read the table above as airtight against a host whose manifest has been rewritten. The
structural fact it falls back to has not changed since `0.2.1-alpha.3` (historical measurement;
that version is out of support) — the release where `persona` left `Config`.

**That is the deliberate failure direction.** A host that can delegate nothing is a visible
problem — you notice immediately that delegation does not work, and the artifact is intact and
can be inspected. The thing it is chosen over is worse: nine lanes that mount on a host this
bundle was never measured against, carrying the Lead's full tool surface, with nothing in a
normal session looking wrong. When the choice is between a loud absence and a quiet over-grant,
the artifact fails loudly — on **every** version but the four, not just on the older ones.

The same expression fails closed when it cannot resolve the package at all, for the same reason:
an unreadable host is not a supported host. Note that this and the fallback in the paragraph
above are the same sentence seen from two sides — the gate errs toward `disabled` whenever it
cannot establish the version, and the only case where it does not is a new-contract host whose
manifest cannot be read.

**Two host trees can share one machine, and the gate reads the one that is running.** The
`disabled` expression resolves `@deepseek-ai/dsh-tool-subagent` from the host's own `baseUrl` —
the module URL the bundle is loaded with — so it does not ask "which version is installed
somewhere on this disk", it asks **which tree is running**. Two such trees can coexist without
either knowing about the other: the desktop app ships its runtime inside its own archive (an
asar), and an npm global install puts another one under the npm prefix. A workspace is tied to
neither. So the same machine, the same workspace, the same bundle, started two different ways, can
land on different sides — and which side you are on decides **where** the bundle stops, not
whether anything is reported:

- **Outside the set, default world.** The loader refuses the bundle at load time and says so in one
  line: `skipping profile bundle "@quill507/dsh-orchestrator-preset": … is incompatible with dsh
  <version> …` (quoted in full in [Installation](#installation)). Nothing is composed, so none of
  the nineteen expressions is ever evaluated.
- **Outside the set, after a version exemption** (`dsh plugin allow-version`). Now the bundle
  composes, and the gate answers `true` on all nineteen rows — the nine lanes disappear, and this
  step adds no second message of its own. That silence belongs to the **exempted** path only; it
  is not what a stock host sees.

Two read-only commands show which side you are on:

```sh
# 1. resolve the package the way a running host would, and print the version it would read
node -e "const {createRequire}=require('node:module');const r=createRequire((process.env.DSH_HOME||process.env.USERPROFILE+'/.dsh')+'/');const p=r.resolve('@deepseek-ai/dsh-tool-subagent/package.json');console.log(p, r(p).version)"

# 2. or ask the host itself: each gated row's `disabled` shows up in the composed tree
#    (as its `!!js` expression — the dump prints the source, not the boolean)
dsh --profile <name> --dump-config | grep -n 'disabled:'
```

The first command is only as good as the resolution root you hand it — that argument is the
whole point, and it is the same decision the gate makes internally. The second is the host's own
composed view, so it also shows which profile's layer did what, which row carries a gate at all,
and which host rows came in switched off; it needs `--profile <name>`
(the flag is required, there is no default) and it works for profile names the launcher can
compose — `desktop` is Electron-managed and refuses `--dump-config`, which is why
`tools/verify-install.sh` composes the tree through the host's own loader instead (see
[Verifying the install](#verifying-the-install)).

`install.sh --check` runs the version gate and writes nothing. It reports the floor, the
supported set, and which side of the set this host is on.

**Two keys did not survive the config check, and the preset no longer writes them.** They are
recorded here because both failed *silently*, which is the only interesting way for a config
key to fail — and because they are still the reason two keys are absent from the artifact on
every supported host:

| Key | Where it went | Why it is not a downgrade |
|---|---|---|
| `suffix: 'Your working directory is {{cwd}}.'` on the `persona` row | `{{cwd}}` was a registered prompt variable on rc.2 and alpha.1, and **is not one on alpha.2 or anything newer** (measured; see the note below), nor on any of the four supported versions. `dsh-system-prompt` throws on an unknown variable, so this was not a missing clause — it was a **hard failure during prompt assembly, before any model request**. Upstream now instructs users to delete the clause outright. The field itself — `suffix` in `dsh-persona`'s `Config` — is still there; it is the variable it referenced that is gone. | The directory is supplied by the `dsh-working-directory` service, which has been in the `dsh-base` skeleton since rc.2 and which alpha.2 exposes through the new `working_directory` tool. The suffix was redundant with it on every host measured, and with the variable gone it can only be empty. |
| `backgroundMode: continuable` on the ten subagent rows | alpha.2's `tool-subagent` `Config` no longer has the key at all (alpha.1's did), and it is absent on alpha.3 and alpha.4 too (measured; see the note below). schemastery does not reject unknown keys, so it became a dead key that nothing read. | Continuable is now a **provider capability**, not a row setting: `apply()` reads `subagentProvider.prepareContinuable`, and the spawn provider and the rc-line fork provider implement it — **read on the rc line; `0.2.2-alpha.2` was not read separately for `dsh-subagent-fork-in-process`**. The lanes keep their durable-id continuation. |

Both removals are safe on all four supported hosts, and that is the point: the clause-free
`persona` row and the `backgroundMode`-free lane row are legal there, whereas the old forms
were legal only on the older hosts this bundle no longer supports.
`tools/patch-contract.test.mjs` fails if `{{cwd}}` reappears in the artifact, so this one
cannot come back by accident.

**These two measurements are history, not a support claim.** They name alpha.1 and alpha.2
because that is where they were taken, and they are kept verbatim for that reason: they are
the evidence for two decisions that still hold — why the `persona` row is written without a
`suffix` (the field survives; the variable it referenced does not),
and why no `backgroundMode` is written. **Neither version is supported**, and neither is any
other `0.2.1-alpha.*`; the measurements explain the shape of the artifact, not the boundary
of support. The boundary is the table above.

### One lane form, and why

The artifact emits **one** lane form: an Agent Preset per lane, selected from the lane row by
`agentPreset`, with `allowedAgentPresets` naming that same id. There used to be two — a
legacy form that set `persona` and `toolFilter` directly on the subagent row, and this one —
rendered behind a host gate. That matrix is gone, because every supported host — the whole rc.
line (`0.2.1-rc.3`, `rc.4`, `rc.5`) and `0.2.2-alpha.2` — has neither key:
`dsh-tool-subagent`'s `Config` literal no
longer declares `persona` or `toolFilter`, and `apply()` **hard-throws** if either is present
(`lib/index.js`: rc. line `:355` / alpha.2 `:346` — the text is verbatim the same):

```
tool-subagent: persona is no longer supported; configure persona and tool plugins
in an Agent Preset and select it with agentPreset (spawn only)
```

That is a **per-entry activation failure, not a startup crash**: the session still starts, and
every affected row silently fails to activate. On every supported host there is no second form
to fall back to — the legacy keys are rejected at mount — so emitting one form is not a
simplification of convenience, it is the only shape that mounts.

Two hard requirements come with it, and they are written as a pair in the artifact:

| Requirement | Why |
|---|---|
| `allowedAgentPresets` must contain the `agentPreset` id | `dsh-tool-subagent/lib/index.js:209` throws `agentPreset must be included in allowedAgentPresets` at mount otherwise. The two keys must be written **as a pair**. |
| The `agent-presets` service must be mounted | `:357` throws `agent preset selection requires the agent-presets service` otherwise. Not every profile provides it. |

**Why there is a `lane-tool-gate` at all.** A preset's `plugins[]` can only **add** plugins;
there is no declarative way to subtract a host tool from a lane. So exclusion cannot be
expressed by the preset mechanism itself — it needs `tools.restrict()`, evaluated along the
calling agent's own scope chain. `lane-tool-gate.mjs` is that gate, mounted inside each lane's
preset.

It takes an **allow-list** (`official`) and computes the deny set itself: every name the
registry knows at that moment, minus the lane's `official`. Two consequences matter.

- **A lane sees only what it was granted.** `restrict()` removes the rest from the model's
  visible surface, exactly as the legacy `toolFilter.deny` did. A denied tool is not merely
  refused at call time; it is not there to be called.
- **Late registrations are still stripped.** The surface is recomputed on every
  `tools/change`, so a tool registered *after* a lane mounted (an MCP server, a third-party
  plugin) lands in the deny set on the next pass. Without that, a lane mounted before an MCP
  server would keep that server's tools forever — a silent permission grant rather than a
  visible failure. The recomputation is de-duplicated by the deny list itself, so
  `restrict()`'s own `tools/change` emission does not re-trigger it.

**Why an allow-list rather than a deny-list.** The bundle used to ship three static deny
lists (read-only / wright / forge) plus a per-machine "MCP closure" that computed the
`mcp_<server>` names from loader configuration. Both are gone. A deny-list has to enumerate
"the entire host tool surface minus what this lane should keep", and that surface drifts with
every deployment: MCP servers, third-party plugins, workbench extensions. The list can only
grow and stay incomplete — and an incomplete deny-list fails **silently**, because the
artifact looks perfectly normal with one name missing. An allow-list inverts the default:
anything not explicitly granted is denied, so a tool added by a new deployment cannot leak
into a lane that never asked for it. It is also safe against names that do not exist — a
grant does not require the tool to be registered, and a name absent from the registry can
never enter a computed deny set, so `restrict()` cannot throw on it.

That last property is why the shell names are handled the way they are. `bash` and `pwsh`
are **both** listed in `official` for the writable lanes, and **both** `tool-bash` and
`tool-pwsh` rows are mounted, each carrying the same `disabled` platform expression `topRows`
uses. Which one actually registers is decided at runtime by the platform, not by the build
machine; declaring both keeps the grant and the mount consistent on every platform. Mounting
only one of the pair leaves the lane with **no shell at all** on the other platform — a
silent capability gap that produces no error.

Each lane's `official` set is the single source for both halves: the gate's allow-list *and*
the official tool rows mounted in its preset are derived from the same array, so "declared
but not mounted" (a granted name that is not a real tool) and "mounted but not declared" (a
tool the gate immediately strips) cannot both stay invisible.

**Failure direction.** The `disabled` expression compares the host's `dsh-tool-subagent`
**version** against the supported set — falling back, only when the version cannot be read, to
whether the `Config = z.object({…})` literal still declares `persona:` — and it is checked in
both directions by `tools/patch-contract.test.mjs`. Its job has changed: it no
longer picks a form, it decides **whether anything mounts at all**. If it cannot resolve the
package, or cannot read the file, it evaluates to **true**, which disables every lane row and
every lane preset row. That is deliberate. Guessing "supported" on an unreadable host would
let the rows hard-mount on a host whose shape is unknown, and the failure mode would then
vary by host — a missing service throws, an extra key is silently swallowed. Mounting
nothing is the one outcome that cannot be mistaken for success.

**A second `disabled`, on a different axis — the `tool-presentation` row.** The lane rows are
gated by **version**, because their question is "is this a host we measured". The
`tool-presentation` row (`@deepseek-ai/dsh-agent-tool-presentation`, `mode: 'native'`) is gated
by **structure**, because its question is "does this host already own this layer". On
`0.2.2-alpha.2` the base skeleton mounts `tool-executor-native` (`:497`) and `tool-executor-ptc`
(`:500`) itself, and the presentation package's `apply()` now does nothing but
`ctx.plugin(<that executor>)` — so mounting the row there would register the native executor a
**second** time. The expression therefore resolves `@deepseek-ai/dsh-tool-executor-native` and
disables the row when it can. On the rc. line that package is not in the tree at all, so the row
keeps mounting exactly as before — where it is redundant (its `mode: 'native'` equals
`dsh-tools`' own default) but harmless. The asymmetry is stated rather than smoothed over: a
structural gate that failed **closed** would take a legal row away from the rc. line, so this one
fails **open** when the package cannot be resolved, and that residual is accepted.

**Verified on a real host, not only argued.** A real `dsh --profile web` boot on
`0.2.1-rc.2` mounts every lane row and reports no `persona is no longer supported`, no
`toolFilter is no longer supported` and no `Duplicate agent preset` — a measurement kept as
history, because rc.2 has since left the supported set. The probe itself was run
against the installed `dsh-tool-subagent` and returns **false** on that host, which is the
value that means "supported" — so the rows are enabled by the same fact that makes them
legal. On `0.2.1-rc.3` the same probe was run against the installed package and returns
**false** as well. On rc.4, rc.5 and alpha.2 the same membership test decides, over a version
string that was read off each of them; for rc.4 and rc.5 that string is read off the very same
files as rc.3. The boot was re-driven on none of rc.3, rc.4 and rc.5; on alpha.2 it was, on an
isolated home, and all nineteen gated rows evaluate enabled there. [Section
0](#0-host-version-gate) names exactly which facts each entry rests on.

### 1–4. Install

```sh
./install.sh                  # into $DSH_HOME, or ~/.dsh
DSH_HOME=/some/other/home ./install.sh
```

From a clone, that stages the bundle into `<DSH_HOME>/plugins/dsh-orchestrator-preset-bundle/`
and verifies the per-profile symlink. Nothing is copied into `~/.dsh/skills/`, and there is no
companion plugin: the four skills are served by the bundle's own provider, and the aegis prefix
bridge is mounted by a row the generator emits. Doing it by hand:

```sh
# 1. copy the bundle
cp -r . ~/.dsh/plugins/dsh-orchestrator-preset-bundle/

# 2. link it into a profile (see step 5 for the package.json line that makes this work)
#    and run `pnpm install` there — pnpm creates the symlink from the `link:` dependency.
#    Verify with test -L, never test -e: Git Bash can silently degrade a link into a
#    copy, and a copy passes test -e while freezing every later edit to the bundle.
test -L ~/.dsh/profiles/web/node_modules/@quill507/dsh-orchestrator-preset && echo "real symlink"

# 3. the four self-authored skills need NO install step — they ship inside the
#    bundle and are served by extensions/dsh/index.js, a filesystem skill provider
#    mounted by the generated patch with includeDefaultRoots:false. Nothing is
#    written to ~/.dsh/skills/.

# 4. nothing to install. The aegis prefix bridge ships inside the bundle as
#    extensions/dsh/aegis-prefix.js, mounted by a generated patch row with two
#    settings: prefixAegisSkills (default on) and describeAegisSkillsInZh
#    (default off, turned on in your own layer — see below).
```

**Nothing is copied into `~/.dsh/skills/`.** The four `orch-*` skills travel with the bundle
and a provider scoped to it serves them, so installing this preset adds nothing to your
global skills directory and removing it takes nothing away. That directory is where other
people's tools live; a preset that scatters copies into it inherits the mess without the
context. What this bundle ships is exactly what is in `skills/`, and `.gitignore` admits
those four paths one by one — a fifth cannot be added without saying so.

`describeAegisSkillsInZh` defaults to off because translating a catalogue is a reader
preference rather than a routing requirement.

**Set it in a patch layer. There is no settings-page control for it yet.** The home layer
`$DSH_HOME/cordis.patch.yml` applies after this bundle's, so a row there wins:

```yaml
- id: orch-aegis-prefix
  config:
    prefixAegisSkills: true
    describeAegisSkillsInZh: true
```

Restate **both** keys. A patch replaces a row's config rather than deep-merging it, so naming
only the one you are changing drops the other back to its default. A restart is needed either
way: the config is read when the plugin is applied.

### Why there is no control, and why one cannot be added

The host does build settings forms from plugin schemas, and this plugin's `Config` is written
the way that requires — `@deepseek-ai/schemastery` rather than `zod`, with both fields marked
`.volatile()`. That is not sufficient, which was measured rather than assumed:
`dsh-settings.describe()` only considers entries that `dsh-config-editor.entries()` returns,
and that filters to rows whose `parent.tree.ctx.fiber.entry?.id === "include"`. A row inserted
by a bundle patch is not one of those, so nothing here reaches the settings UI.

There is a second mechanism that *does* reach a patch-inserted row — the **Plugins page**
renders a row's own configuration, keyed `<package name>#<row id>`, and it does not consult
the `include` filter. What blocks the control is therefore not the row, it is the **browser
half**: the two switches need a client bundle, and **a preset's rows cannot serve one**.

MEASURED, host 0.2.0-rc.2 (historical measurement — that version is not supported; the
`PresetTree` constructor this describes is still present, unchanged in shape, on the supported
host): the client-bundle scanner (`@deepseek-ai/dsh-client-modules`)
walks the *root* loader tree, while a preset's rows are mounted into a detached
`PresetTree` of their own (`@deepseek-ai/dsh-agent-preset-registry`, `mountPreset()` →
`new PresetTree(ctx)` + `tree.root.update(...)`). `PresetTree` extends `EntryTree` but
deletes the owner's `subtree` pointer in its constructor, so its rows are reachable from
nothing the scanner enumerates. A `dsh.client` declaration in this package's manifest is
therefore never read, and the bundle is never served — the row simply never grows a
configure control. There is no public way around it: `ClientModuleRegistry` exports
`compose` / `bundleResource` / `onGraphChanged` and keeps its response map private, so
there is no supported registration door either. A UI would have to live in a **profile**
bundle (a separate package), not in this preset.

The settings form itself is not in doubt: on the `orch-debug` profile,
`POST /api/settings/describe` answers a namespace `orch-aegis-prefix` whose schema carries
both keys and whose value carries both stored booleans.

Editing without the UI still works, and is still supported: the home layer
`$DSH_HOME/cordis.patch.yml` applies after this bundle's, so a row there wins. Restate both
keys, because a patch replaces a row's config rather than deep-merging it.

**Client-page support is not planned; the limitation above is architectural.** The switches
are config-only, and this section is the place to look when wondering why.

### 5. Wire it into a profile

In `~/.dsh/profiles/<profile>/package.json`, add the dependency and the same string to
`dsh.profile.bundles`, keeping its position:

```json
"@quill507/dsh-orchestrator-preset": "link:<DSH_HOME>/plugins/dsh-orchestrator-preset-bundle"
```

then run `pnpm install` in that profile directory. In
`~/.dsh/profiles/<profile>/cordis.patch.yml`, select the preset:

```yaml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: standard
    selectedDefault: dsh-orchestrator-preset
```

**This is the registry row, and it has to be the whole row.** `selectedDefault` is a key of
`@deepseek-ai/dsh-agent-preset-registry` (`lib/index.js`: rc. line `:442-443` / `0.2.2-alpha.2`
`:446-447`; `defaultId` resolves `selectedDefault ?? default`), and that row is inserted by the
shipped `dsh-web-app` bundle — not
by this one. A patch **replaces the whole row** rather than deep-merging it, so its whole
`config` must be restated, `default` included: that key is `required` in the registry's schema,
and an override which omits it composes a registry row that no longer carries `default` at all.
Naming the bundle's
own `preset-dsh-orchestrator-preset` row instead — the earlier wording of this section — does not
*add* a key to anything: it **replaces** the preset definition, and the preset is gone. Measured
on a throwaway `DSH_HOME` with the `0.2.2-alpha.2` CLI: that form composes **1243** lines with
`preset-orch-lane` **0** times and `tool-presentation` **0** times, while the same profile without
it composes **2106** lines with all nine lane presets and every gated row present.

Both profiles must pin the **same released tag** of
aegis; desktop must not float.

`install.sh` deliberately stops before this step: those are the live installation's own
files, and `cordis.patch.yml` is watched by `dsh-hmr`, so writing it triggers an immediate
full re-assembly of the running host. The script prints the edits instead of making them —
and the selection snippet **it** prints is still the wrong-row form described above: the
script-side fix is in flight (another lane owns `install.sh`). Until the script you have prints
the registry row, apply the row above rather than pasting the printed one — and delete this
caveat once it does.

### 6. Install the aegis methodology pack

`aegis` is an upstream dependency, not something this repository ships. Install it through
the host, and pin the same released tag in both profiles.

**Turning aegis's automatic injection off, without losing the routing table.**

aegis arms a routing bootstrap for every session: one 4443-character block (with the default
`tdd_mode = "off"`), delivered once the session emits its first `tool/call` or
`assistant/message` and re-armed by `compaction/end`. It is one block of text for the
session's main agent — subagent sessions are skipped by design — while this preset routes by
domain and lane, so on this preset it is a second routing authority saying something else.
aegis gates it on a setting in its **own** config file, not in a DSH patch layer:

```toml
# ~/.config/aegis/config.toml
activation_mode = "explicit"
```

`explicit` makes `installBootstrap()` return `null` before it reads or builds anything, so
nothing is injected. `auto` — the default — is what arms it.

**This does not cost you the 22 routing rows.** The two are separate mechanisms in the same
plugin, and the skills provider is registered first and unconditionally: in aegis's own
`extensions/dsh/index.js`, `applyFilesystemProvider(...)` is lines 22–27 and the
`installBootstrap(ctx, …)` call is line 29. So all 23 skills still register, and the 22 names
`routing-sections.mjs` points at still resolve. Measured on this host: 23 provided, 22
referenced, nothing referenced that is not provided. `activation_mode` gates the injected
text and only that.

Two things to know before you edit it:

- **It is user-global, with no per-project granularity.** The path resolves from your home
  directory, so one edit reaches every workspace on both the `web` and `desktop` profiles.
- **`AEGIS_ACTIVATION_MODE` overrides the file, but only if it is already set when the host
  starts.** The value is read once, during plugin apply at boot, so exporting it in a shell
  afterwards changes nothing. Either way, restart the host.

---

## Troubleshooting

**A preset chosen in the GUI does not come back on its own.** The preset chooser persists
through the config editor, which rewrites the profile's own `cordis.patch.yml` in place. A
preset picked there overwrites `selectedDefault`, and nothing restores it. The bundle's own
patch is not touched — only the profile's. Re-apply the step 5 row to come back; there is
no state to reset.

**`cordis.yml` is empty, and that is correct.** The host defines the empty list as a literal
and rewrites it on every boot so that it stays empty; composed rows are written back into
it by the loader, which would otherwise duplicate every bundle insert on the next boot.
**Grepping `cordis.yml` can never tell you which preset is selected** — inspect
`cordis.patch.yml` instead.

**The bundle loads but its files are not found.** Check the symlink with `test -L`. A
directory that exists but is not a symlink is a copy, and a copy will not track later edits.

**A lane behaves as if it lost a shell tool.** The preset declares *both* shells —
`tool-bash` and `tool-pwsh` — each gated on `process.platform`, so on Windows the preset
asks for `pwsh` and off Windows for `bash`. A layer applied **after** the profile layer can
override that: the `~/.dsh/cordis.patch.yml` home layer is one such place, and a host set
up for bash-only on Windows will force `tool-bash: disabled: false` and
`tool-pwsh: disabled: true` there. That is a **deployment fact, not a defect** — the
preset does not require `pwsh`, and a disabled tool is still a known tool, so the lanes
dispatch and work normally on bash alone. If a lane looks like it has lost its shell,
check your own home or profile layer before suspecting the preset: the home layer wins,
and it wins silently. Note that no shell name is derived from those effective values any
more: every writable lane's `official` lists **both** `bash` and `pwsh` unconditionally, and
both rows are mounted in its preset, so a deployment override changes which one *registers*
— never which ones a lane is *granted*. This preset changes no tool row, filter or persona
to accommodate any particular shell arrangement.

**The persona prefix is empty.** `plan-aware-persona` fails loud on a missing or empty
persona file rather than silently stripping the agent's identity. Read the error: it names
the file.

---

## Verifying the install

```sh
./tools/verify-install.sh            # checks the "desktop" profile
./tools/verify-install.sh web
```

Is the preset really installed, and is it really the one selected? Thirteen checks, plain
`PASS`/`FAIL` lines and a summary, exit non-zero if anything fails. It is **read-only**: it
composes the profile tree in memory and never writes to a DSH home — check 5 asserts that
rather than assuming it.

| # | What it checks |
|---|---|
| 1 | the profile patch selects this preset, exactly once |
| 2 | the bundle link is a **real symlink** — `test -L`, never `test -e`, because a link silently degraded into a copy still passes `test -e` |
| 3 | the bundle is **readable through the link**, and the target's `package.json` `name` is this repository's own — present is not the same as usable |
| 4 | the patch generator is in sync, run with **`DSH_HOME` unset** |
| 5 | the **composed** tree really selects this preset, with no occurrence of the pre-rename name, and the preset row present |
| 6 | the four `orch-*` skills are installed, and the four retired unprefixed names are gone as directories |
| 7 | the two shell rows read as this host deliberately configured them |
| 8 | leak gate over the **working tree** — no machine-local absolute path by shape, and no third-party skill name or private-data token outside `docs/`; the name rule needs a local uncommitted `tools/leak-needles.local.txt`, and when that file is absent it prints a `WARN` saying the name rules did not run while this check's line still reports `PASS` |
| 9 | every `aegis-*` target in the routing table resolves to a skill the installed pack actually provides — a dangling row fails silently |
| 10 | the zh description table still matches the installed pack — a stale key fails silently |
| 11 | no client-bundle declaration has come back into this package — dead by construction, so absence is the only thing a gate can assert |
| 12 | what npm would publish is still what `package.json`'s `files` says — a directory entry ships the **working tree**, not the tracked set |
| 13 | the lane deny lists name no tool that only **this** machine is guaranteed to have — a name this machine lacks breaks the lane on the next one |

**Check 4 runs with `DSH_HOME` unset on purpose.** The generator resolves its skeleton
from `$DSH_HOME` and falls back to `~/.dsh`, so a shell that happens to export the variable
resolves fine while a plain one did not — and that read as "the tool is broken". The tool
was since repaired to fall back, so this proves it rather than assuming it.

**Check 5 composes the tree instead of reading `cordis.yml`,** because `cordis.yml` cannot
answer the question: it is a four-line empty root the host rewrites on every launch, so it
structurally cannot contain those rows and anything dumped into it dies at the next boot.
`dsh --profile <name> --dump-config` is also unavailable — the launcher refuses it outright
for an Electron-managed profile such as `desktop`. So the script calls the host's own
read-only loader, skips the step that rewrites `cordis.yml`, and greps the composed output.

---

## Dependencies

This bundle has no runtime npm dependencies. It imports `@deepseek-ai/dsh-tools` (for
`defineTool`, in `lane-composition.mjs`) and nothing else from the npm ecosystem; that
package is provided by the **host**, which is why it is neither a `dependency` nor a
`peerDependency` here.

The persona files are resolved by deep path at runtime
(`createRequire(baseUrl).resolve('@quill507/dsh-orchestrator-preset/personas/scout.md')`).
`baseUrl` is injected by the host, so resolution is independent of where the bundle is
installed. Those deep paths are served by an explicit `exports` map in `package.json`
(**19** subpaths: the four `.mjs` plugins, the ten persona `.md` files, `cordis.patch.yml`,
the two `extensions/dsh/*.js` entries, `locale/*.json` and `package.json`), so they resolve
through a declared door rather than through Node's legacy no-exports behaviour. Adding a new
resolvable file means adding it to `exports` as well — a deep path that is not listed there
will fail to resolve even though the file is on disk.

---

## Publishing to npm

**This has been done.** The package is published as `@quill507/dsh-orchestrator-preset`.
npm and the GitHub release page are the authority for which versions are out; this file keeps
no copy of that fact, because a copy here goes stale on every release. The runtime specifier is
the npm name — the `@local/` alias is no longer used for this bundle.

- **The one line that owns every specifier** is `tools/preset-declaration.mjs:45`,
  `export const bundlePkg = '@quill507/dsh-orchestrator-preset'`. That single constant owns
  all **15** specifier references in the generated `cordis.patch.yml`. Measured with
  `grep -o '@quill507/dsh-orchestrator-preset/[A-Za-z0-9._/-]*' cordis.patch.yml | sed 's|@quill507/dsh-orchestrator-preset/||' | sort -u`,
  which returns 15 distinct paths: **4 `.mjs`** (`lane-composition.mjs`,
  `plan-aware-persona.mjs`, `routing-sections.mjs`, `lane-tool-gate.mjs`), **2 `.js`**
  (`extensions/dsh/index.js`, `extensions/dsh/aegis-prefix.js`) and **9 persona `.md`**. Change that one line, then run
  `node tools/gen-cordis-patch.mjs` — no other edit is needed, and no persona file is
  affected. (`personas/orchestrator.md` is inlined rather than file-resolved, so it is
  correctly absent from that list.)
- **One thing beyond that remains unsolved**: the four skills under `skills/` are plain
  Markdown with no npm story and would need a postinstall step to copy them into a profile's
  skills directory. This matters more now that the package is on the registry, because an
  npm install delivers the Markdown without placing it anywhere a profile reads. The
  `exports` map and the second-package question are both settled — the map exists, and the
  companion plugin was folded into `extensions/dsh/aegis-prefix.js` rather than shipped as
  its own package.
- **The published package and a profile's local projection share one name**, because both
  are `@quill507/dsh-orchestrator-preset`. Nothing distinguishes them by name; the only
  difference is the target each resolves to — a profile's `node_modules` symlink points at
  the locally staged bundle, while the registry copy is a real tarball. This is the exact
  concern recorded in `tools/verify-install.sh:96-105`, where the original design kept the
  keys distinct (`@local/…` versus the npm name) so that a resolver returning the published
  package instead of the local projection could not happen silently. Unifying on the npm
  name is a **deliberate, user-approved exception** to that rule; the cost it accepts is
  recorded next to that comment. A reader should not take the shared name for a coincidence.

### The skill-provider architecture — adopted, deliberately not built

**This is not implemented and not tested.** It is recorded because the owner adopted it as
the approach for a *later* round, and because it changes two of the items above.

The approach: **mount a plugin that calls `apply()` from `@deepseek-ai/dsh-skill-filesystem`**,
configured with `includeDefaultRoots: false` and `bundledSkillDir` pointing at the package's
own `skills/` tree. It is the same roughly 12-line shape aegis uses for its own bundled
skills. The package is already resolvable from this bundle with **zero new dependencies**,
and it exports `apply`, `FileSystemSkillProvider` and `Config` — so the entry point is
already there; what is missing is the call site and the registration.

**What it would delete:**

- **Install step 3 disappears.** Copying the four skills into the global `~/.dsh/skills/`
  is no longer needed, because the provider serves them from inside the package. That also
  removes the "copy one directory at a time, never the whole tree" hazard for users.
- **npm todo item 5 disappears with it** — the postinstall skill-copying step is the very
  thing this architecture exists to avoid, so that item should be struck from the list
  above rather than solved.

**What it would cost, and why that is why it is deferred:**

- **It changes the generated `cordis.patch.yml`.** A new plugin row has to be declared, so
  the patch is regenerated and its current verified md5 — `ba04ddbeb2eaa82bcb9f6d2df00fc219`
  — stops being the expected value. Anything that pins that digest has to be updated with it.
- The regeneration has to be done for real and re-verified against a host, not reasoned
  about: the same generator that reproduces today's patch byte-for-byte is the thing that
  would produce the new one, and a skill-provider row that fails to mount would remove the
  four skills at runtime rather than at install time.

Doing it now would mean shipping a change to the running installation's skill surface for a
benefit nobody has asked for yet. Deferring costs nothing but a stale `cordis.patch.yml`
digest.

---

## License

MIT — see [`LICENSE`](./LICENSE).

## Acknowledgements

This preset is mostly other people's work arranged in a particular way, and it is worth
saying whose.

**[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — the host this
runs inside, MIT-licensed. The configuration rows in `cordis.patch.yml` are derived from
it, the bundle/patch model this project is built on is its design, and its own first-party
bundles (`dsh-web-app`, `dsh-base`) are the reference implementations the architecture here
was read off. Several findings recorded in this README — that composing a profile rewrites
its `cordis.yml`, that a filesystem skill provider can be pointed at an arbitrary tree —
are the host's documented behaviour, measured rather than guessed.

**[aegis](https://github.com/GanyuanRan/Aegis)** — the methodology pack this preset routes
into, by Jesse Vincent and Ganyuan Ran. It owns the method: the routing discipline, the
skill-per-situation idea, the pressure-testing and verification habits. This project
supplies the orchestration layer around it and consumes aegis at runtime without vendoring
a line of its text. Its `extensions/dsh/index.js` was also the working reference for the
provider mounted here — twelve lines that made the skills-in-the-bundle design obviously
correct before it was tried.

**[itamzxm](https://github.com/itamzxm)** — author of **Auto-Pilot**, a set of seven skills
written to work across agent environments other than this one, rather than for any single
host. They are bare skill directories with no package manifest, which is why nothing here was
a candidate to install: Auto-Pilot was read as a source of mechanisms, not adopted as a
component. Six groups of its mechanisms are borrowed here by mechanism rather than by text —
its memory model, its convening gate and convergence states, its bare-run test and delegation
letter, its four scheduling rules, and its search and goal criteria. Auto-Pilot is not
published and carries no licence, and none of its text appears in this repository; where a
mechanism came from it, this repository's own design history names which one rather than
restating it.

**[Tacrine](https://github.com/Tacrine)** — who ported the oh-my-openagent agent set to
DeepSeek Harness and modified it, before this repository existed. The ten personas here
began as that port's output.

**oh-my-openagent** ([code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent))
— the upstream those personas ultimately descend from, and its author **code-yeongyu**. That
project is not open source, and no text from it is distributed here: every persona in this
repository has since been rewritten against an explicit threshold — under 2% n-gram overlap
with the upstream agent sources, and no run of six consecutive matching lines.
`tools/audit-personas.mjs` is that threshold, made runnable. Its term-probe half runs
anywhere; the overlap half needs the upstream corpus, which is deliberately not included, so
the rewrite is **partial evidence rather than a verified claim** — the tool reports it as
unverified, not as a pass, because those are different things.

**The authors of the packages this was tested against** — `@deepseek-ai/schemastery`, and the DSH packages that
supply `dsh-tools`, `dsh-skill-filesystem` and `dsh-home-paths`. Nothing here would load
without them, and none of them are dependencies of this package: the host supplies them at
runtime, which is precisely why this bundle declares no runtime dependencies of its own.

And a note on what is **not** acknowledged here: the tooling used to build this — a
language model working through a long session — is not a source of the design. The mistakes
in it are catalogued in this repository's own history rather than smoothed away, and the
distinction between what was measured and what was assumed is marked throughout.

## Third-party attribution

The formal record — what is in this repository from somewhere else, and what is deliberately
not in it — is [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). It is kept in its own
file rather than appended to `LICENSE`, because an appended block makes GitHub's licence
detector report "Other" for a file that is plainly MIT, and because a fact with two homes has
no home.

Two points from it are worth stating here, since they affect what you may do with this code:
the `aegis` pack is consumed at runtime and **not vendored**, and the third-party skills on
any given machine are **not redistributed** — some carry no licence at all, which makes
redistributing them a violation rather than an oversight.
