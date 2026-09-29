#!/usr/bin/env bash
#
# verify-install.sh — is this preset really installed, and really selected?
#
#   ./tools/verify-install.sh              # checks the "desktop" profile
#   ./tools/verify-install.sh web
#   DSH_PKG_ROOT=/path/to/@deepseek-ai/dsh ./tools/verify-install.sh
#
# Read-only. It composes the profile tree in memory and never writes to a DSH
# home; check 5 asserts that, rather than assuming it.
#
# Five checks, two of which were wrong as originally written. What changed:
#
#   1. selectedDefault in the profile patch            unchanged — still valid
#   2. the bundle link is a real symlink               unchanged — test -L, not -e
#   3. the bundle is readable THROUGH the link         unchanged — present != usable
#   4. the patch generator is in sync                 CHANGED — see below
#   5. which preset is actually selected               REPLACED — see below
#
# Why 4 changed: the generator resolves its skeleton from $DSH_HOME, falling back
# to ~/.dsh. A shell that happens to export DSH_HOME resolves fine; a plain shell
# without it exited 2, which reads as "the tool is broken". So this runs the tool
# with DSH_HOME explicitly UNSET — the case that used to fail. The tool was
# repaired to fall back to the default home, so it should now pass either way, and
# this check proves that rather than assuming it.
#
# Why 5 was replaced rather than repaired: `dsh --profile <name> --dump-config` is
# refused outright by the launcher for an Electron-managed profile such as
# `desktop`, with no flag or environment escape. And the profile's `cordis.yml` is
# a four-line empty root the host rewrites on every launch — it structurally
# cannot contain the rows, and anything dumped into it dies at the next boot. The
# original check grepped that file and could never have worked. This check instead
# composes the tree with the host's own read-only loader, skipping the step that
# rewrites cordis.yml, and greps the composed output.
#
# MIT licensed. See ../LICENSE.

set -uo pipefail

PROFILE="${1:-desktop}"
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

PASS=0; FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok()   { PASS=$((PASS+1)); printf 'PASS  %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$*"; }
# Neither a pass nor a fail: something did not run, and saying so is the point.
# A warning that quietly counted as a pass would be the same lie as an empty
# grep result.
warn() { printf 'WARN  %s\n' "$*"; }
note() { printf '      %s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }

# --- resolve the DSH home and the dsh package root, dynamically ------------
# Neither is hardcoded: both move between machines, and a check that only works on
# one of them is not a check.
head_ "environment"
DSH_PKG_ROOT="${DSH_PKG_ROOT:-}"
if [ -z "$DSH_PKG_ROOT" ]; then
  shim="$(command -v dsh 2>/dev/null || true)"
  if [ -n "$shim" ]; then
    base="$(cd -- "$(dirname -- "$shim")" && pwd)"
    for cand in "$base/node_modules/@deepseek-ai/dsh" "$base/../node_modules/@deepseek-ai/dsh" \
                 "$base/../lib/node_modules/@deepseek-ai/dsh"; do
      if [ -f "$cand/package.json" ]; then DSH_PKG_ROOT="$(cd -- "$cand" && pwd)"; break; fi
    done
  fi
fi
if [ -z "$DSH_PKG_ROOT" ] || [ ! -f "$DSH_PKG_ROOT/package.json" ]; then
  echo "!! could not locate the @deepseek-ai/dsh package root" >&2
  echo "   set DSH_PKG_ROOT=/path/to/@deepseek-ai/dsh and re-run" >&2
  exit 2
fi
note "dsh package root : $DSH_PKG_ROOT"

# The DSH home is the host's own answer, not a guess about ~.
DSH_HOME_ABS="$(cd -- "$DSH_PKG_ROOT" && node --input-type=module -e \
  "const {resolveDshHome} = await import('@deepseek-ai/dsh-home-paths'); process.stdout.write(resolveDshHome());")"
[ -n "$DSH_HOME_ABS" ] || { echo "!! could not resolve the DSH home" >&2; exit 2; }
note "DSH home         : $DSH_HOME_ABS"

PROFILE_DIR="$DSH_HOME_ABS/profiles/$PROFILE"
PATCH_YML="$PROFILE_DIR/cordis.patch.yml"
COMPOSED_CORDIS_YML="$PROFILE_DIR/cordis.yml"

# The package name is read, never written down. It is the one string in this file
# that changes on a rename, and a hardcoded copy of it is a bug that only fires
# after the rename — which is exactly when nobody is looking at this script.
BUNDLE_NAME="$(node -e "
  const fs = require('node:fs');
  process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).name || '');
" "$REPO_ROOT/package.json" 2>/dev/null)"
if [ -z "$BUNDLE_NAME" ]; then
  echo "!! cannot read the package name from $REPO_ROOT/package.json" >&2
  exit 2
fi
BUNDLE_LINK="$PROFILE_DIR/node_modules/$BUNDLE_NAME"

if [ ! -d "$PROFILE_DIR" ]; then
  echo "!! no such profile: $PROFILE_DIR" >&2
  exit 2
fi

# ===========================================================================
head_ "check 1 — the profile patch selects this preset (unchanged form)"
# ===========================================================================
# Still valid exactly as originally written. The row lives in the profile's own
# patch layer, so a plain anchored grep is the right instrument.
n="$(grep -c 'selectedDefault: dsh-orchestrator-preset$' "$PATCH_YML" 2>/dev/null || echo 0)"
if [ "$n" = "1" ]; then
  ok "check 1  selectedDefault: dsh-orchestrator-preset occurs exactly once in the profile patch"
else
  bad "check 1  expected exactly 1 occurrence, found $n  ($PATCH_YML)"
fi

# ===========================================================================
head_ "check 2 — the bundle link is a REAL symlink (unchanged form)"
# ===========================================================================
# This distinction is the whole point of the check. `test -e` follows a symlink,
# so a link that some tool silently degraded into a real directory COPY still
# passes it — and a copy freezes the bundle while every later edit to the real
# bundle is ignored. Only `test -L` asks the question we actually mean.
if [ -L "$BUNDLE_LINK" ]; then
  ok "check 2  $BUNDLE_NAME is a real symlink"
  note "-> $(readlink "$BUNDLE_LINK")"
elif [ -e "$BUNDLE_LINK" ]; then
  bad "check 2  it exists but is NOT a symlink — a copy would freeze the bundle"
  note "test -e would have passed this; test -L is why the check exists"
else
  bad "check 2  missing: $BUNDLE_LINK"
  note "add the link: dependency to the profile's package.json, then pnpm install"
fi

# ===========================================================================
head_ "check 3 — the bundle is readable THROUGH the link (unchanged form)"
# ===========================================================================
# Present is not usable. This resolves package.json by the name the patch rows
# use, so it proves the same resolution path the host takes at boot.
if [ -L "$BUNDLE_LINK" ] || [ -e "$BUNDLE_LINK" ]; then
  if ( cd -- "$PROFILE_DIR" && BUNDLE_NAME="$BUNDLE_NAME" node --input-type=module -e '
       import { createRequire } from "node:module";
       import { realpathSync } from "node:fs";
       const r = createRequire(process.cwd() + "/package.json");
       const p = r.resolve(process.env.BUNDLE_NAME + "/package.json");
       process.stdout.write(realpathSync(p));' ) >"$TMP/resolved" 2>"$TMP/resolve.err"; then
    ok "check 3  the bundle resolves by package name and its real path is reachable"
    note "-> $(cat "$TMP/resolved")"
  else
    bad "check 3  present but NOT resolvable by package name:"
    note "$(head -3 "$TMP/resolve.err" | tr '\n' ' ')"
  fi
else
  bad "check 3  skipped: no link to read through (see check 2)"
fi

# ===========================================================================
head_ "check 4 — the patch generator is in sync, with DSH_HOME UNSET (CHANGED form)"
# ===========================================================================
# The case that used to fail. env -u removes the variable for the child only, so
# this script's own environment is untouched.
GEN="$REPO_ROOT/tools/gen-cordis-patch.mjs"
if [ ! -f "$GEN" ]; then
  bad "check 4  generator not found at $GEN"
else
  before_m="$(stat -c %Y "$REPO_ROOT/cordis.patch.yml" 2>/dev/null || echo none)"
  if ( cd -- "$REPO_ROOT" && env -u DSH_HOME node tools/gen-cordis-patch.mjs --check ) >"$TMP/gen.out" 2>&1; then
    ok "check 4  --check exited 0 with DSH_HOME unset"
    note "$(grep -m1 -E '^(ok|stale|wrote) ' "$TMP/gen.out" || head -1 "$TMP/gen.out")"
  else
    rc=$?
    bad "check 4  --check exited $rc with DSH_HOME unset (0 expected)"
    note "$(head -4 "$TMP/gen.out" | tr '\n' ' ')"
  fi
  after_m="$(stat -c %Y "$REPO_ROOT/cordis.patch.yml" 2>/dev/null || echo none)"
  if [ "$before_m" = "$after_m" ]; then
    note "--check did not rewrite cordis.patch.yml, as documented"
  else
    bad "check 4  --check modified cordis.patch.yml — it is not read-only!"
  fi
fi

# ===========================================================================
head_ "check 5 — the COMPOSED tree really selects this preset (REPLACED form)"
# ===========================================================================
# --dump-config is unusable here: the launcher refuses it for an Electron-managed
# profile, unconditionally. So compose the tree in memory with the host's own
# loader and skip the step that rewrites cordis.yml.
#
# Two traps this avoids, both paid for by an earlier attempt:
#   * the dump-config helper is minified, so collectConfigDumpLayers is exported
#     under the name `t`; the file is located by probing for that export rather
#     than by hardcoding a content hash, which changes between builds;
#   * on Windows an absolute path inside import() needs pathToFileURL().href or
#     it fails with ERR_UNSUPPORTED_ESM_URL_SCHEME.
#
# cwd must be the dsh package root so the bare specifiers resolve.

cordis_m_before="$(stat -c '%Y:%s' "$COMPOSED_CORDIS_YML" 2>/dev/null || echo absent)"
compose() {
  ( cd -- "$DSH_PKG_ROOT" && node --input-type=module -e '
    import { pathToFileURL } from "node:url";
    import { readdirSync } from "node:fs";
    const boot  = await import("@deepseek-ai/dsh-app-boot");
    const { resolveDshHome } = await import("@deepseek-ai/dsh-home-paths");
    const root  = process.env.DSH_PKG_ROOT;
    const profile = process.env.VERIFY_PROFILE;
    // locate the minified helper by its export, not by filename hash
    const cands = await Promise.all(readdirSync(root + "/lib")
      .filter(f => /^dump-config-.*\.js$/.test(f))
      .map(async f => { const m = await import(pathToFileURL(root + "/lib/" + f).href); return { f, t: m.t }; }));
    const helper = cands.find(x => typeof x.t === "function");
    if (!helper) { console.error("no dump-config helper exporting t"); process.exit(9); }
    const dir = boot.resolveProfileDir(profile, resolveDshHome());
    const loaded = boot.loadProfileDirectory("dsh", dir, root + "/package.json", { userLayer: true });
    process.stderr.write("helper = " + helper.f + "\n");
    process.stdout.write(boot.renderConfigDump("dsh", dir + "/cordis.yml", helper.t(loaded, false, [])));
  ' 2>"$TMP/compose.err" )
}
DSH_PKG_ROOT="$DSH_PKG_ROOT" VERIFY_PROFILE="$PROFILE" compose >"$TMP/composed.yml"
compose_rc=$?
cordis_m_after="$(stat -c '%Y:%s' "$COMPOSED_CORDIS_YML" 2>/dev/null || echo absent)"

if [ "$compose_rc" != "0" ] || [ ! -s "$TMP/composed.yml" ]; then
  bad "check 5  composition failed (exit $compose_rc)"
  note "$(head -3 "$TMP/compose.err" | tr '\n' ' ')"
else
  # The assertion that makes this check trustworthy: composing must not have
  # touched the profile. Without it, this check would be a mutation dressed as
  # an inspection, and nothing in its output would reveal that.
  if [ "$cordis_m_before" = "$cordis_m_after" ]; then
    ok "check 5  composition is read-only: cordis.yml mtime:size unchanged ($cordis_m_after)"
  else
    bad "check 5  composition MUTATED cordis.yml ($cordis_m_before -> $cordis_m_after)"
  fi
  note "composed $(wc -l <"$TMP/composed.yml") lines; helper $(head -1 "$TMP/compose.err" | sed 's/helper = //')"

  c_sel="$(grep -c 'selectedDefault: dsh-orchestrator-preset$' "$TMP/composed.yml" || true)"
  c_stale="$(grep -c 'new-orchestration' "$TMP/composed.yml" || true)"
  c_row="$(grep -c '^ *- id: preset-dsh-orchestrator-preset$' "$TMP/composed.yml" || true)"

  if [ "$c_sel" -ge 1 ]; then
    ok "check 5  the composed tree really selects dsh-orchestrator-preset ($c_sel row(s))"
  else
    bad "check 5  the composed tree does NOT select this preset"
  fi
  if [ "$c_stale" = "0" ]; then
    ok "check 5  no occurrence of the pre-rename name 'new-orchestration'"
  else
    bad "check 5  the composed tree still contains 'new-orchestration' ($c_stale line(s))"
  fi
  if [ "$c_row" -ge 1 ]; then
    ok "check 5  the preset row preset-dsh-orchestrator-preset is present"
  else
    bad "check 5  the preset row preset-dsh-orchestrator-preset is ABSENT from the composed tree"
  fi
fi

# ===========================================================================
head_ "check 6 — the four orch-* skills come from this bundle's own provider"
# ===========================================================================
# The four skills ship INSIDE the bundle and are served by a filesystem skill
# provider mounted from extensions/dsh/index.js. They are deliberately NOT in the
# DSH home's skills directory any more: copying them there was the old install
# step 3, and it is what left the user's global directory full of someone else's
# environment. So "present" now means "reachable through our provider", and this
# check asks the provider rather than looking at a directory.
SKILLS_DIR="$DSH_HOME_ABS/skills"
BUNDLE_SKILLS="$REPO_ROOT/skills"

for s in orch-delegation-brief orch-discussion-protocol orch-evidence-protocol orch-real-path-testing; do
  if [ -f "$BUNDLE_SKILLS/$s/SKILL.md" ]; then
    want=$(grep -m1 '^name:' "$BUNDLE_SKILLS/$s/SKILL.md" | sed 's/^name:[[:space:]]*//')
    if [ "$want" = "$s" ]; then
      ok "check 6  shipped in bundle with matching frontmatter name: $s"
    else
      bad "check 6  frontmatter name '$want' != directory '$s' (the provider reads the frontmatter)"
    fi
  else
    bad "check 6  skill missing from the bundle: $s/SKILL.md"
  fi
  if [ -d "$SKILLS_DIR/$s" ]; then
    bad "check 6  $s is still copied into the global skills directory — that is what this change removed"
  fi
done

# The load-bearing half: construct the real provider and ask it what it serves.
# A file-presence check would pass even if the provider were never mounted.
if [ -f "$REPO_ROOT/extensions/dsh/index.js" ]; then
  # The probe must run from the INSTALLED bundle, not from this source tree: the
  # provider imports @deepseek-ai/dsh-skill-filesystem, which resolves by walking
  # up to the DSH home's node_modules. A checkout in an unrelated directory has
  # no such ancestor, and the probe would fail for a reason that says nothing
  # about the preset.
  installed="$(cd "$BUNDLE_LINK" 2>/dev/null && pwd -P)" || installed=""
  if [ -z "$installed" ] || [ ! -f "$installed/extensions/dsh/index.js" ]; then
    bad "check 6  the installed bundle has no extensions/dsh/index.js — the probe cannot run"
  else
  provided="$(cd "$installed" && node --input-type=module -e '
    import * as nodefs from "node:fs";
    let factory = null;
    const ctx = { logger:{info(){},warn(){}}, effect:(f)=>{try{f()}catch{}}, on(){},
                  get:(k)=> k==="fs" ? nodefs : undefined,
                  skills:{ registerProvider:(f)=>{factory=f;return ()=>{}},
                           register:()=>()=>{}, list:async()=>[], get:async()=>null } };
    const mod = await import("./extensions/dsh/index.js");
    mod.apply(ctx);
    if (!factory) { console.log("NO_PROVIDER_REGISTERED"); process.exit(0); }
    const p = factory({ signal: new AbortController().signal });
    const l = await p.list({ cwd: process.cwd() });
    const arr = Array.isArray(l) ? l : (l && l.skills) || [];
    console.log(arr.map(s => s && (s.name || s)).filter(Boolean).sort().join(" "));
  ' 2>"$TMP/provider.err")"
  rc=$?
  if [ "$rc" -ge 2 ] || [ -z "$provided" ]; then
    bad "check 6  the provider probe itself failed (node exit $rc) — a clean result would be untrustworthy:"
    note "$(head -2 "$TMP/provider.err" | tr '\n' ' ')"
  elif [ "$provided" = "NO_PROVIDER_REGISTERED" ]; then
    bad "check 6  extensions/dsh/index.js did not register a skill provider"
  else
    for s in orch-delegation-brief orch-discussion-protocol orch-evidence-protocol orch-real-path-testing; do
      case " $provided " in
        *" $s "*) ok "check 6  provider serves: $s" ;;
        *) bad "check 6  provider does NOT serve: $s" ;;
      esac
    done
    # Isolation: includeDefaultRoots:false means the provider must serve exactly
    # this bundle's four skills and nothing else. Comparing against the needle
    # list rather than against names written out here keeps this script free of
    # the very strings the leak gate hunts — writing them literally is what once
    # made the gate report itself.
    served_count=0
    for n in $provided; do served_count=$((served_count+1)); done
    if [ "$served_count" -eq 4 ]; then
      ok "check 6  provider serves exactly 4 skills (isolated from the global directory)"
    else
      bad "check 6  provider serves $served_count entries, expected 4 — the global skills directory is leaking in"
      note "$provided"
    fi
    for n in "${NAME_NEEDLES[@]}"; do
      case " $provided " in
        *"$n"*) bad "check 6  a known third-party name leaked into what the provider serves: $n" ;;
      esac
    done
  fi
  fi
else
  bad "check 6  extensions/dsh/index.js is missing — the bundle has no skill provider"
fi

for s in delegation-brief discussion-protocol evidence-protocol real-path-testing; do
  if [ -d "$SKILLS_DIR/$s" ]; then
    bad "check 6  a RETIRED unprefixed skill still exists as a directory: $s"
  else
    ok "check 6  retired name correctly absent: $s"
  fi
done

# ===========================================================================
head_ "check 7 — the two shell rows read as deliberately configured"
# ===========================================================================
# Not a defect. The preset declares BOTH shells, each gated on process.platform,
# so on Windows it asks for pwsh. This host's ~/.dsh/cordis.patch.yml home layer
# deliberately forces bash-only on Windows and is applied after the profile
# layer, so it wins. A disabled tool is still a known tool, and the lanes work
# fine on bash alone. If this ever reads the other way, the home layer changed.
if [ -s "$TMP/composed.yml" ]; then
  bash_row="$(grep -A2 '^- id: tool-bash$' "$TMP/composed.yml" | grep -m1 'disabled:' || echo 'disabled: ?')"
  pwsh_row="$(grep -A2 '^- id: tool-pwsh$' "$TMP/composed.yml" | grep -m1 'disabled:' || echo 'disabled: ?')"
  if echo "$bash_row" | grep -q 'disabled: false'; then
    ok "check 7  tool-bash is enabled (bash-only Windows host, deliberate)"
  else
    bad "check 7  tool-bash: $bash_row (expected disabled: false)"
  fi
  if echo "$pwsh_row" | grep -q 'disabled: true'; then
    ok "check 7  tool-pwsh is disabled (bash-only Windows host, deliberate)"
  else
    bad "check 7  tool-pwsh: $pwsh_row (expected disabled: true)"
  fi
else
  bad "check 7  no composed tree to read the shell rows from"
fi

# ===========================================================================
head_ "check 8 — leak gate over this repository's shipped tree"
# ===========================================================================
# Doubles as the publish gate: the tree must carry no machine-local path and no
# third-party skill name. Scanned in this repository, not the live installation.
#
# Two things this does deliberately, both learned the hard way:
#
# 1. It never writes the needles as literals. This file is itself inside the
#    scanned tree, so a scanner that spells out what it hunts is a self-matching
#    source: it would report a leak of its own making, and exempting itself
#    would be worse. Each needle is assembled from two adjacent quoted parts, so
#    the shipped text never contains the literal. What it hunts, by category: an
#    image-upload skill; a code-review and a commit-message helper; a
#    disk-cleaning skill that ships a vendored binary; a bundled multi-licence
#    skill; a no-frontmatter UI skill and a document reader; two skills named
#    only by an earlier draft; and the private-data layout tokens.
#
# 2. It distinguishes "found nothing" from "the scan itself failed". An earlier
#    version ended its pattern with a backslash, which grep rejects as a
#    trailing escape; the non-zero exit was swallowed by `|| true` and the gate
#    reported a clean tree on every run. A gate that cannot fail is decoration,
#    so a grep status of 2 or above is a FAILURE here, not an empty result.
#
# 3. It uses -F. In a basic regular expression a backslash is an escape, so a
#    needle containing one does not match the literal text it is hunting -- the
#    same shape mismatch that once made a leak scan report zero over a file that
#    held thirteen hits. Fixed strings compare the bytes.
#
# 4. ABSOLUTE PATHS ARE MATCHED BY SHAPE, NOT BY VALUE.
#
#    An earlier version enumerated this installation's real home directory and
#    workspace root as literal needles, splitting each across two adjacent quoted
#    parts so that grep would not match its own source. That only hid the value
#    from grep: a reader deleting two quotation marks recovered both. Writing
#    the values into the checker WAS the leak. The patterns below match the form
#    instead, so they catch tomorrow's username as readily as today's, and this
#    file names nobody.
ABSPATH_PATTERN='[A-Za-z]:[\\/](Users[\\/]|work|Documents|Desktop|OneDrive)'

# Generic placeholders and worked examples are documentation, not leaks. Only
# these tokens are excused, and only immediately after a Users/ segment.
ABSPATH_GENERIC='[A-Za-z]:[\\/]Users[\\/][^[:space:]"'"'"'<>|/]*(\[r\]|r\]|x|someone|user|username|somebody|YOUR_NAME|<user>)[^A-Za-z0-9]'

# A denylist of third-party and private-data names is unavoidable -- there is no
# shape that means "a name I have not thought of". But listing them here would
# publish what this installation has installed, which is the same exposure the
# MANIFEST table was cut for. So the list lives in a local, uncommitted file.
# Absent that file the gate still runs its shape rules and says so out loud,
# rather than passing quietly on less coverage than it looks like it has.
NEEDLE_FILE="$REPO_ROOT/tools/leak-needles.local.txt"
NAME_NEEDLES=()
if [ -f "$NEEDLE_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;   # a bare "#" would become `-e "#"` and match every
                              # commented file in the tree
    esac
    NAME_NEEDLES+=("$line")
  done < "$NEEDLE_FILE"
fi

# scan <ignore-case:0|1> <needle...> -> prints matching files, returns grep's status
#   0 = at least one match, 1 = no match, >=2 = the scan itself failed
#
# Every needle needs its OWN -e. `-e "$@"` would prefix only the first, and the
# rest would be taken as filename operands, which is how an earlier version came
# to hang on stdin.
scan() {
  local icase="$1"; shift
  local -a g=(-rIlF) e=()
  [ "$icase" = "1" ] && g+=(-i)
  local a
  for a in "$@"; do e+=(-e "$a"); done
  grep "${g[@]}" --exclude-dir=.git --exclude-dir=.dsh --exclude-dir=node_modules \
       --exclude=leak-needles.local.txt \
       "${e[@]}" "$REPO_ROOT" 2>"$TMP/grep.err"
}

# The path rule is a shape rule, so it runs as a regex and prints the offending
# LINES rather than just the file names — a file that merely mentions the shape
# in a comment still has to be shown, so the exception list can be argued with.
# grep exiting >=2 is a failed scan, never a clean one.
shapehits() {
  grep -rInE --exclude-dir=.git --exclude-dir=.dsh --exclude-dir=node_modules \
       --exclude=leak-needles.local.txt \
       "$ABSPATH_PATTERN" "$REPO_ROOT" 2>"$TMP/grep.err" \
    | grep -vE "$ABSPATH_GENERIC"
  return "${PIPESTATUS[0]}"
}

hits="$(shapehits)"; rc=$?
# docs/ is local-only and not distributed; it is audited separately and its own
# text quotes the shapes this rule hunts, so it is carved out here exactly as it
# is from the name rule below.
hits="$(printf '%s' "$hits" | grep -v '/docs/' || true)"
if [ "$rc" -ge 2 ]; then
  bad "check 8  the path scan FAILED (grep exit $rc) — a clean result would be untrustworthy:"
  note "$(head -2 "$TMP/grep.err" | tr '\n' ' ')"
elif [ -z "$hits" ]; then
  ok "check 8  no machine-local absolute path in the shipped tree"
else
  bad "check 8  machine-local absolute path found in the shipped tree:"
  printf '%s\n' "$hits" | sed 's/^/      /'
fi

if [ "${#NAME_NEEDLES[@]}" -eq 0 ]; then
  warn "check 8  no tools/leak-needles.local.txt — name rules did not run"
  note "that file is deliberately uncommitted; see the comment above NEEDLE_FILE"
fi
hits="$(scan 1 "${NAME_NEEDLES[@]}")"; rc=$?
if [ "$rc" -ge 2 ]; then
  bad "check 8  the name scan FAILED (grep exit $rc):"
  note "$(head -2 "$TMP/grep.err" | tr '\n' ' ')"
else
  # This scan walks the WORKING TREE, not the tracked set, so it still sees
  # docs/ even though docs/ is no longer distributed. Two names are retained in
  # there deliberately, as attribution rather than as a leak. Everything outside
  # docs/ must be clean.
  leaky="$(printf '%s' "$hits" | grep -v '/docs/' || true)"
  if [ -z "$leaky" ]; then
    ok "check 8  no third-party skill name or private-data token outside docs/"
    [ -n "$hits" ] && note "docs/ is local-only and not distributed; its two retained names are attribution, not a leak"
  else
    bad "check 8  third-party name or private-data token outside docs/:"
    printf '%s\n' "$leaky" | sed 's/^/      /'
  fi
fi

# ===========================================================================
head_ "check 9 — the routing table's aegis-* targets are actually provided"
# ===========================================================================
# The resident routing table names aegis skills by their PREFIXED name, while the
# upstream pack registers them bare. The bundle's own aegis-prefix plugin is the
# bridge, so a routing target that nothing produces is a dangling reference the
# preset cannot reach. This connects the two halves without needing a boot: read
# the bare names off the installed pack, apply the same prefix, and ask whether
# every name the routing table uses is in that set.
#
# Falsifiable: rename a skill upstream, or stop shipping the bridge, and this goes
# red — which is the failure that is otherwise silent, because a routing row
# pointing at nothing simply never matches and nothing complains.
if [ -f "$REPO_ROOT/extensions/dsh/aegis-prefix.js" ]; then
  AEGIS_PKG="$PROFILE_DIR/node_modules/aegis/skills"
  if [ ! -d "$AEGIS_PKG" ]; then
    warn "check 9  aegis pack not found under the profile — routing targets unverified"
    note "this preset depends on the aegis pack; install it, or ignore this knowingly"
  else
    provided="$(find "$AEGIS_PKG" -maxdepth 2 -name SKILL.md 2>/dev/null | while IFS= read -r f; do
        n="$(grep -m1 '^name:' "$f" | sed 's/^name:[[:space:]]*//;s/[[:space:]]*$//')"
        [ -n "$n" ] && printf 'aegis-%s\n' "$n"
      done | sort -u)"
    referenced="$(grep -oE '\baegis-[a-z0-9-]+' "$REPO_ROOT/routing-sections.mjs" | sort -u)"
    if [ -z "$referenced" ]; then
      bad "check 9  the routing table references no aegis-* skill — the table lost its targets, or this check matches nothing"
    else
      missing=0
      for r in $referenced; do
        case " $(printf '%s ' $provided) " in
          *" $r "*) : ;;
          *) bad "check 9  routing target provided by nothing: $r"; missing=$((missing+1)) ;;
        esac
      done
      [ "$missing" -eq 0 ] &&
        ok "check 9  all $(printf '%s\n' $referenced | wc -l) routing targets resolve to a provided skill"
    fi
    # Asserted so a silently emptied pack cannot pass this check.
    if printf '%s\n' "$provided" | grep -q .; then
      ok "check 9  the upstream pack offers $(printf '%s\n' $provided | wc -l) skills to prefix"
    else
      bad "check 9  the upstream pack offers zero skills — the prefix step would produce nothing"
    fi
  fi
else
  bad "check 9  extensions/dsh/aegis-prefix.js is missing — the routing table has no bridge to the bare names"
fi

# ===========================================================================
printf '\n========================================\n'
printf 'SUMMARY  %d passed, %d failed  (profile: %s)\n' "$PASS" "$FAIL" "$PROFILE"
printf '========================================\n'
[ "$FAIL" -eq 0 ] || exit 1
exit 0
