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
# Thirteen checks, two of which were wrong as originally written. What changed:
#
#   1. selectedDefault in the profile patch            unchanged — still valid
#   2. the bundle link is a real symlink               unchanged — test -L, not -e
#   3. the bundle is readable THROUGH the link         unchanged — present != usable
#   4. the patch generator is in sync                 CHANGED — see below
#   5. which preset is actually selected               REPLACED — see below
#   6. the four orch-* skills come from this bundle    ADDED — presence is not isolation
#   7. the two shell rows read as deliberate           ADDED — enabled/disabled by choice
#   8. leak gate over the shipped tree                 ADDED — names and paths, see below
#   9. every aegis-* routing target resolves           ADDED — a dangling row fails silently
#  10. the zh description table still matches         ADDED — a stale key fails silently
#  11. no client-bundle declaration comes back        ADDED — dead by construction
#  12. what npm would publish is what files says      ADDED — a directory entry sweeps the working tree
#  13. the lane deny lists are not machine-specific   ADDED — a name this machine lacks breaks the lane on the next one
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

# --- the two artifacts this script compares, each overridable --------------
# DENY_JSON is check 13's subject (the artifact the generator writes) and check 9's
# source for the bridge switch; INSTALLED_JSON is the installed snapshot, resolved
# further down once the bundle link is known. Each has an override so the
# comparisons themselves can be driven with a deliberately broken copy — this
# script's own rule is that a check which cannot fail is not a check, and that
# applies to its own gates as much as to the host's.
DENY_JSON="${VERIFY_DENY_JSON:-$REPO_ROOT/cordis.patch.yml}"

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

# ── Which KEY is the bundle linked under? ────────────────────────────────────
# ⚠️ The key is an ALIAS, and it is deliberately not the same string everywhere.
#    A locally staged copy that occupied the already-published key could not be
#    told apart from the npm package of the same name, and a resolver that quietly
#    returned the published one instead of the local projection would be silently
#    wrong. That is the reason the keys were kept distinct, and it stands as the
#    general rule.
#    ⚠️ This repository now takes a DELIBERATE, user-approved exception to it:
#    `install.sh` stages the bundle locally and links it under the npm name itself
#    — `@quill507/dsh-orchestrator-preset` — so every profile carries ONE key and
#    the hardcoded `@local/…` path (which is how this script used to fail a
#    perfectly healthy web profile while desktop passed) is gone at the source.
#    The cost of the exception is real and accepted: a local projection under the
#    published name is told apart from the npm package by WHERE IT POINTS, not by
#    its name, so a resolver that returns the published one stays silent. Both
#    forms still work at runtime; a profile may carry `@quill507/…`, `@local/…`, or
#    a third key.
#    ⇒ So we do NOT guess a key. We DISCOVER the link and judge it by IDENTITY:
#      (1) a REAL symlink exists under this profile's node_modules — `test -L`,
#          not `test -e`, because a link some tool silently degraded into a copy
#          passes `test -e` and then freezes every later edit to the bundle;
#      (2) read THROUGH that link: the TARGET directory's package.json `name`;
#      (3) that name must equal the one in THIS repo's package.json (read above,
#          never hardcoded here).
#    The key may be `@quill507/…`, `@local/…`, or a third thing; the identity may
#    not be wrong. A link aimed at a directory whose `name` differs MUST fail — if
#    we accepted "some symlink exists", the check could not fail, and a check that
#    cannot fail is not a check.
BUNDLE_NAME="$(node -e "
  const fs = require('node:fs');
  process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).name || '');
" "$REPO_ROOT/package.json" 2>/dev/null)"
if [ -z "$BUNDLE_NAME" ]; then
  echo "!! cannot read the package name from $REPO_ROOT/package.json" >&2
  exit 2
fi

# Emits one line per node_modules entry whose TARGET package.json carries our
# name: "<kind>\t<relative-path>", where kind is `link` or `dir`. Real directories
# are reported too (not just links) so that check 2 can still say the useful
# thing — "it is there, but it is a copy" — instead of a bare "missing".
BUNDLE_ENTRIES="$( cd -- "$PROFILE_DIR" && BUNDLE_NAME="$BUNDLE_NAME" node --input-type=module -e '
  import { readdirSync, lstatSync, readFileSync, realpathSync, existsSync } from "node:fs";
  import { join } from "node:path";
  const want = process.env.BUNDLE_NAME;
  const nm = join(process.cwd(), "node_modules");
  const out = [];
  const consider = (rel) => {
    const abs = join(nm, rel);
    let st;
    try { st = lstatSync(abs); } catch { return; }
    const kind = st.isSymbolicLink() ? "link" : (st.isDirectory() ? "dir" : null);
    if (!kind) return;
    let pkg;
    try { pkg = join(realpathSync(abs), "package.json"); } catch { return; }
    if (!existsSync(pkg)) return;
    let name = "";
    try { name = JSON.parse(readFileSync(pkg, "utf8")).name || ""; } catch { return; }
    if (name !== want) return;                 // identity gate — the key is ignored
    out.push(kind + "\t" + rel);
  };
  let top = [];
  try { top = readdirSync(nm, { withFileTypes: true }); } catch { process.exit(3); }
  for (const e of top) {
    if (e.name.startsWith(".")) continue;
    if (e.name.startsWith("@")) {
      let inner = [];
      try { inner = readdirSync(join(nm, e.name), { withFileTypes: true }); } catch {}
      for (const s of inner) consider(e.name + "/" + s.name);
    } else consider(e.name);
  }
  process.stdout.write(out.join("\n"));
' 2>/dev/null )" || BUNDLE_ENTRIES=""

# Exactly one symlink must carry our identity. Anything else is reported by kind.
BUNDLE_N_LINK="$(printf '%s\n' "$BUNDLE_ENTRIES" | grep -c '^link	' || true)"
BUNDLE_N_DIR="$(printf '%s\n' "$BUNDLE_ENTRIES" | grep -c '^dir	' || true)"
BUNDLE_LINK=""
if [ "$BUNDLE_N_LINK" = "1" ]; then
  BUNDLE_LINK="$PROFILE_DIR/node_modules/$(printf '%s\n' "$BUNDLE_ENTRIES" | grep '^link	' | head -1 | cut -f2)"
  BUNDLE_KEY="$(printf '%s\n' "$BUNDLE_ENTRIES" | grep '^link	' | head -1 | cut -f2)"
fi

if [ ! -d "$PROFILE_DIR" ]; then
  echo "!! no such profile: $PROFILE_DIR" >&2
  exit 2
fi

# ===========================================================================
# Does THIS profile have to select this preset?
# ===========================================================================
# The selection checks (1 and 5's selection leg) ask a real question — "is this
# preset the one this profile runs?" — but the answer is not always "yes", and
# conflating the two states is what made `web` look broken while it was healthy.
#
#   * `desktop` runs this preset: its patch says
#     `selectedDefault: dsh-orchestrator-preset`, and if that line ever disappears
#     the preset has silently stopped being what the user actually runs. FAIL.
#   * `web` deliberately selects the shipped `standard` preset instead. That is a
#     choice the user made in their own profile, not a defect in this package:
#     `~/.dsh/profiles/**` is off-limits to install.sh, and DSH presets are chosen
#     per workspace, so `selectedDefault` there is only the fallback an API-created
#     session gets. Asserting this preset is selected would be asserting the user's
#     configuration is wrong. WARN.
#
# So the expectation is DECLARED per profile, and it fails closed: a profile not
# named here must select this preset. A blanket downgrade of check 1/5 to WARN
# would have been the other way to make `web` green, and it would have blinded
# this script to the one regression it exists to catch — desktop losing its
# selection. Adding a profile that legitimately selects something else means
# adding it here, on purpose, with a reason.
case "$PROFILE" in
  web)
    SELECTION_EXPECTED=0
    SELECTION_WHY="profile 'web' selects the shipped 'standard' preset on purpose (user's own profile; presets are chosen per workspace, so this key is only the API fallback)"
    ;;
  *)
    SELECTION_EXPECTED=1
    SELECTION_WHY="profile '$PROFILE' is not declared as selecting another preset, so it must select this one"
    ;;
esac

# One place decides how a failed selection expectation is reported, so check 1 and
# check 5 cannot drift into disagreeing about it.
selection_verdict() {  # $1 = message, $2 = indented evidence line(s)
  if [ "$SELECTION_EXPECTED" = "1" ]; then
    bad "$1"
    note "why this is required: $SELECTION_WHY"
  else
    warn "$1"
    note "not a failure: $SELECTION_WHY"
  fi
  [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/      /'
  return 0
}

# ===========================================================================
head_ "check 1 — the profile patch selects this preset (unchanged form)"
# ===========================================================================
# Still valid exactly as originally written. The row lives in the profile's own
# patch layer, so a plain anchored grep is the right instrument.
n="$(grep -c 'selectedDefault: dsh-orchestrator-preset$' "$PATCH_YML" 2>/dev/null || echo 0)"
if [ "$n" = "1" ]; then
  ok "check 1  selectedDefault: dsh-orchestrator-preset occurs exactly once in the profile patch"
else
  selection_verdict \
    "check 1  expected exactly 1 occurrence, found $n  ($PATCH_YML)" \
    "$(grep -n 'selectedDefault:' "$PATCH_YML" 2>/dev/null || echo '(no selectedDefault line at all)')"
fi

# ===========================================================================
head_ "check 2 — the bundle link is a REAL symlink (unchanged form)"
# ===========================================================================
# This distinction is the whole point of the check. `test -e` follows a symlink,
# so a link that some tool silently degraded into a real directory COPY still
# passes it — and a copy freezes the bundle while every later edit to the real
# bundle is ignored. Only `test -L` asks the question we actually mean.
# The path is no longer assumed: it is the one discovered above BY IDENTITY, so
# this check passes whichever key the profile happens to use.
if [ -z "$BUNDLE_LINK" ]; then
  if [ "$BUNDLE_N_DIR" -gt 0 ] 2>/dev/null; then
    bad "check 2  it is there, but NOT a symlink — a copy would freeze the bundle"
    note "test -e would have passed this; test -L is why the check exists"
    note "$(printf '%s\n' "$BUNDLE_ENTRIES" | grep '^dir	')"
  elif [ "$BUNDLE_N_LINK" -gt 1 ] 2>/dev/null; then
    bad "check 2  ambiguous: $BUNDLE_N_LINK symlinks in node_modules all carry our name"
    note "$(printf '%s\n' "$BUNDLE_ENTRIES" | grep '^link	')"
    note "a profile should link this bundle exactly once"
  else
    bad "check 2  no entry in $PROFILE_DIR/node_modules is a bundle called $BUNDLE_NAME"
    note "the key is an alias; this gate judges the TARGET's package.json name"
    note "add the link: dependency to the profile's package.json, then pnpm install"
  fi
elif [ -L "$BUNDLE_LINK" ]; then
  ok "check 2  $BUNDLE_KEY is a real symlink"
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
# ⚠️ CHANGED FORM. This used to `require.resolve()` the bundle by its **npm name**
#    from the profile. That works only when the link key IS the npm name, which is
#    the desktop layout — so on web it reported "not resolvable by package name" for
#    a bundle that resolves fine. Resolution-by-name is therefore the wrong
#    instrument: it re-asks the key question this script already answered by
#    identity. Read THROUGH the discovered link instead and assert the identity:
#    the target directory's package.json `name` must equal the repo's own.
#    Failable by construction — aim the link at a directory with a different `name`
#    and this exits 1.
if [ -n "$BUNDLE_LINK" ] && { [ -L "$BUNDLE_LINK" ] || [ -e "$BUNDLE_LINK" ]; }; then
  if ( BUNDLE_LINK="$BUNDLE_LINK" BUNDLE_NAME="$BUNDLE_NAME" node --input-type=module -e '
       import { readFileSync, realpathSync } from "node:fs";
       const real = realpathSync(process.env.BUNDLE_LINK);
       const pkg = JSON.parse(readFileSync(real + "/package.json", "utf8"));
       if (pkg.name !== process.env.BUNDLE_NAME) {
         process.stderr.write("target package.json name is `" + pkg.name +
           "`, expected `" + process.env.BUNDLE_NAME + "`\n");
         process.exit(1);
       }
       process.stdout.write(real + "\t" + pkg.name);' ) >"$TMP/resolved" 2>"$TMP/resolve.err"; then
    ok "check 3  the bundle reads through the link and its name is $BUNDLE_NAME"
    note "-> $(cat "$TMP/resolved")"
  else
    bad "check 3  the link does not read through as $BUNDLE_NAME:"
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
    # Same declared expectation as check 1 — one decision, reported in both places.
    # ⚠️ Only the SELECTION leg is conditional. The two legs below are about this
    #    package's own artifact (a stale name, a missing row) and stay hard for
    #    every profile: they are wrong regardless of which preset the profile runs.
    selection_verdict \
      "check 5  the composed tree does NOT select this preset" \
      "$(grep -n 'selectedDefault:' "$TMP/composed.yml" 2>/dev/null | head -3 || echo '(no selectedDefault line in the composed tree)')"
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
# publish what this installation has installed, which is one machine's
# environment rather than this project's. So the list lives in a local,
# uncommitted file. Absent that file the gate still runs its shape rules and says
# so out loud, rather than passing quietly on less coverage than it looks like it
# has.
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
#
# ⚠️ CHANGED FORM (F2). The bridge is a FILE **plus a SWITCH**, and this check
#    used to test only the file. `apply()` reads `prefixAegisSkills` and returns
#    before renaming anything when it is false (aegis-prefix.js:299-302), so the
#    file being present while the switch is off leaves every routing row dangling
#    — and the old predicate PASSED on exactly that state. "The bridge is
#    installed" is not "the bridge runs".
#
#    Which layer the switch is read from: the ARTIFACT, not the declaration.
#    `preset-declaration.mjs` is the single source of truth, but its only route to
#    a running host is through the rendered row the Loader evaluates — the
#    declaration's value never reaches the host by itself. Check 4 already gates
#    declaration→artifact sync, so reading the declaration here as well would put
#    the same fact in two places and answer a question this check does not own.
#    The artifact is read with the host's own patch parser, so the `!!js` dialect
#    and the indentation are the ones the Loader reads.
PREFIX_PLUGIN="$REPO_ROOT/extensions/dsh/aegis-prefix.js"
PREFIX_SWITCH=""
if [ -f "$PREFIX_PLUGIN" ] && [ -f "$DENY_JSON" ]; then
  ( cd -- "$DSH_PKG_ROOT" && ARTIFACT="$DENY_JSON" node --input-type=module -e '
import { loadOverlayPatches } from "@deepseek-ai/dsh-app-boot"
const patches = loadOverlayPatches("verify-install", process.env.ARTIFACT)
const rows = []
const walk = (node) => {
  if (Array.isArray(node)) { for (const item of node) walk(item); return }
  if (node === null || typeof node !== "object") return
  if (typeof node.id === "string") rows.push(node)
  for (const value of Object.values(node)) walk(value)
}
walk(patches)
const row = rows.find((r) => r.id === "orch-aegis-prefix")
if (!row) { console.log("SWITCH=<no-row>"); process.exit(0) }
const value = (row.config || {}).prefixAegisSkills
console.log("SWITCH=" + (typeof value === "boolean" ? value : "<not-a-boolean: " + JSON.stringify(value) + ">"))
' ) >"$TMP/bridge.txt" 2>"$TMP/bridge.err"
  PREFIX_SWITCH="$(sed -n 's/^SWITCH=//p' "$TMP/bridge.txt" | head -1)"
fi

if [ -f "$PREFIX_PLUGIN" ] && [ "$PREFIX_SWITCH" = "true" ]; then
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
  # Three distinct states, three distinct messages — collapsing them would hide
  # which one is true. A missing FILE and a present-but-disabled SWITCH both leave
  # the routing table dangling, and both are now red.
  if [ ! -f "$PREFIX_PLUGIN" ]; then
    bad "check 9  extensions/dsh/aegis-prefix.js is missing — the routing table has no bridge to the bare names"
  else
    bad "check 9  the bridge is installed but its switch is NOT ON in $DENY_JSON (orch-aegis-prefix prefixAegisSkills=${PREFIX_SWITCH:-<unreadable>}) — apply() returns before renaming anything, so every routing target is dangling"
    [ -s "$TMP/bridge.err" ] && note "$(head -3 "$TMP/bridge.err" | tr '\n' ' ')"
  fi
fi

# ===========================================================================
head_ "check 10 — the zh description table still matches the installed pack"
# ===========================================================================
# The description swap matches on the English text verbatim, so an upstream
# rewrite silently falls through to English. That is the right failure direction
# — better English than garbled Chinese — but it is invisible, and the table rots
# one skill at a time. This check turns the rot into a number.
#
# Falsifiable by construction: it compares the table against the pack on disk, so
# upgrading aegis turns it red exactly when a key stops matching.
PREFIX_PLUGIN="$REPO_ROOT/extensions/dsh/aegis-prefix.js"
if [ -f "$PREFIX_PLUGIN" ] && [ -d "$PROFILE_DIR/node_modules/aegis/skills" ]; then
  zhrc=0
  node -e '
    const fs = require("node:fs"), path = require("node:path")
    const [, pluginPath, packRoot] = process.argv
    const src = fs.readFileSync(pluginPath, "utf8")
    // The table is an array of [en, zh] pairs; pull the first element of each.
    const start = src.indexOf("const ZH_DESCRIPTIONS = [")
    const end = src.indexOf("\n]", start)
    const body = src.slice(start, end)
    const keys = []
    let pos = 0
    for (;;) {
      // Entries are [en, zh] pairs. The en side is single-quoted unless the text
      // itself contains an apostrophe, in which case it is double-quoted — and an
      // extractor that only knew one of the two silently skipped those entries and
      // reported the newest of them as a stale key.
      const i1 = body.indexOf("[\u0027", pos)
      const i2 = body.indexOf("[\u0022", pos)
      let i = -1, q = "\u0027"
      if (i1 < 0 && i2 < 0) break
      if (i1 < 0) { i = i2; q = "\u0022" } else if (i2 < 0) { i = i1 } else { i = Math.min(i1, i2); if (i2 < i1) q = "\u0022" }
      let j = i + 2
      while (j < body.length) {
        if (body[j] === "\\") { j += 2; continue }
        if (body[j] === q) break
        j++
      }
      keys.push(body.slice(i + 2, j))
      pos = j + 1
    }
    const set = new Set(keys)
    const misses = []
    let total = 0
    for (const d of fs.readdirSync(packRoot)) {
      const f = path.join(packRoot, d, "SKILL.md")
      if (!fs.existsSync(f)) continue
      const dl = fs.readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("description:"))
      if (!dl) continue
      let desc = dl.slice("description:".length).trim()
      if (desc.length > 1 && ((desc[0] === "\u0022" && desc[desc.length - 1] === "\u0022") || (desc[0] === "\u0027" && desc[desc.length - 1] === "\u0027"))) desc = desc.slice(1, -1)
      total++
      if (!set.has(desc)) misses.push(d)
    }
    console.log("KEYS=" + keys.length + " TOTAL=" + total + " MISS=" + misses.length)
    if (misses.length) console.log("MISSING=" + misses.join(","))
  ' "$PREFIX_PLUGIN" "$PROFILE_DIR/node_modules/aegis/skills" >"$TMP/zh.txt" 2>"$TMP/zh.err" || zhrc=$?
  zhline="$(cat "$TMP/zh.txt" 2>/dev/null | head -1)"
  if [ "$zhrc" -ne 0 ] || [ -z "$zhline" ]; then
    warn "check 10  the zh table could not be read ($(head -1 "$TMP/zh.err" 2>/dev/null))"
  else
    zkeys="$(printf '%s' "$zhline" | sed -n 's/.*KEYS=\([0-9]*\).*/\1/p')"
    zmiss="$(printf '%s' "$zhline" | sed -n 's/.*MISS=\([0-9]*\).*/\1/p')"
    if [ "$zmiss" = "0" ]; then
      ok "check 10  all $zkeys zh keys match the installed pack"
    else
      bad "check 10  $zmiss of $zkeys zh keys no longer match the pack — those skills will show English:"
      sed -n 's/^MISSING=//p' "$TMP/zh.txt" | tr ',' '\n' | sed 's/^/      /'
    fi
  fi
else
  warn "check 10  skipped: no aegis pack under the profile, or the prefix plugin is absent"
fi

# ===========================================================================
head_ "check 11 — no client-bundle declaration comes back into this package"
# ===========================================================================
# The browser half was withdrawn as measured-dead, not as deferred: a preset's
# rows are mounted into a detached `PresetTree` (mountPreset() -> new
# PresetTree(ctx) + tree.root.update()), while the client-bundle scanner
# (@deepseek-ai/dsh-client-modules) enumerates the ROOT loader tree — so a
# `dsh.client` declaration in this package's manifest is never read and the
# bundle it names is never served. Nothing in this repository can make one work,
# which leaves exactly one question a gate can answer: whether one comes back.
#
# Falsifiable by construction, twice over: put the declaration back into
# package.json, or drop a native plugin out of the exports map, and this goes
# red. The scan parses package.json instead of grepping it and skips comment
# lines in the JS, because this repository explains `dsh.client` in prose — so a
# plain text search would fire on the explanation, not on a declaration, and a
# gate that cannot tell those apart is a gate that gets deleted the first time
# it cries wolf.
node -e '
  const fs = require("node:fs"), path = require("node:path")
  const root = process.argv[1]
  const hits = []
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  } catch (e) {
    console.log("PARSE_ERROR=" + e.message)
    process.exit(3)
  }
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k)
  if (own(pkg.dsh, "client")) hits.push("package.json: a client key on the dsh object")
  if (own(pkg.exports, "./client")) hits.push("package.json: an exports entry ./client")
  const dir = path.join(root, "extensions", "dsh")
  const rows = fs.readdirSync(dir).filter((f) => f.endsWith(".js"))
  for (const f of rows) {
    const file = path.join(dir, f)
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      const t = line.trim()
      // Comment lines are exactly where this repository TALKS about dsh.client.
      if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*") || t.startsWith("#")) return
      if (/\bdsh\s*\.\s*client\b/.test(line)) hits.push(file + ":" + (i + 1) + ": " + t)
    })
  }
  console.log("ROWS=" + rows.length)
  for (const h of hits) console.log("HIT " + h)
  const natives = ["./extensions/dsh/index.js", "./extensions/dsh/aegis-prefix.js"]
  const gone = natives.filter((k) => !own(pkg.exports, k))
  console.log("NATIVE_MISSING=" + gone.length + (gone.length ? " " + gone.join(",") : ""))
' "$REPO_ROOT" >"$TMP/decl.txt" 2>"$TMP/decl.err"
drc=$?
if [ "$drc" -ne 0 ]; then
  bad "check 11  the declaration scan could not run (exit $drc) — an unscanned tree is not a clean one:"
  sed 's/^/      /' "$TMP/decl.err" | head -3
else
  dhits="$(sed -n '/^HIT /p' "$TMP/decl.txt")"
  drows="$(sed -n 's/^ROWS=//p' "$TMP/decl.txt")"
  if [ -n "$dhits" ]; then
    bad "check 11  a client-bundle declaration is back in this package's own files:"
    printf '%s\n' "$dhits" | sed 's/^/      /'
  else
    ok "check 11  no dsh.client declaration in package.json or its $drows extension files"
  fi
  # The reason, printed beside the verdict it explains rather than only in the
  # comment above: the next reader meets it at the failure, not before one.
  note "a preset's rows live in a detached PresetTree the client-bundle scanner never walks, so such a declaration is dead code by construction — adding one back is a fixed route to a browser bundle that is never served."
  dmiss="$(sed -n 's/^NATIVE_MISSING=\([0-9]*\).*/\1/p' "$TMP/decl.txt")"
  if [ "$dmiss" = "0" ]; then
    ok "check 11  both native plugins are still declared in exports (index.js + aegis-prefix.js)"
  else
    bad "check 11  a native plugin has left the exports map: $(sed -n 's/^NATIVE_MISSING=[0-9]* //p' "$TMP/decl.txt")"
  fi
fi

# ===========================================================================
head_ "check 12 — what npm would publish is still what package.json's files says"
# ===========================================================================
# 0.1.0 published 32 files — its whole tracked tree, author tools included — and
# nothing inside the package said so: a manifest with no `files` field publishes
# whatever the packer walks. The repair is a positive whitelist, and it is
# invisible from inside the tarball, so it is gated here in two halves, each
# falsified by hand before this comment was written.
#
# Half 1: the array must exist, and must name nothing that resolves under tools/.
# npm's `files` has no `!` negation, so "the author tools stay out" is expressed
# only as tools/ being ABSENT from a positive list — one added entry undoes the
# whole repair, which is what makes it worth asserting rather than trusting.
#
# Half 2: a DIRECTORY entry publishes that directory's WORKING TREE, not its
# tracked set. Measured, not assumed: with `tools` in the array, the packer swept
# up the untracked, git-ignored needles file alongside the four author tools. So
# every directory entry is walked and every file under it is asked whether git
# would ignore it. git check-ignore is index-aware, which is exactly the question
# being asked: a tracked file is published either way, while an untracked ignored
# file reaches the tarball only because a directory entry swept it up. A git
# failure counts as a failure, not as a clean answer.
FILES_ENTRIES=()
files_probe="$(node -e '
  const fs = require("node:fs")
  let pkg
  try { pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8")) }
  catch { console.log("PARSE_ERROR"); process.exit(0) }
  if (!Array.isArray(pkg.files)) { console.log("NO_FILES_ARRAY"); process.exit(0) }
  for (const f of pkg.files) console.log("FILES_ENTRY=" + f)
' "$REPO_ROOT/package.json" 2>"$TMP/files.err")"
while IFS= read -r line; do
  case "$line" in
    FILES_ENTRY=*) FILES_ENTRIES+=("${line#FILES_ENTRY=}") ;;
  esac
done <<< "$files_probe"

if [ -z "$files_probe" ]; then
  bad "check 12  package.json could not be read for a files array — nothing was gated"
  note "$(head -2 "$TMP/files.err" | tr '\n' ' ')"
elif case "$files_probe" in *NO_FILES_ARRAY*) true ;; *) false ;; esac; then
  bad "check 12  package.json has NO files array — npm publishes the walked tree, author tools included (the 0.1.0 defect)"
elif case "$files_probe" in *PARSE_ERROR*) true ;; *) false ;; esac; then
  bad "check 12  package.json does not parse as JSON — the files gate cannot be read out of it"
else
  tools_hits=0
  for e in "${FILES_ENTRIES[@]}"; do
    norm="${e#./}"; norm="${norm%/}"
    case "$norm" in
      tools|tools/*)
        bad "check 12  files names a path under tools/: $e"
        tools_hits=$((tools_hits+1)) ;;
    esac
  done
  [ "$tools_hits" -eq 0 ] &&
    ok "check 12  files holds ${#FILES_ENTRIES[@]} entries and none of them resolves under tools/"

  # Every directory entry is walked. A `dir/*` entry publishes the directory just
  # as a bare `dir` does, so both spellings are resolved to the directory.
  dirs=0; walked=0; ignored_hits=0
  for e in "${FILES_ENTRIES[@]}"; do
    d="${e%/}"
    case "$d" in */'*') d="${d%/\*}" ;; esac
    [ -n "$d" ] || continue
    [ -d "$REPO_ROOT/$d" ] || continue
    dirs=$((dirs+1))
    while IFS= read -r f; do
      rel="${f#"$REPO_ROOT"/}"
      walked=$((walked+1))
      git -C "$REPO_ROOT" check-ignore -q -- "$rel"; rc=$?
      if [ "$rc" -eq 0 ]; then
        bad "check 12  the published set sweeps up a git-ignored file: $rel (a directory entry in files)"
        ignored_hits=$((ignored_hits+1))
      elif [ "$rc" -ne 1 ]; then
        bad "check 12  git check-ignore exited $rc on $rel — an unasked question is not a clean answer"
        ignored_hits=$((ignored_hits+1))
      fi
    done < <(find "$REPO_ROOT/$d" -type f | sort)
  done
  if [ "$dirs" -eq 0 ]; then
    warn "check 12  none of the ${#FILES_ENTRIES[@]} entries is a directory — the ignored-file walk did not run"
  elif [ "$ignored_hits" -eq 0 ]; then
    ok "check 12  no git-ignored file under the $dirs directory entries of files ($walked files walked)"
  fi
  # The reason, beside the verdict it explains rather than only in the comment
  # above: the inventory is not what `git ls-files` would give, and the whitelist
  # is not a filter — which is why the array's exact contents are the gate.
  note "check 12  npm's files has no '!' negation, so tools/ stays out only by being ABSENT from the list"
  note "check 12  a directory entry ships the WORKING TREE: $dirs entries walked, $walked files asked, $ignored_hits ignoring"
fi

# ===========================================================================
head_ "check 13 — the lane deny lists name no tool that only THIS machine is guaranteed to have"
# ===========================================================================
# The MCP loader tools are named `mcp_<server>` and are generated by
# dsh-mcp-loader from the servers THE USER configured. Writing those names into a
# lane's toolFilter.deny does not fail at mount: it fails on the first delegation,
# because tools.restrict() rejects every name that is not a globally registered
# tool (dsh-tools/lib/index.js:2895-2910, "names unknown global tool"). A machine
# that does not have those servers — any freshly installed preset — therefore
# cannot create that lane at all. This machine cannot reproduce the failure: it
# happens to have all four servers, which is exactly why this gate SIMULATES the
# other machine instead of asking the live one.
#
# It parses the generated artifact with the host's own patch parser (so the `!!js`
# dialect and the indentation are the ones the Loader reads), then evaluates each
# lane's deny value with the Loader's own evaluator twice: once on a machine with
# no MCP server, once on this one (four servers + a loaderName override + an eager
# server). Four things are asserted, and every one of them was seen firing while
# this check was written: the stale installed artifact tripped "deny is not an
# expression"; putting the literal mcp_* names back tripped "the empty machine
# names a tool it does not have"; deleting the closure from the generator tripped
# "the MCP machine lost mcp_playwright"; dropping the mode check tripped "names
# the loader of an eager server, which the startup probe disposes".
# The artifact this check reads is the one the generator writes (check 4 proves it
# is in sync); `DENY_JSON` was resolved at the top because check 9 reads the same
# artifact for the bridge switch. The INSTALLED bundle is a separate copy of this tree, and a copy can
# lag: the same defect then still ships from the installed preset while the source
# is clean. That is not this gate's verdict — but it is the one fact a green check
# here would otherwise hide, so it is printed beside it.
INSTALLED_JSON="${VERIFY_INSTALLED_JSON:-$BUNDLE_LINK/cordis.patch.yml}"
if [ ! -f "$DENY_JSON" ]; then
  bad "check 13  no artifact to evaluate at $DENY_JSON — nothing was evaluated"
else
  # The "old host" base: a directory that exists but carries no node_modules, so
  # resolving @deepseek-ai/dsh-tool-schedule from it fails — the shape of a
  # 0.2.0-rc.2 install. Made fresh so the check never depends on a leftover path.
  mkdir -p "$TMP/deny-empty"
  ( cd -- "$DSH_PKG_ROOT" && ARTIFACT="$DENY_JSON" DSH_PKG_ROOT="$DSH_PKG_ROOT" DENY_EMPTY_BASE="$TMP/deny-empty" node --input-type=module -e '
import { loadOverlayPatches } from "@deepseek-ai/dsh-app-boot"

// Names every machine has because rows this preset itself mounts register them.
// ⚠️ `schedule_*` are in this list only in the CONDITIONAL sense, and the third
// machine below is what keeps that honest: the four names are named by a row this
// preset mounts (tool-schedule), and the deny tail that adds them is gated on the
// SAME fact that gates that row (can `@deepseek-ai/dsh-tool-schedule` be resolved
// from this host). Host 0.2.0-rc.2 — npm `latest`, and the runtime the Desktop app
// bundles — does not ship that package at all, so on such a host neither the row
// nor the four deny names may appear; that is asserted, not assumed.
const SCHEDULE_NAMES = ["schedule_create", "schedule_delete", "schedule_list", "schedule_update"]
const PORTABLE = ["write", "edit", "todo_write", "ask_user_question", "exit_plan_mode",
  "send_message", "interrupt_agent", "list_agents",
  "subagent_children", "subagent_send", "subagent_interrupt", "subagent_fork",
  "subagent_scout", "subagent_archivist", "subagent_seer", "subagent_reader",
  "subagent_analyst", "subagent_auditor", "subagent_wright", "subagent_forge", "subagent_planner",
  ...SCHEDULE_NAMES]
const portable = new Set(PORTABLE)

// A machine with no MCP server at all: no loader row, so no mcp_* name exists.
// A machine like this one: the four servers, plus a loaderName override and an
// eager server (whose loader the startup probe disposes, so naming it would name
// a tool that no longer exists).
const MCP_ROW = { disabled: false, options: { id: "mcp-loader", name: "dsh-mcp-loader", config: {
  singleToolThreshold: 0, servers: { playwright: {}, jlceda: { mode: "lazy" }, "cloudflare-browser": {},
    "desktop-touch": {}, "eager-one": { mode: "eager" }, renamed: { loaderName: "custom_loader" } } } } }
const EXPECTED_MCP = ["mcp_playwright", "mcp_jlceda", "mcp_cloudflare-browser", "mcp_desktop-touch", "custom_loader"]
// The third axis: whether this HOST ships @deepseek-ai/dsh-tool-schedule. It is a
// property of the host, not of the user config, so it is a third machine rather
// than a third server in MCP_ROW. `baseUrl` is the Loader entry context base the
// real `!!js` expressions see (cordis-plugin-loader: `Entry.ctx = loader.ctx.extend({ baseUrl })`).
// The "old" host points at a directory that exists but has no node_modules, which
// is exactly the shape of a 0.2.0-rc.2 install: resolution fails.
const HOST_WITH_SCHEDULE = { baseUrl: process.env.DSH_PKG_ROOT + "/package.json" }
const HOST_WITHOUT_SCHEDULE = { baseUrl: process.env.DENY_EMPTY_BASE + "/package.json" }
const machines = {
  none: { ...HOST_WITH_SCHEDULE, get: () => undefined, loader: { entries: () => [] } },
  mcp: { ...HOST_WITH_SCHEDULE, get: () => undefined, loader: { entries: () => [MCP_ROW] } },
  oldhost: { ...HOST_WITHOUT_SCHEDULE, get: () => undefined, loader: { entries: () => [] } },
}

const patches = loadOverlayPatches("verify-install", process.env.ARTIFACT)
const rows = []
const walk = (node) => {
  if (Array.isArray(node)) { for (const item of node) walk(item); return }
  if (node === null || typeof node !== "object") return
  if (typeof node.id === "string") rows.push(node)
  for (const value of Object.values(node)) walk(value)
}
walk(patches)

// The evaluator the Loader itself uses (cordis-plugin-loader lib/index.js).
const evaluate = new Function("ctx", "expr", "with (ctx) { return eval(expr) }")

const lanes = rows.filter((r) => typeof r.id === "string" && r.id.startsWith("tool-subagent-"))

// 0.2.1-alpha.3: a lane toolFilter is now ONE !!js expression yielding the filter
// object. It has to be host gated, because alpha.3 rejects the key outright on new
// hosts. Before that it was a nested mapping, toolFilter.deny. Both shapes are read
// here so this check keeps working across the support matrix.
// A lane matches when it declares either path. The fork control row still matches
// through the legacy nested path.
const filterOf = (lane, machineKey) => {
  const tf = (lane.config || {}).toolFilter
  if (tf === undefined || tf === null) return undefined
  if (typeof tf.__jsExpr === "string") {
    // Expression shape: evaluate it. An undefined result means this key does not apply
    // to this host, which is exactly the fork row schedule gate, so it is not an error.
    const value = evaluate(machines[machineKey], tf.__jsExpr)
    return value === undefined ? undefined : value
  }
  return tf
}
// A filter member (allow / deny) may itself be an expression node: the fork control row
// carries a nested toolFilter whose deny IS a !!js expression for the schedule tail.
// Evaluate it the same way, so both shapes report a plain string[].
const memberOf = (filter, key, machineKey) => {
  if (filter === undefined) return undefined
  const raw = filter[key]
  if (raw === undefined) return undefined
  if (typeof raw === "object" && raw !== null && typeof raw.__jsExpr === "string") {
    return evaluate(machines[machineKey], raw.__jsExpr)
  }
  return raw
}
const denyLanes = lanes.filter((r) => {
  const tf = (r.config || {}).toolFilter
  if (tf === undefined) return false
  if (typeof tf.__jsExpr === "string") {
    // Expression: count it as a deny row when the value yields a deny list on ANY machine.
    return Object.keys(machines).some((k) => {
      const v = filterOf(r, k)
      return v !== undefined && v.deny !== undefined
    })
  }
  return tf.deny !== undefined
})
const allowLanes = lanes.filter((r) => {
  const tf = (r.config || {}).toolFilter
  if (tf === undefined) return false
  if (typeof tf.__jsExpr === "string") {
    return Object.keys(machines).some((k) => {
      const v = filterOf(r, k)
      return v !== undefined && v.allow !== undefined
    })
  }
  return tf.allow !== undefined
})
console.log("LANES=" + lanes.length + " DENY_LANES=" + denyLanes.length + " ALLOW_LANES=" + allowLanes.length)
let bad = 0
for (const lane of denyLanes) {
  const fail = (why) => { console.log("BAD " + lane.id + " " + why); bad += 1 }
  const out = {}
  for (const key of Object.keys(machines)) {
    let v
    try { v = filterOf(lane, key) }
    catch (e) { fail("evaluating on the " + key + " machine threw: " + (e && e.message)); continue }
    out[key] = memberOf(v, "deny", key)
    if (out[key] !== undefined && (!Array.isArray(out[key]) || out[key].some((n) => typeof n !== "string"))) {
      fail("the " + key + " machine produced " + typeof out[key] + ", not a string[]")
      out[key] = undefined
    }
  }
  if (out.none === undefined || out.mcp === undefined || out.oldhost === undefined) continue
  for (const name of out.none) {
    if (!portable.has(name)) fail("on a machine with no MCP server the deny list names " + name + ", which no machine is guaranteed to register")
  }
  // The MCP legs apply to every deny row EXCEPT the fork control row, which by design
  // carries only the schedule tail (a forked child is a generic fork: narrowing its
  // other tools would be a behaviour change outside the 2026-10-10 decision). The
  // exception is named by id rather than inferred from the value — inferring it would
  // make "this lane silently lost the MCP closure" look like "this is the fork row",
  // which is exactly the regression these legs exist to catch.
  const FORK_CONTROL_ID = "tool-subagent-fork"
  if (lane.id === FORK_CONTROL_ID) {
    if (out.mcp.some((n) => EXPECTED_MCP.includes(n))) {
      fail("the fork control row carries MCP names — it is meant to carry ONLY the schedule tail (its tool surface is not narrowed beyond reminders)")
    }
  } else {
    for (const name of EXPECTED_MCP) {
      if (!out.mcp.includes(name)) fail("with MCP servers configured the deny list lost " + name + " (the boundary must survive where the tool exists)")
    }
    if (out.mcp.includes("mcp_eager-one")) fail("the deny list names the loader of an eager server, which the startup probe disposes")
  }
  // At least one axis must move the value. For the lanes that is the MCP axis; for the
  // fork row it is the host axis. A value that moves on neither is a static list
  // wearing a `!!js` costume, and a static list is what this whole check rejects.
  if (out.none.join(",") === out.mcp.join(",") && out.none.join(",") === out.oldhost.join(",")) {
    fail("the deny value is identical on all three simulated machines — it is not computed per machine")
  }
  // The host axis. Both directions matter, and each one alone is a real defect:
  //   * dropping the names on a host that HAS the package would silently widen
  //     every lane (the boundary the user asked for would be gone);
  //   * keeping them on a host that lacks it would throw `names unknown global
  //     tool` at the first delegation — which is every lane, on npm `latest`.
  for (const name of SCHEDULE_NAMES) {
    if (!out.none.includes(name)) fail("on a host that ships dsh-tool-schedule the deny list lost " + name + " — every lane would silently gain reminder tools (user decision: Lead only)")
    if (out.oldhost.includes(name)) fail("on a host WITHOUT dsh-tool-schedule the deny list still names " + name + " — restrict() throws `names unknown global tool`, so every lane delegation on 0.2.0-rc.2 would fail")
  }
  if (out.oldhost.join(",") !== out.none.filter((n) => !SCHEDULE_NAMES.includes(n)).join(",")) {
    fail("the old-host deny list differs from the no-MCP list by something other than the schedule names: " + JSON.stringify(out.oldhost) + " vs " + JSON.stringify(out.none))
  }
  console.log("OK " + lane.id + " static=" + out.none.length + " mcp=" + out.mcp.length
    + " oldhost=" + out.oldhost.length
    + " added=" + out.mcp.filter((n) => !portable.has(n)).join("|"))
}
console.log("BAD=" + bad)
process.exit(bad === 0 && denyLanes.length >= 8 ? 0 : 1)
' >"$TMP/deny13.txt" 2>"$TMP/deny13.err" )
  deny_rc=$?
  if [ ! -s "$TMP/deny13.txt" ]; then
    bad "check 13  the deny-list probe could not run (exit $deny_rc) — an unevaluated deny list is not a portable one:"
    sed 's/^/      /' "$TMP/deny13.err" | head -3
  else
    d_deny_bad="$(sed -n '/^BAD /p' "$TMP/deny13.txt")"
    d_head="$(sed -n '/^LANES=/p' "$TMP/deny13.txt")"
    # ⚠️ 取**第一个非空**的 `added=`：fork 控制行按设计不带 MCP 闭包，它的 `added=` 是空的，
    #    而它在产物里排在 9 条 lane 之前 ⇒ 取第一行会拿到空串，把「本机 MCP 贡献了哪些名字」这句话弄没。
    d_added="$(sed -n 's/^OK .* added=//p' "$TMP/deny13.txt" | grep -v '^$' | head -1)"
    if [ -n "$d_deny_bad" ]; then
      bad "check 13  a lane deny list is not portable (it names tools a machine without those MCP servers would not have):"
      printf '%s\n' "$d_deny_bad" | sed 's/^/      /'
    else
      ok "check 13  every deny row is portable: static names + the machine MCP loaders + the host-gated schedule names ($d_head)"
    fi
    if [ "$deny_rc" -ne 0 ] && [ -z "$d_deny_bad" ]; then
      bad "check 13  the probe exited $deny_rc without naming a bad lane — treat an unexplained non-zero as a failure"
    fi
    # The reason, beside the verdict it explains: what the two simulated machines
    # are, and which names the second one contributed. The residual the mechanism
    # still has belongs here, where the next reader meets this check.
    note "check 13  simulated machine A has no MCP server; machine B has the four configured servers plus one eager and one loaderName override, contributing: $d_added"
    # The third axis is a HOST property, not a user-config one, so it gets its own
    # machine rather than another server in machine B.
    note "check 13  simulated machine C is a host WITHOUT @deepseek-ai/dsh-tool-schedule (0.2.0-rc.2 — npm latest, and the Desktop app's bundled runtime): the four schedule_* names must be absent there, and present on A and B"
    note "check 13  residual: an auto-mode server with singleToolThreshold >= 1 that exposes <= that many tools is registered eagerly and loses its loader, so its computed name would not exist at dispatch time — set singleToolThreshold: 0 (or a runtime guard) to close that"
  fi
fi

# A copy can lag: the installed bundle is a snapshot of this tree, and until it is
# refreshed the defect above still ships from the installed preset while the source
# is clean. Not a verdict — the source artifact is what check 13 gates — but the
# one fact a green check here would otherwise hide.
#
# ⚠️ CHANGED FORM (F3). This used a bare `cmp -s` on the whole file, and the
#    artifact is not machine-independent byte for byte: its provenance line
#    (`# Shell source: …`) is derived on the machine that generated it, so the
#    installed copy and the repo copy differ BY CONSTRUCTION on any other machine.
#    Measured on this host: raw byte-equal = false, machine-independent = true for
#    both profiles. The result was a standing "refresh the install" on every run —
#    advice that is not just noise but wrong, since the generator's own
#    `provenanceWarnings()` states the gate has passed and that re-generating to
#    silence it would only swap one machine's fingerprint for another's.
#    ⇒ Compare the way the generator compares: `compareMachineIndependent`, the
#      single owner of "which lines do not participate in the byte comparison"
#      (it is the same function `--check` and patch-contract.test.mjs use — a
#      second copy of that rule here would be a second home for one fact).
#      A real divergence in the installed copy still fires, and now the first
#      differing line is named instead of the whole file being called stale.
if [ -f "$INSTALLED_JSON" ]; then
  ( cd -- "$REPO_ROOT" && INSTALLED_JSON="$INSTALLED_JSON" DENY_JSON="$DENY_JSON" node --input-type=module -e '
import { readFileSync } from "node:fs"
import { compareMachineIndependent, provenanceFields, provenanceLineOf, PROVENANCE_FIELDS } from "./tools/gen-cordis-patch.mjs"
const installed = readFileSync(process.env.INSTALLED_JSON, "utf8")
const repo = readFileSync(process.env.DENY_JSON, "utf8")
const verdict = compareMachineIndependent(installed, repo)
console.log("VERDICT=" + (verdict.ok ? "same" : "differs"))
if (verdict.ok) {
  const fi = provenanceFields(provenanceLineOf(installed))
  const fr = provenanceFields(provenanceLineOf(repo))
  const moved = PROVENANCE_FIELDS.filter((k) => fi[k] !== fr[k])
  console.log("PROVENANCE=" + (moved.length === 0 ? "<identical>"
    : moved.map((k) => k + ": installed=" + (fi[k] ?? "<none>") + " repo=" + (fr[k] ?? "<none>")).join("  ")))
} else {
  console.log("DIFFERENCE=" + String(verdict.difference).split("\n").join(" | "))
}
' ) >"$TMP/installed.txt" 2>"$TMP/installed.err"
  installed_verdict="$(sed -n 's/^VERDICT=//p' "$TMP/installed.txt" | head -1)"
  if [ -z "$installed_verdict" ]; then
    # Unreadable is not equal. Same rule as everywhere else here: a comparison that
    # did not run must not be reported as one that passed.
    warn "check 13  the installed artifact could not be compared ($INSTALLED_JSON)"
    [ -s "$TMP/installed.err" ] && note "$(head -3 "$TMP/installed.err" | tr '\n' ' ')"
  elif [ "$installed_verdict" = "differs" ]; then
    warn "check 13  the INSTALLED bundle artifact differs from the repo artifact in machine-independent content — refresh the install, or the old deny list is still what runs: $INSTALLED_JSON"
    note "$(sed -n 's/^DIFFERENCE=//p' "$TMP/installed.txt" | head -1)"
  else
    note "check 13  the installed bundle artifact matches the repo artifact (machine-independent content; provenance line excluded — it is derived per machine)"
    note "check 13  provenance line (not a refresh signal): $(sed -n 's/^PROVENANCE=//p' "$TMP/installed.txt" | head -1)"
  fi
fi

# ===========================================================================
printf '\n========================================\n'
printf 'SUMMARY  %d passed, %d failed  (profile: %s)\n' "$PASS" "$FAIL" "$PROFILE"
printf '========================================\n'
[ "$FAIL" -eq 0 ] || exit 1
exit 0
