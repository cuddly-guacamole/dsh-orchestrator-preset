<div align="center">

# @quill507/dsh-orchestrator-preset

**A thin-shell agent preset for DeepSeek Harness**

*The aegis method pack for methodology · a self-authored orchestration layer for delegation*

[![npm](https://img.shields.io/npm/v/@quill507%2Fdsh-orchestrator-preset?style=flat-square&label=npm&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
[![downloads](https://img.shields.io/npm/dm/@quill507%2Fdsh-orchestrator-preset?style=flat-square&labelColor=454a54)](https://www.npmjs.com/package/@quill507/dsh-orchestrator-preset)
![DSH](https://img.shields.io/badge/DSH-0.2.0--rc.2%20%7C%200.2.1--alpha.3%20%7C%200.2.1--alpha.4-4c6ef5?style=flat-square&labelColor=454a54)
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
`reader`, `analyst`, `auditor`, `wright`, `forge`. Each carries its own persona file and
its own `toolFilter`, so a lane's capability boundary is **declarative, not advisory** — a
read-only lane's `deny` list removes `write`, `edit`, `todo_write`, every other lane's
dispatch tool, and the lead-side child-addressing tools from its seat. The deny lists are
what keep a lane from re-entering the coordinator role.

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

| Claim | Status |
|---|---|
| A bundle declares a patch via the `dsh.bundle.patch` field in its `package.json`, e.g. `"patch": "./cordis.patch.yml"`. | **Upstream contract.** Verbatim in the published `@deepseek-ai/dsh-base` manifest, which also exports the patch as a subpath. |
| Later patch layers win, and a patch **replaces the whole row** rather than deep-merging it — so a row overriding `config` must restate every key it needs. | **Corroborated twice, independently.** |
| Exact layer order: bundle patches in `dsh.profile.bundles` order, then the profile's own `cordis.patch.yml`, then `$DSH_HOME/cordis.patch.yml`, then each `--patch` overlay. | **Verified on host version 0.2.0-rc.1.** Not confirmed against upstream documentation. |
| A profile lives at `~/.dsh/profiles/<name>/` containing `cordis.yml`, `cordis.patch.yml` and `package.json`. | **Verified on host version 0.2.0-rc.1.** Not confirmed against upstream documentation. |
| `config.selectedDefault` is in the preset schema and is the effective value; the schema also carries `config.default`, and `defaultId` resolves `selectedDefault ?? default`. | **Verified on host version 0.2.0-rc.1**, against `@deepseek-ai/dsh-agent-preset-registry`. |
| `{{cwd}}` is a registered prompt variable; an unknown `{{…}}` reference throws during assembly. | **Version-dependent, and measured on each version.** Registered on `0.2.0-rc.2` (`dsh-agent-loop` registers `provider`/`model`/`cwd`), **absent from `0.2.1-alpha.2` onward** (only `provider`/`model` — re-checked on the installed `0.2.1-alpha.4`). Reproduced against the installed host's own `renderPrompt`: `unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`. Upstream `dsh-system-prompt/README.md` now tells users to remove the clause. This is why the `persona` row carries no `suffix` on **any** supported version — see [Host version gate](#0-host-version-gate). |
| `tool-subagent`'s `Config` accepts `backgroundMode`. | **Version-dependent.** Present on `0.2.1-alpha.1` (`lib/index.js:257`), **absent from `0.2.1-alpha.2` onward**. schemastery tolerates the unknown key, so the removal is silent — verified by feeding both forms through the installed schema. Continuable is now decided by the provider's `prepareContinuable`, implemented by both the spawn and fork providers on every supported version (re-checked on the installed `0.2.1-alpha.4`). The lane rows therefore write no `backgroundMode` at all. |
| The `standard` preset skeleton is the authority for which rows exist. | **Verified on each version.** It shrank from 162 lines (`0.2.0-rc.2`, `0.2.1-alpha.1`) to 137 (`0.2.1-alpha.2`), dropping `tool-ralph`, `tool-subagent-codex` and `tool-subagent-claude-code`; `tool-schedule` was added — **on alpha.1, not on rc.2**. Re-measured on the installed `0.2.1-alpha.4`: 128 lines, still carrying `time-context` and `tool-schedule`, still without the three dropped rows. |
| `@deepseek-ai/dsh-tool-schedule` exists on every supported host. | **False, and it is the reason this preset's only version-gated row exists.** npm publishes it at `0.0.1-rc.2` (a different generation) and at `0.2.1-alpha.1` … `0.2.1-alpha.4` — there is **no `0.2.0-rc.2`**. `dsh@0.2.0-rc.2` does not depend on it, none of its app packages do, and rc.2's skeleton has no such row; rc.2's reminder tools are the *optional, off-by-default* `dsh-experimental-schedule-bundle`, which inserts `time-context`/`schedule`/`ui-schedule` and **not** `tool-schedule`. |
| A lane `toolFilter.deny` naming a tool the host does not register fails loudly at delegation, not at mount. | **Verified on `0.2.0-rc.2` and `0.2.1-alpha.2`, identical behaviour.** `tools.restrict()` throws `names unknown global tool` (`dsh-tools/lib/index.js:2895-2908`), and `dsh-subagent` calls it unguarded when a child is composed (`lib/index.js:401`) — so a hardcoded `schedule_*` deny list would break **every lane delegation** on `latest`. This still holds on `0.2.1-alpha.3`/`alpha.4`, where it is the reason the legacy branch's deny tail stays conditional. |
| `tool-subagent`'s row `Config` still accepts `persona` and `toolFilter`. | **False from `0.2.1-alpha.3` onward, and this is the second version-gated mechanism.** `dsh-tool-subagent/lib/index.js:311` no longer declares either key, and `:355` hard-throws on both at mount. The bundle therefore ships **two lane forms** behind one host gate — see [The alpha.3 lane migration](#the-alpha3-lane-migration). |
| An Agent Preset can express a tool **exclusion**. | **False, and it is why the bundle ships `lane-tool-gate.mjs`.** A preset's `plugins[]` can only ADD. Measured on `0.2.1-alpha.3`: a persona-only preset gave the child **25** tools including `edit`/`bash`/`send_message`/`interrupt_agent`, and marking `tool-bash` `disabled: true` inside the preset left `bash` present (23 tools). `toolFilter` is also unreachable on that path: fresh dispatch sends `composition: { agentPreset }` only (`dsh-subagent/lib/index.js:1452`), and the single consumer at `:395` reads the field the **resume** path restores from a persisted descriptor (`:2177`). |

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
| `lane-tool-gate.mjs` | **New on `0.2.1-alpha.3`.** The lane tool gate: `tools.guard()`, mounted inside each lane's Agent Preset, because a preset cannot express a tool exclusion. See [The alpha.3 lane migration](#the-alpha3-lane-migration). |
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
as `@quill507/dsh-orchestrator-preset` (current version `0.1.6`, the `latest` dist-tag).
`package.json` carries **no** `"private"` key. A profile projects the bundle under **the same
name** the registry publishes it under, so a local projection and the published package are
told apart by **where they point**, not by their names — see
[Publishing to npm](#publishing-to-npm) for what that costs and why it was accepted.
The package declares **no** `dependencies` — the host supplies everything at runtime. It does
declare `peerDependencies`, all four marked `optional`, so that what it was tested against is
written down without any install being able to fail over it:

| Package | Range | Why |
|---|---|---|
| `@deepseek-ai/dsh-skill-filesystem` | `>=0.2.0-rc.2 <2` | the provider this bundle mounts |
| `@deepseek-ai/dsh-tools` | `>=0.2.0-rc.2 <2` | `defineTool`, used by `lane-composition.mjs` |
| `@deepseek-ai/cordis` | `>=4.0.1 <5` | the plugin contract; a real major boundary |
| `@deepseek-ai/schemastery` | `>=3.18.0 <4` | the `Config` schema the settings card is built from |

The lower bounds name **the oldest host version this is supported on** — 0.2.0-rc.2, which is
also what `latest` still resolves to — not an earlier one the design happened to reference,
and not the newest, because the preset is supported on `0.2.1-alpha.3` **and `0.2.1-alpha.4`**
too (see [Host version gate](#0-host-version-gate)). The upper bounds follow the convention the
published `@quill507/dsh-auto-approval-llm` uses on the same host packages. `optional: true` is
what keeps the declaration honest: the coupling here is deep — `ctx.skills.registerProvider` is
a host API — so a major change could break this silently, and saying so is worth more than
pretending the range is enforced. It is not.

**The supported set is three versions, and that is a measured claim, not a copied one.** Each
was checked against its own published tarball rather than assumed to follow from its neighbour.
Two host releases broke something this preset relied on, and they broke it in two different
ways — which is the whole reason the artifact now has a gate in it:

- **`0.2.1-alpha.2` removed two keys.** `{{cwd}}` stopped being a registered prompt variable,
  and `backgroundMode` disappeared from `tool-subagent`'s `Config`. Both removals were
  *absorbable*: the preset stopped writing either one, and the resulting `persona` row and lane
  row are legal on **every** supported version. One form, three hosts.
- **`0.2.1-alpha.3` removed the mechanism, not a key.** `persona` and `toolFilter` left
  `tool-subagent`'s row `Config` entirely, and `apply()` now hard-throws if either is present.
  That one is **not** absorbable: the replacement (an Agent Preset) does not exist before
  alpha.3, and it cannot express a tool *exclusion* at all. So the lane rows ship in **two
  forms behind one host gate**, and the new form carries a self-authored gate plugin. See
  [The alpha.3 lane migration](#the-alpha3-lane-migration).

Nothing that differs between the three versions is silently tolerated (see
[Sourcing](#sourcing-what-is-upstream-what-was-measured-here)), because a preset that is only
correct on its newest host is not supported on the other two — and a preset that is only
correct on its newest host *while appearing to load* is worse than one that fails.

One **capability** is host-gated instead of uniform, and it is worth knowing which: the Lead's
durable reminders (`schedule_create` / `schedule_list` / `schedule_update` / `schedule_delete`)
come from `@deepseek-ai/dsh-tool-schedule`, which **does not exist on `0.2.0-rc.2`**. The row
that mounts it is therefore declared with a `disabled` expression that asks the host whether
that package resolves; the lanes' deny tail asks the same question and adds the four names only
where they exist. On `0.2.0-rc.2` the preset behaves exactly as 0.1.5 did — the capability is
simply absent there, because it is absent from that host. On the two alpha hosts the Lead has
the reminders, and **no delegated child does**: the nine named lanes deny them, and so does the
`subagent_fork` control row (a forked child is a child too — the same shape the host's own
`standard` preset uses on both of its subagent rows). This gate is older than the lane
migration and independent of it: it survives on all three supported versions, and on
`0.2.0-rc.2` it is the only reason the reminder row and the lanes' deny tail are conditional.
It is not the only gate in the artifact any more — the lane form has one of its own, described
in the next section. The two ask different questions and must not be conflated.
`tools/verify-install.sh`'s check 13 simulates the host without the package and fails if those
names appear on it, so this cannot regress quietly.

### 0. Host version gate

```sh
dsh --version          # install.sh refuses below 0.1.7-rc.1
```

This is a hard check inside `install.sh`, and it is deliberately **looser** than the
`peerDependencies` above: 0.1.7-rc.1 is the version the design was written against, and it is
the floor for installing at all — not a claim of support. The honest "untested" band the old
wording described, the stretch between the design version and the first version actually
exercised, is closed from the top; it is no longer a gap you can fall into by installing the
current release.

**The supported set is exactly three host versions:**

| Host version | npm dist-tag | What you get |
|---|---|---|
| `0.2.0-rc.2` | `latest` (also `next`) | what a plain `npm i -g @deepseek-ai/dsh` installs, and the runtime the Desktop app bundles |
| `0.2.1-alpha.3` | — | superseded on the `alpha` tag; install it by exact version |
| `0.2.1-alpha.4` | `alpha` | the newest release; **not** on `latest` — ask for the tag explicitly |

`0.2.1-alpha.1` and `0.2.1-alpha.2` are **no longer in the supported set**. They are not
broken — they belong to the legacy lane branch and keep working — but they are not tested here
any more, and the badge above lists the three that are.

The `alpha` tag has moved three times, alpha.1 → alpha.2 → alpha.3 → alpha.4, so the table
keeps a row for a version no tag points at any more: `0.2.1-alpha.3` is the version that
introduced the lane migration, and it is the one worth being able to install deliberately.
None of the three is the single "current" release.

Support is not a guess. Every config key this preset hands to a host package — checked
field-by-field against all three published versions, not inferred — exists on each with the
same type, the same default and the same schema shape, and `plan-mode` rejects unknown keys on
all three, so the declared `section` text cannot be silently dropped by a schema that tolerates
stray keys. `install.sh --check` runs the version gate and writes nothing.

**Two keys did not survive that check, and the preset no longer writes them.** They are worth
naming because both failed *silently*, which is the only interesting way for a config key to
fail:

| Key | Where it went | Why it is not a downgrade |
|---|---|---|
| `suffix: 'Your working directory is {{cwd}}.'` on the `persona` row | `{{cwd}}` was a registered prompt variable on rc.2 and alpha.1, and **is not one on alpha.2 or anything newer**. `dsh-system-prompt` throws on an unknown variable, so this was not a missing clause — it was a **hard failure during prompt assembly, before any model request**. Upstream now instructs users to delete the clause outright. | The directory is supplied by the `dsh-working-directory` service, which has been in the `dsh-base` skeleton since rc.2 and which alpha.2 exposes through the new `working_directory` tool. The suffix was redundant with it on every version. |
| `backgroundMode: continuable` on the ten subagent rows | alpha.2's `tool-subagent` `Config` no longer has the key at all (alpha.1's did), and it is absent on alpha.3 and alpha.4 too. schemastery does not reject unknown keys, so it became a dead key that nothing read. | Continuable is now a **provider capability**, not a row setting: `apply()` reads `subagentProvider.prepareContinuable`, and both the spawn and fork providers implement it on every supported version. The lanes keep their durable-id continuation. |

Both removals are safe on all three versions, which is the point: the clause-free `persona` row
and the `backgroundMode`-free lane row are legal everywhere, whereas the old forms were legal
only on the older hosts. `tools/patch-contract.test.mjs` now fails if `{{cwd}}` reappears in the
artifact, so this one cannot come back by accident.

The measurements above name alpha.1 and alpha.2 because that is where they were taken, and they
are kept verbatim for that reason: they are the evidence for two decisions that still stand on
every supported version. Neither version is supported any more — see the table above.

### The alpha.3 lane migration

`0.2.1-alpha.3` did not remove a config key. It removed the **mechanism** a lane used to declare
its own persona and tool surface, and replaced it with one that cannot express the same thing.
This section is the contract, not the history: it is what the artifact looks like on the two
alpha hosts, and why.

**What changed.** `persona` and `toolFilter` are gone from `dsh-tool-subagent`'s row `Config`
(`dsh-tool-subagent/lib/index.js:311` no longer declares either), and `apply()` hard-throws on
both (`:355`):

```
tool-subagent: persona is no longer supported; configure persona and tool plugins
in an Agent Preset and select it with agentPreset (spawn only)
```

That is a **per-entry activation failure, not a startup crash**: the session still starts, and
every affected lane silently fails to activate. On a host where the bundle still wrote the old
form, all nine lanes would be dead at once while the session looked healthy.

**What replaced it.** Each lane's persona and tool surface now live in an **Agent Preset**,
selected from the lane row by `agentPreset`. That brings two hard requirements with it:

| Requirement | Why |
|---|---|
| `allowedAgentPresets` must contain the `agentPreset` id | `dsh-tool-subagent/lib/index.js:209` throws `agentPreset must be included in allowedAgentPresets` at mount otherwise. The two keys must be written **as a pair**. |
| The `agent-presets` service must be mounted | `:357` throws `agent preset selection requires the agent-presets service` otherwise. Not every profile provides it. |

**Why there are two lane forms.** The preset mechanism does not exist before alpha.3, and the
row-config mechanism is rejected from alpha.3 onward. There is no single row shape that is legal
on both, so `tools/gen-cordis-patch.mjs` renders each lane in **two forms behind one host gate**
and `tools/preset-declaration.mjs` declares both:

| | Legacy form (`0.2.0-rc.2`) | New form (`0.2.1-alpha.3`, `0.2.1-alpha.4`) |
|---|---|---|
| Gate reads | `Config = z.object({…})` **contains** `persona:` | it **does not** |
| Persona | `persona: !!js …` on the lane row | a `@deepseek-ai/dsh-persona` plugin inside the lane's preset |
| Tool narrowing | `toolFilter.deny` / `.allow` on the lane row | `lane-tool-gate.mjs` inside the lane's preset |
| Narrowing reaches the child via | `tools.restrict()`, called by `dsh-subagent` | `tools.guard()`, evaluated along the calling agent's scope chain |

The gate is a **structural fact, not a text guess**: it reads whether the `Config` object literal
declares `persona:`. The two obvious alternatives were measured and rejected — probing the schema
always answers "supported", because schemastery accepts unknown keys and only `apply()` throws;
matching the throw's wording is fragile against an upstream reword. The gate is checked in both
directions by `tools/patch-contract.test.mjs`.

**Failure direction.** If the gate cannot resolve `@deepseek-ai/dsh-tool-subagent` at all, it
evaluates to **legacy**. That is deliberate: the legacy form fails **loudly** on a new host (the
lanes do not activate, and the host says why), whereas guessing the new form on a host that has
no preset mechanism would leave the lanes composed with **no narrowing at all** — a silent grant
of write access. A loud failure is the direction to fail in.

**Two known degradations, stated plainly.** The new form is not an equivalent replacement for
the old one. Both of these are deliberate, accepted, and visible in the artifact:

- **`reader`'s allow-list has no equivalent.** `tools.guard()` is deny-only — there is no
  `allow`. The old form gave the `reader` lane `allow: ['read', 'read_image']`, meaning "keep
  only these". The new form can only enumerate names to refuse, and that list would have to be
  the entire host tool surface minus two, which drifts with every host release. So on alpha.3
  and alpha.4 the `reader` lane's gate blocks only the lane-addressing names, and its **general
  tool surface is wider than it was on the legacy hosts**. The addressing names *are* blocked
  unconditionally (`LANE_ADDRESSING_DENY`), because the old allow-list excluded them by
  construction and letting them through would be a grant, not a degradation.
- **The gate hides nothing.** The new form's gate keeps a denied tool **visible and refuses it
  at call time**, with a readable reason. The legacy `restrict({deny})` **removed it from the
  visible surface** instead. This is not a like-for-like swap: a lane on alpha.3+ can see a tool
  it may not use. It is the strongest means alpha.3+ offers — a preset's `plugins[]` can only
  ADD plugins, so there is no declarative way to exclude a host tool at all.

The two forms are gated by one expression and asserted on both sides, so neither can regress
into the other's host silently.


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

MEASURED, host 0.2.0-rc.2: the client-bundle scanner (`@deepseek-ai/dsh-client-modules`)
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
- id: preset-dsh-orchestrator-preset
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    selectedDefault: dsh-orchestrator-preset
```

A patch replaces the whole row rather than deep-merging it, so that snippet is the whole
row, not an addition to a larger one. Both profiles must pin the **same released tag** of
aegis; desktop must not float.

`install.sh` deliberately stops before this step: those are the live installation's own
files, and `cordis.patch.yml` is watched by `dsh-hmr`, so writing it triggers an immediate
full re-assembly of the running host. The script prints the edits instead of making them.

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
and it wins silently. Note that the generator derives the shell name that goes into the
lanes' `toolFilter` deny lists from the *effective* values of both the host layer and the
preset's own rows, so changing that override means re-running
`node tools/gen-cordis-patch.mjs`. This preset changes no tool row, filter or persona to
accommodate any particular shell arrangement.

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
installed. One fragility worth naming: `package.json` has **no `exports` field**, so those
deep `.md` paths currently resolve through Node's legacy no-exports behaviour. An explicit
`exports` map would be more robust and is listed under the npm work below.

---

## Publishing to npm

**This has been done.** The package is published as `@quill507/dsh-orchestrator-preset`;
`npm view @quill507/dsh-orchestrator-preset versions` lists `0.1.0` through `0.1.6`, and
`dist-tags.latest` is `0.1.6`. The runtime specifier is the npm name — the `@local/` alias
is no longer used for this bundle.

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
