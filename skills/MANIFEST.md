# Shipped skills — authoritative manifest

This file is the **authoritative list of skills this repository ships**. Both READMEs'
install step links here; if either ever disagrees, this file wins and the README is the bug.

The preset ships **four** self-authored skills. Every one of them is a single `SKILL.md`
with YAML frontmatter, written by the preset's author, and licensed MIT under the root
`LICENSE`.

| # | Skill | Files | Frontmatter `name` | Role in the preset |
|---|---|---|---|---|
| 1 | [`orch-delegation-brief`](./orch-delegation-brief/SKILL.md) | 1 | `orch-delegation-brief` | The delegation-packet template for capability tasks handed to a named lane. |
| 2 | [`orch-discussion-protocol`](./orch-discussion-protocol/SKILL.md) | 1 | `orch-discussion-protocol` | Pre-dispatch self-proof and convergence rules for multi-perspective discussion. |
| 3 | [`orch-evidence-protocol`](./orch-evidence-protocol/SKILL.md) | 1 | `orch-evidence-protocol` | Evidence-file format, the completion path-audit gate, the lane ledger's three states. |
| 4 | [`orch-real-path-testing`](./orch-real-path-testing/SKILL.md) | 1 | `orch-real-path-testing` | Real-user-path testing: kills shell-level verification that only proves a start-up. |

## The `orch-` prefix is load-bearing

All four carry an `orch-` prefix, and the preset references them by that exact name — the
resident routing sections in `routing-sections.mjs` and the orchestrator persona both name
`orch-evidence-protocol` and `orch-delegation-brief` explicitly. The prefix keeps them
from colliding with same-named skills from any other source in a user's skills directory,
and it makes it obvious at a glance which skills belong to this preset.

**Renaming one without updating the others silently breaks routing.** The references live
in `routing-sections.mjs` and `personas/orchestrator.md`; `node tools/audit-personas.mjs`
and a run of `node tools/gen-cordis-patch.mjs` are the checks that catch a half-finished
rename. This repository is currently in sync: every reference in the shipped code names
the four skills exactly as listed above.

> The four skills were originally shipped under unprefixed names
> (`delegation-brief`, `discussion-protocol`, `evidence-protocol`, `real-path-testing`).
> Those names are **retired**. They appear nowhere in the shipped code and are deliberately
> absent from the "not shipped" table below, because they are no longer distinct skills —
> they are the same four under their current names. The design history that still uses the
> old spellings is not distributed with this repository.

## Install these four, and only these four

```sh
for s in orch-delegation-brief orch-discussion-protocol orch-evidence-protocol orch-real-path-testing; do
  cp -r "skills/$s" ~/.dsh/skills/
done
```

Copy **one directory at a time**. Never copy a whole `~/.dsh/skills/` tree: that tree also
holds third-party skills that are deliberately outside this preset's publish boundary, and a
bulk copy would sweep them in along with the four. The reason this is a licence matter rather
than a tidiness one: some of the skills installed on any given machine carry **no licence
declaration at all**, and redistributing those is a licence violation, not an oversight. The
set of what is installed is personal to whoever installed it, so this manifest states the
rule rather than listing names — the list would describe one machine, not the project, and
would go stale the moment it was written.

The rule is enforced mechanically rather than by memory: [`.gitignore`](../.gitignore) is a
**whitelist**, admitting only the four exact paths listed above and refusing everything else
by default. A stray bulk copy into this tree cannot be committed even by accident, so
enumerating what to avoid would add nothing the whitelist does not already guarantee.

## Not aegis skills

`aegis-*` skills are **not** in this directory. The `aegis` methodology pack is an
upstream runtime dependency consumed by the host; this repository vendors none of its text
and does not redistribute it. See the third-party attribution in [`README.md`](../README.md).
