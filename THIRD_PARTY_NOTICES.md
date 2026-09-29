# Third-party notices

This project's own licence is [`LICENSE`](./LICENSE) — MIT, held by quill507. This
file records what is in the repository that came from somewhere else, and what is
deliberately not in it.

Keeping these apart matters for more than tidiness. Appending this block to
`LICENSE` makes GitHub's licence detector fail to match the file and report
"Other", which is a worse signal than the MIT it actually is; and it duplicated a
description that already lived in the README, which is a second owner for one fact.

## DeepSeek Harness

MIT License:

```
Copyright (c) 2026 DeepSeek
```

This project includes configuration rows derived from DeepSeek Harness. The
`LICENSE` file here is **this project's own** MIT licence; it is deliberately
*not* a copy of DeepSeek Harness's licence file, which would misrepresent the
provenance of this repository.

## aegis — an upstream dependency, not vendored

The `aegis` skill pack is consumed at runtime by the host. It is **not vendored**
into this repository and no aegis text is copied into it. MIT License:

```
Copyright (c) 2025 Jesse Vincent
Copyright (c) 2025-2026 Ganyuan Ran
```

`aegis-*` names appear in this repository only as routing-table keys, and in the
prefix bridge that maps the pack's bare skill names onto them.

## Auto-Pilot

Written by [itamzxm](https://github.com/itamzxm). Not published and carries no
licence — all rights reserved by default. **Nothing from it is distributed here.**
Six groups of its mechanisms are described in this repository's design history and
reimplemented; no text is reproduced. It is credited as a source of ideas, which
costs no rights holder anything and costs this project nothing to say.

## oh-my-openagent

Written by [code-yeongyu](https://github.com/code-yeongyu/oh-my-openagent). **Not
open source.** No text from it is distributed here: every persona in this
repository has been rewritten against a stated threshold — under 2% n-gram overlap
with its agent sources, and no run of six consecutive matching lines.
`tools/audit-personas.mjs` is that threshold, made runnable.

That check is stated as **partial evidence, not a verified result**. Its term-probe
half runs anywhere; the overlap half needs the upstream corpus, which is
deliberately not shipped, so the tool reports `ok: null` rather than `true` — an
unverified answer rather than a false pass.

## Skills that are not redistributed

A user's skills registry normally holds more than the four this preset ships. The
third-party skills installed on any given machine are **not** redistributed by this
repository, and some of them carry no licence declaration at all, which makes
redistributing those a licence violation rather than an oversight. That is why no
names appear here, and why `.gitignore` is a whitelist: what is installed is
personal to whoever installed it, so a list would describe one machine and go stale
the moment it was written.
