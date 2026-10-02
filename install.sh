#!/usr/bin/env bash
#
# install.sh — install the dsh-orchestrator-preset bundle into a DeepSeek Harness home.
#
#   ./install.sh                 # install into $DSH_HOME, or ~/.dsh
#   DSH_HOME=/tmp/dsh ./install.sh
#   ./install.sh --check         # run the gates and report, change nothing
#
# What it does, in order:
#   0. gate   — refuse to continue unless the host is >= 0.1.7-rc.1
#   1. stage  — sync this repository's distributable set into $DSH_HOME/plugins/
#               on every run, so the copy the host resolves is a projection of
#               this repository rather than of the first install
#   2. link   — verify the per-profile symlink that `pnpm install` creates
#   3. skills — verify the four bundled skills; the bundle's own provider serves
#              them, so nothing is copied into the user's global skills directory
#   4. none   — the aegis prefix and its optional description swap ship inside
#              the bundle under extensions/dsh/; there is no companion plugin
#              to install, and installing the old one reintroduces a race
#   5. report — print the profile wiring the user must apply themselves
#
# What it deliberately does NOT do: touch a profile's package.json or cordis.patch.yml.
# Those are the live installation's own files, and cordis.patch.yml is watched live by
# dsh-hmr, so writing it triggers an immediate full re-assembly of the running host.
# Steps 2 and 5 print the exact commands instead.
#
# MIT licensed. See ./LICENSE.

set -euo pipefail

MIN_HOST_VERSION="0.1.7-rc.1"
BUNDLE_DIRNAME="dsh-orchestrator-preset-bundle"
BUNDLE_SCOPE="@local/${BUNDLE_DIRNAME}"
SKILLS="orch-delegation-brief orch-discussion-protocol orch-evidence-protocol orch-real-path-testing"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
# Git Bash reads a Windows path with backslashes as literal filename characters
# for the syscall-backed tests (`test -L`, `readlink`) while `test -e` and `cp`
# happen to accept it — so the same variable needs two spellings, and mixing them
# silently turns "the symlink is right there" into "MISSING". One spelling, here.
DSH_HOME="${DSH_HOME//\\//}"
if [ ! "$DSH_HOME" = "${DSH_HOME%/}" ]; then DSH_HOME="${DSH_HOME%/}"; fi

say()  { printf '\n== %s\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die()  { printf '\n!! %s\n' "$*" >&2; exit 1; }

# --- semver compare -------------------------------------------------------
# Prints -1/0/1 for $1 vs $2. Handles MAJOR.MINOR.PATCH with an optional
# `-prerelease` suffix; a release outranks its own prereleases.
ver_cmp() {
  local a_core a_pre b_core b_pre
  a_core="${1%%-*}"; a_pre=""; case "$1" in *-*) a_pre="${1#*-}";; esac
  b_core="${2%%-*}"; b_pre=""; case "$2" in *-*) b_pre="${2#*-}";; esac
  local v
  v="$(printf '%s\n%s\n' "$a_core" "$b_core" | sort -V | head -1)"
  [ "$v" = "$a_core" ] && [ "$a_core" != "$b_core" ] && { echo -1; return; }
  [ "$v" = "$b_core" ] && [ "$a_core" != "$b_core" ] && { echo 1;  return; }
  # equal numeric cores -> compare prerelease
  [ -z "$a_pre" ] && [ -z "$b_pre" ] && { echo 0; return; }
  [ -z "$a_pre" ] && { echo 1; return; }
  [ -z "$b_pre" ] && { echo -1; return; }
  [ "$a_pre" = "$b_pre" ] && { echo 0; return; }
  [ "$(printf '%s\n%s\n' "$a_pre" "$b_pre" | sort -V | head -1)" = "$a_pre" ] && { echo -1; return; }
  echo 1
}

# --- 0. host version gate -------------------------------------------------
say "0. host version gate (need >= ${MIN_HOST_VERSION})"
HOST_BIN="$(command -v dsh || true)"
[ -n "$HOST_BIN" ] || die "'dsh' not found on PATH. Install DeepSeek Harness, or re-run with it on PATH."
HOST_VERSION="$("$HOST_BIN" --version 2>/dev/null | tr -d '[:space:]' | head -1)"
[ -n "$HOST_VERSION" ] || die "could not read a version from 'dsh --version'."
info "dsh --version = ${HOST_VERSION}"
if [ "$(ver_cmp "$HOST_VERSION" "$MIN_HOST_VERSION")" = "-1" ]; then
  die "host ${HOST_VERSION} is older than the required ${MIN_HOST_VERSION}. Refusing to install."
fi
info "gate passed"

if [ "$CHECK_ONLY" = "1" ]; then
  say "--check: gates only, nothing written."
  exit 0
fi

# --- 1. stage the bundle --------------------------------------------------
# The set below is the distributable tree, and it is synced on EVERY run rather
# than only on the first. The earlier form copied once and then said "already
# present — leaving it in place", which meant a later run silently published
# nothing: a change to any file in this set reached the repository and never
# reached the host, and the failure was invisible from both sides. A bundle is
# what the host resolves, so the deployed copy has to be a projection of this
# repository, not a snapshot of the first install.
#
# Each item is removed then copied, so a file deleted here cannot survive there,
# and `cp -r src dst` cannot nest a directory inside an existing one.
#
# Deliberately NOT staged into the bundle (see .gitignore, which carries the
# reasoning): install.sh · docs/ · .git/ · .dsh/ · .gitattributes · .gitignore ·
# tools/*.local* — plus tools/verify-install.sh, which is a gate for the author's
# checkout and names paths that only exist in this repository.
#
# Staging is not publication. What reaches npm is package.json's `files` array,
# and that array admits no tools/ entry — so no author tool is published, while
# install.sh, absent from the list above, is: it is the only entry point a
# first-time user has.
say "1. stage the bundle into ${DSH_HOME}/plugins/${BUNDLE_DIRNAME}"
DEST="${DSH_HOME}/plugins/${BUNDLE_DIRNAME}"
mkdir -p "$DEST"
DISTRIBUTABLE="LICENSE README.md README.zh.md THIRD_PARTY_NOTICES.md cordis.patch.yml
  package.json personas skills extensions locale tools lane-composition.mjs
  plan-aware-persona.mjs routing-sections.mjs"
STAGED=0
for item in $DISTRIBUTABLE; do
  [ -e "${REPO_ROOT}/${item}" ] || die "${item} is missing from the repository."
  rm -rf "${DEST:?}/${item}"
  cp -r "${REPO_ROOT}/${item}" "${DEST}/"
  STAGED=$((STAGED + 1))
done
rm -f "${DEST}/tools/leak-needles.local.txt" "${DEST}/tools/verify-install.sh"
info "synced ${STAGED} entries; ${DSH_HOME}/plugins/${BUNDLE_DIRNAME} now holds $(find "$DEST" -type f | wc -l) files."

# --- 2. verify the per-profile link --------------------------------------
# The bundle is resolved BY NAME from a profile's node_modules, so the symlink
# belongs in each profile — not inside the bundle. `pnpm install` creates it from
# the profile's `link:` dependency; this step verifies it and says what is missing.
say "2. verify the ${BUNDLE_SCOPE} symlink in each profile"
PROFILES="${DSH_HOME}/profiles"
if [ ! -d "$PROFILES" ]; then
  info "no ${PROFILES} yet — nothing to verify."
else
  FOUND_PROFILE=0
  for pdir in "$PROFILES"/*/; do
    [ -d "$pdir" ] || continue
    pname="$(basename "$pdir")"
    case "$pname" in node_modules|shared) continue;; esac
    FOUND_PROFILE=1
    link="${pdir}node_modules/@local/${BUNDLE_DIRNAME}"
    if [ -L "$link" ]; then
      # test -L, never test -e: Git Bash can silently degrade a link into a copy,
      # and a copy passes test -e while freezing every later edit to the bundle.
      info "${pname}: real symlink -> $(readlink "$link")"
    elif [ -e "$link" ]; then
      info "${pname}: !! ${link} exists but is NOT a symlink (a copy freezes the bundle)"
    else
      info "${pname}: MISSING — run 'pnpm install' in ${pdir} after adding the link: dependency"
    fi
  done
  [ "$FOUND_PROFILE" = "0" ] && info "no profile directories found."
fi

# --- 3. the four self-authored skills ------------------------------------
# Nothing to copy beyond step 1's sync of skills/. The bundle's filesystem skill
# provider (extensions/dsh/index.js) serves them with includeDefaultRoots:false,
# so the user's global skills directory is left alone. Copying them into
# $DSH_HOME/skills is what this step used to do, and removing it is the point: a
# preset should not scatter copies through the user's home.
say "3. verify the bundled skills (nothing to copy — the bundle's provider serves them)"
for s in $SKILLS; do
  [ -f "${REPO_ROOT}/skills/${s}/SKILL.md" ] || die "skills/${s}/SKILL.md is missing from the repository."
  want=$(grep -m1 '^name:' "${REPO_ROOT}/skills/${s}/SKILL.md" | sed 's/^name:[[:space:]]*//')
  [ "$want" = "$s" ] || die "skills/${s}: frontmatter name is '$want'; the provider reads the frontmatter, not the directory."
  if [ -d "${DSH_HOME}/skills/${s}" ]; then
    info "${s}: a copy also exists in ${DSH_HOME}/skills — redundant, the provider is authoritative"
  else
    info "${s}: served by the bundle's provider"
  fi
done
[ -f "${REPO_ROOT}/extensions/dsh/index.js" ] || die "extensions/dsh/index.js is missing — the bundle has no skill provider."

# --- 4. nothing to install ------------------------------------------------
# The aegis prefix bridge and its optional description swap both live in the
# bundle's own extensions/dsh/ and are mounted by a row the generator emits —
# aegis-prefix.js by `cordis.patch.yml`. There is no companion plugin, which is
# deliberate: the prefix and the swap used to be separate plugins, and because
# both mutate the same skill registrations they raced — the split produced 4 of
# 22 descriptions localised and two bare names leaking back. One plugin doing
# both in a single registration pass is what removed the race.
say "4. nothing to install — extensions/dsh/ does this inside the bundle"

# --- 5. what the user must do by hand ------------------------------------
say "5. the profile wiring (deliberate — see the header of this script)"
cat <<EOF
   A profile's own package.json and cordis.patch.yml are the live installation's
   files, and cordis.patch.yml is watched by dsh-hmr: writing it triggers an
   immediate full re-assembly. This script therefore stops here and prints the
   exact edits instead of making them.

   (a) In ~/.dsh/profiles/<profile>/package.json — add the dependency:

         "${BUNDLE_SCOPE}": "link:${DSH_HOME}/plugins/${BUNDLE_DIRNAME}"

       and add the same string to the dsh.profile.bundles array, keeping its
       position. Then run, in that profile directory:

         pnpm install

       which creates the real symlink under node_modules/@local/.

   (b) In ~/.dsh/profiles/<profile>/cordis.patch.yml — select the preset:

         - id: preset-dsh-orchestrator-preset
           name: '@deepseek-ai/dsh-agent-preset'
           config:
             selectedDefault: dsh-orchestrator-preset

   A patch REPLACES the whole row rather than deep-merging it, so a row that
   overrides config must restate every key it needs; the snippet above is the
   whole row, not an addition to a larger one.

   Inspect   ~/.dsh/profiles/<profile>/cordis.patch.yml   <- decides the preset
   Ignore    ~/.dsh/profiles/<profile>/cordis.yml        <- empty by design

   The GUI preset chooser rewrites cordis.patch.yml in place, so a preset picked
   in the GUI overwrites selectedDefault and does not restore itself. Re-apply
   (b) to come back. This script never touches that file, so re-running it is safe.

   Re-run with --check to re-verify the host gate without writing anything.
EOF

say "done."
