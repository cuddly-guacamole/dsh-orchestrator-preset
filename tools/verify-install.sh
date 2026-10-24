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
#   1. selectedDefault in the profile patch            CHANGED — verdict is derived, see below
#   2. the bundle link is a real symlink               unchanged — test -L, not -e
#   3. the bundle is readable THROUGH the link         unchanged — present != usable
#   4. the patch generator is in sync                 CHANGED — see below
#   5. which preset is actually selected               REPLACED — see below
#   6. the four orch-* skills come from this bundle    ADDED — presence is not isolation
#   7. the two shell rows read as a real layer says   CHANGED — the layer chain is the host's, see below
#   8. leak gate over the shipped tree                 ADDED — names and paths, see below
#   9. every aegis-* routing target resolves           ADDED — a dangling row fails silently
#  10. the zh description table still matches         ADDED — a stale key fails silently
#  11. no client-bundle declaration comes back        ADDED — dead by construction
#  12. what npm would publish is what files says      ADDED — a directory entry sweeps the working tree
#  13. every lane declares the official set it may see  CHANGED — deny became official, see below
#
# Why 1/5 changed again: their selection verdict used to come from a hardcoded
# per-profile table, which was inverted against this host — it claimed desktop runs
# this preset and web deliberately does not, while the profiles say the opposite.
# The verdict is now DERIVED from the profile (`SEL_ACTUAL` / `SELECTS_US`): another
# preset is INFO, and only a DUPLICATE selection line (check 1) or a selection the
# profile declares while composition does not deliver it (check 5) still fails.
# See the block above check 1, including what that gives up.
#
# Why 13 changed: commit 362d1c8 replaced the declared `deny` list with a declared
# `official` allow-list. The lane-gate still lives in the same place; the value it
# carries is now a literal array of permitted names, and `lane-tool-gate.mjs`
# computes the deny against the live registry. The old check also asserted that the
# deny list MOVED between a simulated no-MCP and a simulated MCP machine; under a
# literal allow-list that assertion has no subject left in the artifact, so it was
# dropped rather than kept vacuously true. The proof moved, and it now lives in two
# places — neither half alone would be honest to cite:
#   * the ARTIFACT side (the literal `official` set, and the absence of a static
#     deny list left anywhere) is in `tools/patch-contract.test.mjs`; titles in the
#     check 13 section comment below;
#   * the RUNTIME side (`deny = known − official` recomputed against the LIVE
#     registry at mount and again on every `tools/change`, so a tool registered
#     after the lane mounted is still stripped) is in `tools/lane-tool-gate.test.mjs`,
#     which calls the real `apply()` with a fake `ctx.tools`. Until that file
#     existed, this half was guaranteed by construction and untested.
#
# Why 7 changed: it searched three paths and could not see the BUNDLE layers, which
# are what actually decide the top-level shell rows — so on a profile whose bundles
# force those rows it reported "no layer names it" and compared against this
# package's own declaration. The search order now comes from the host's own loader
# (`loadProfileDirectory`), bundle order included, and a chain that cannot be read is
# a FAIL rather than a fallback.
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

PASS=0; FAIL=0; INFO=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok()   { PASS=$((PASS+1)); printf 'PASS  %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$*"; }
# Neither a pass nor a fail: something did not run, and saying so is the point.
# A warning that quietly counted as a pass would be the same lie as an empty
# grep result.
warn() { printf 'WARN  %s\n' "$*"; }
# The fourth level, and it is NOT a quiet `warn`: here `warn` means "something
# did not run", and using it for a profile that simply runs a different preset
# would be a different lie. INFO is a fact about the operator's configuration
# that is neither good nor bad for this package. It increments neither counter,
# and the summary line counts it, so an INFO cannot be read as a pass.
info() { INFO=$((INFO+1)); printf 'INFO  %s\n' "$*"; }
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
# Does THIS profile select this preset? — DERIVED from the profile, not declared
# ===========================================================================
# This used to be a hardcoded per-profile table: `web -> must select`,
# `desktop -> must not`, any other profile -> must select. It was wrong about this
# host in BOTH directions — it claimed desktop runs this preset and web deliberately
# does not, while the profiles say exactly the opposite
# (`desktop/cordis.patch.yml: selectedDefault: standard`, and
# `web/cordis.patch.yml: selectedDefault: dsh-orchestrator-preset`) — because it
# encoded a fact about ONE operator's machine, not a property of this package, and a
# table cannot notice when that machine changes.
#
# So the expectation is DERIVED from the profile on disk:
#
#     SEL_ACTUAL  = the profile patch's own `selectedDefault`, or the literal <none>
#     SELECTS_US  = 1 when it is this preset, else 0
#
# A profile that runs another preset is a LEGITIMATE state, reported as INFO —
# neither a pass nor a failure: presets are chosen per workspace,
# `~/.dsh/profiles/**` is off-limits to install.sh, and this line is only the
# fallback an API-created session gets. The INFO names the preset the profile does
# run, so a reader sees `this profile selects 'standard'` rather than a bare
# "found 0".
#
# What still FAILS — on any profile, because these are defects rather than
# preferences:
#   * TWO `selectedDefault: dsh-orchestrator-preset` lines in one profile patch
#     (check 1): the default may be declared once, and a duplicated YAML key is
#     rejected by the parser — the patch is unreadable, so the host never chooses
#     between the two. Check 5's composition parse failure in the same run is the
#     same defect reached from the symptom side; this leg is what names the cause;
#   * the profile patch asks for this preset while the COMPOSED tree does not
#     select it (check 5): composition dropped a selection the profile declared,
#     which is a delivery failure rather than a choice.
#
# ⚠️ Scope limit, stated rather than implied: the duplicate leg matches THIS
#    preset's name only. A patch that names ANOTHER preset twice is INFO, and the
#    reasoning above applies to it just as well — so the check fails OPEN on a patch
#    belonging to a preset this gate was not asked to police.
#
# ⚠️ The residual blindness, stated rather than implied: a profile that silently
#    STOPS selecting this preset is now INFO, not a failure. That is the deliberate
#    price of the ruling that no profile may hard-fail for running another preset.
#    The old table bought that signal by asserting things about the operator's
#    machine that it got wrong; what is left here asserts only what holds whichever
#    preset the profile runs.

# The preset this profile's own patch actually names. Read from the profile patch,
# which is the one layer that can speak for the profile as a whole; the composed
# tree has the same line, but only after check 5 composes it.
actual_selected_default() {
  local v
  v="$(sed -n 's/^[[:space:]]*selectedDefault:[[:space:]]*//p' "$PATCH_YML" 2>/dev/null | head -1)"
  printf '%s' "${v:-<none>}"
}
composed_selected_default() {
  local v
  v="$(sed -n 's/^[[:space:]]*selectedDefault:[[:space:]]*//p' "$TMP/composed.yml" 2>/dev/null | head -1)"
  printf '%s' "${v:-<none>}"
}

SEL_ACTUAL="$(actual_selected_default)"
if [ "$SEL_ACTUAL" = "dsh-orchestrator-preset" ]; then SELECTS_US=1; else SELECTS_US=0; fi

# One place decides how a selection outcome is reported, so check 1 and check 5
# cannot drift into disagreeing about it. It takes the FACTS and chooses the level;
# neither call site writes a selection verdict of its own.
#   $1 = subject — `profile` (check 1) or `composed` (check 5)
#   $2 = check label, $3 = the count that subject produced, $4 = indented evidence
#   profile:  1 -> PASS · >1 -> FAIL (duplicate) · 0 -> INFO naming SEL_ACTUAL
#   composed: >=1 -> PASS · 0 with SELECTS_US -> FAIL (declared but not delivered)
#                     · 0 without it -> INFO naming what composition did choose
#
# The duplicate arm is the one place this function reports a CAUSE rather than a
# symptom: a duplicated key is rejected by the parser, so the patch never parses and
# the host never picks between two identical values. Check 5 then reports the
# composition parse failure, which is the same defect seen from the other side. The
# printed note stays one line because it is read in a failure log; the reasoning
# lives here.
selection_verdict() {
  local subject="$1" label="$2" count="$3" evidence="${4:-}" actual
  if [ "$subject" = "profile" ]; then
    if [ "$count" = "1" ]; then
      ok "$label  selectedDefault: dsh-orchestrator-preset occurs exactly once in the profile patch"
    elif [ "$count" -gt 1 ] 2>/dev/null; then
      bad "$label  'selectedDefault: dsh-orchestrator-preset' occurs $count times in the profile patch — the default may be declared once, and a duplicated key is rejected by the parser"
      note "this leg names the cause; the composition parse failure check 5 reports next is the same defect"
    else
      actual="$(actual_selected_default)"
      info "$label  this profile selects \`$actual\`, not this preset — a legitimate state, reported without failing the gate"
    fi
  elif [ "$subject" = "composed" ]; then
    if [ "$count" -ge 1 ] 2>/dev/null; then
      ok "$label  the composed tree really selects dsh-orchestrator-preset ($count row(s))"
    elif [ "$SELECTS_US" = "1" ]; then
      bad "$label  the profile patch asks for dsh-orchestrator-preset but the composed tree does NOT select it — composition dropped a selection the profile declared"
      note "not a preference: the operator's choice did not change, the composition failed to deliver it"
    else
      actual="$(composed_selected_default)"
      info "$label  the composed tree selects \`$actual\`, not this preset — a legitimate state, reported without failing the gate"
    fi
  else
    bad "$label  selection_verdict got an unknown subject '$subject' — refusing to report a verdict it cannot compute"
  fi
  [ -n "$evidence" ] && printf '%s\n' "$evidence" | sed 's/^/      /'
  return 0
}

# ===========================================================================
head_ "check 1 — the profile patch selects this preset (derived verdict)"
# ===========================================================================
# The row lives in the profile's own patch layer, so a plain anchored grep is the
# right instrument. Exactly one occurrence PASSes; ZERO is INFO, because another
# preset is a legitimate state; MORE THAN ONE is a defect — and it is the one
# selection defect this leg can catch that INFO cannot.
n="$(grep -c 'selectedDefault: dsh-orchestrator-preset$' "$PATCH_YML" 2>/dev/null)"
n="${n:-0}"
selection_verdict profile "check 1" "$n" \
  "$(grep -n 'selectedDefault:' "$PATCH_YML" 2>/dev/null || echo '(no selectedDefault line at all)')"

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
  c_sel="${c_sel:-0}"

  # The selection leg is decided by the SAME function as check 1 — one policy, two
  # places it is reported. ⚠️ Only this leg is conditional: the two legs below are
  # about this package's own artifact (a stale name, a missing row) and stay hard
  # for every profile, because they are wrong regardless of which preset it runs.
  selection_verdict composed "check 5" "$c_sel" \
    "$(grep -n 'selectedDefault:' "$TMP/composed.yml" 2>/dev/null | head -3 || echo '(no selectedDefault line in the composed tree)')"
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

head_ "check 7 — the shell rows read as one of the layers actually says"
# ===========================================================================
# This check follows the LAYERS instead of a memory of them. Two scopes matter,
# and they answer different questions:
#
#   (a) the PRESET'S OWN rows — nested inside `preset-dsh-orchestrator-preset` in
#       the composed tree. These are this repository's declaration, and the
#       artifact promises exactly this: `tool-bash disabled = (platform ===
#       'win32')`, `tool-pwsh disabled = (platform !== 'win32')`. Asserted
#       unconditionally, because they are ours.
#
#   (b) the TOP-LEVEL rows — the host's effective shell surface. Whichever layer
#       speaks LAST wins, and WHICH layers those are is a property of the PROFILE,
#       not of this repository. dsh-app-boot's own `readProfilePatches` composes,
#       in order (later wins):
#           every bundle in `dsh.profile.bundles` order (its cordis.patch.yml)
#             -> the profile's own cordis.patch.yml
#             -> the home cordis.patch.yml
#             -> `--patch` overlays
#       ⚠️ The profile root `cordis.yml` is NOT one of them: it is the host's
#       OUTPUT, not an input — composition runs over an empty root. The old form
#       searched it anyway, which is why it read correctly on `desktop` (whose
#       root is a dump of the previous launch) and reported "no layer names it"
#       on `web` (whose root is a four-line empty stub). That was this check's bug.
#       ⇒ The search order is taken from the host's OWN loader —
#       `loadProfileDirectory(...).layers`, already in bundle order, each layer
#       carrying its `patchPaths` — never from a hardcoded bundle list. Bundle
#       names differ per profile and per machine; enumerating the chain is the
#       host's answer, not this script's guess.
#
#       So (b) is a CONSISTENCY assertion: the composed value must equal what the
#       LAST layer that names the row actually says, and the message names that
#       layer by package (e.g. `dsh-web-app/cordis.patch.yml`). Only when the
#       chain WAS read and no layer in it names the row does the preset's own
#       declaration become the expectation.
#
# ⚠️ Two wrong forms were rejected here, and both are instructive:
#    * the original hardcoded "bash-only on Windows". On a machine where no layer
#      forces that, it failed while the artifact was correct — it encoded one
#      operator's setup as a property of the repository.
#    * flipping the expected values is the same bug mirrored: green today, red
#      the moment that layer changes back.
#    Both judged the OPERATOR's layer by the PRESET's declaration. What is
#    actually assertable is that composition applied the layers it found — so
#    that is what is asserted. The platform comes from `process.platform` (the
#    same authority the `!!js` gates see), never a hardcoded string.
#
# ⚠️ `skippedBundles` is a WARN, not a pass: dsh-app-boot skips a bundle it cannot
#    read (or whose host requirements the profile does not exempt) instead of
#    throwing, and the composed tree is then NOT the tree the profile asked for.
#    That is exactly the state in which "no layer names it" would be a lie, so it
#    is said out loud and no row is judged on the [declaration] rule in that state.
# ⛔ A chain that cannot be enumerated AT ALL is a FAIL, never a fallback to
#    `[declaration]`: that fallback is the bug this check replaced, and a chain
#    this script could not read must not be reported as a chain that is clean.
#
# Rows are EVALUATED the way the host would (they may still carry `!!js` gates),
# not pattern-matched. Every line names its scope, so a reader can tell "the
# preset declared this" from "a later layer decided it".
if [ ! -s "$TMP/composed.yml" ]; then
  bad "check 7  no composed tree to read the shell rows from"
fi
# The chain is probed even when the composed tree is missing: "which layers decide
# this row" and "what did composition produce" are two facts, and a run that has
# lost the first must say so instead of reporting the second alone.
( cd -- "$DSH_PKG_ROOT" && \
  DSH_PKG_ROOT="$DSH_PKG_ROOT" PROFILE_DIR="$PROFILE_DIR" \
  LAYER_HOME="$DSH_HOME_ABS/cordis.patch.yml" COMPOSED="$TMP/composed.yml" \
  node --input-type=module -e '
    import { readFileSync, existsSync } from "node:fs"
    import { basename, dirname } from "node:path"
    const out = (s) => process.stdout.write(s + "\n")
    // `<package>/<file>` for a bundle layer, `<profile-or-home-dir>/<file>` for a
    // layer that belongs to a directory rather than to a package.
    const labelOf = (packageName, path) =>
      (packageName ? packageName.split("/").pop() : basename(dirname(path))) + "/" + basename(path)

    let loaded
    try {
      const { loadProfileDirectory } = await import("@deepseek-ai/dsh-app-boot")
      loaded = loadProfileDirectory("dsh", process.env.PROFILE_DIR,
        process.env.DSH_PKG_ROOT + "/package.json", { userLayer: true })
    } catch (error) {
      // The chain could not be read. Say THAT, and let the shell fail on it — do
      // not let the probe exit quietly, because the caller must not fall back to
      // the declaration rule and call the result clean.
      out("CHAINFAIL " + String(error && error.message ? error.message : error).split("\n")[0])
      process.exit(0)
    }

    // The host’s own order, read off its own loader (see `readProfilePatches`):
    // bundle patches in `dsh.profile.bundles` order, then the profile patch, then
    // the home patch, then overlays. This script invokes the loader the way a
    // plain launch does, so it passes no overlays. Each layer keeps the PARSED
    // patches the loader itself produced — the same objects the Loader composes —
    // so a row is recognised by its identity, not by matching text.
    const chain = []
    for (const layer of loaded.layers) {
      chain.push({
        label: labelOf(layer.packageName, layer.patchPaths[0] ?? layer.packageDir),
        patches: layer.patches,
      })
    }
    chain.push({ label: labelOf(null, loaded.patchPath), patches: loaded.patches })
    if (process.env.LAYER_HOME && existsSync(process.env.LAYER_HOME)) {
      const { loadOverlayPatches } = await import("@deepseek-ai/dsh-app-boot")
      chain.push({
        label: labelOf(null, process.env.LAYER_HOME),
        patches: loadOverlayPatches("verify-install", process.env.LAYER_HOME),
      })
    }

    out("CHAIN layers=" + loaded.layers.length + " patches=" + chain.length +
        " skipped=" + loaded.skippedBundles.length)
    for (const skipped of loaded.skippedBundles) {
      out("SKIPPED " + skipped.packageName + " :: " + String(skipped.reason).split("\n")[0])
    }
    for (let i = 0; i < chain.length; i++) out("ORDER " + i + " " + chain[i].label)

    const composedPath = process.env.COMPOSED
    const composedText = composedPath && existsSync(composedPath) ? readFileSync(composedPath, "utf8") : ""
    if (composedText.trim() === "") { out("NOCOMPOSED"); process.exit(0) }
    const lines = composedText.split("\n")

    const evalRaw = (raw) => {
      const v = raw.replace(/^\s*disabled:\s*/, "").trim()
      if (!v.startsWith("!!js ")) return v
      try { return String(new Function("return (" + v.slice(5) + ")")()) } catch { return "unresolvable" }
    }
    // A parsed `disabled` is either a plain value or a `{ __jsExpr }` node; evaluate
    // it the way the Loader would, because a layer may still gate the row.
    const evalNode = (node) => {
      if (node === undefined) return "absent"
      if (node !== null && typeof node === "object" && typeof node.__jsExpr === "string") {
        try { return String(new Function("return (" + node.__jsExpr + ")")()) } catch { return "unresolvable" }
      }
      return String(node)
    }
    const composedValue = (id) => {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== "- id: " + id) continue
        if (/^\s*/.exec(lines[i])[0].length !== 0) continue
        const gate = lines.slice(i + 1, i + 4).find((l) => /^\s*disabled:/.test(l))
        return gate === undefined ? "absent" : evalRaw(gate)
      }
      return "missing"
    }
    const presetValue = (id) => {
      const start = lines.findIndex((l) => /^\s*- id: preset-dsh-orchestrator-preset$/.test(l))
      if (start < 0) return "nopreset"
      const presetIndent = /^\s*/.exec(lines[start])[0].length
      let childIndent = -1
      for (let i = start + 1; i < lines.length; i++) {
        const ind = /^\s*/.exec(lines[i])[0].length
        if (/^\s*- id:/.test(lines[i]) && ind > presetIndent) { childIndent = ind; break }
        if (/^\s*- id:/.test(lines[i]) && ind <= presetIndent) return "nopreset"
      }
      if (childIndent < 0) return "nopreset"
      for (let i = start + 1; i < lines.length; i++) {
        const ind = /^\s*/.exec(lines[i])[0].length
        if (/^\s*- id:/.test(lines[i]) && ind <= presetIndent) return "absent"
        if (lines[i].trim() !== "- id: " + id || ind !== childIndent) continue
        const gate = lines.slice(i + 1, i + 4).find((l) => /^\s*disabled:/.test(l))
        return gate === undefined ? "absent" : evalRaw(gate)
      }
      return "absent"
    }
    // The TOP-LEVEL rows a layer patch list decides: a bare row entry, or the
    // rows of an `- insert:` / `- replace:` instruction. Deliberately NOT a deep
    // walk: `tool-bash` also appears NESTED inside this preset’s own preset row
    // (as one of its plugins), and a deep walk would read that nested row as a
    // top-level decision and give a confidently wrong answer.
    const topLevelRows = (patches) => {
      const rows = []
      for (const entry of Array.isArray(patches) ? patches : []) {
        if (!entry || typeof entry !== "object") continue
        if (typeof entry.id === "string") rows.push(entry)
        for (const key of ["insert", "replace"]) {
          const list = entry[key]
          if (!Array.isArray(list)) continue
          for (const row of list) if (row && typeof row.id === "string") rows.push(row)
        }
      }
      return rows
    }
    // Last layer that names the row wins — the host’s own rule, applied to the
    // host’s own layer order.
    const layerValue = (id) => {
      let winner = null
      for (const layer of chain) {
        const hits = topLevelRows(layer.patches).filter((row) => row.id === id)
        if (hits.length === 0) continue
        const row = hits[hits.length - 1]
        winner = { label: layer.label, value: Object.hasOwn(row, "disabled") ? evalNode(row.disabled) : "absent" }
      }
      return winner
    }
    for (const id of ["tool-bash", "tool-pwsh"]) {
      const w = layerValue(id)
      out("ROW " + [id, composedValue(id), presetValue(id),
        w === null ? "-" : w.label, w === null ? "-" : w.value].join("\t"))
    }
  ' ) >"$TMP/shellrows.txt" 2>"$TMP/shellrows.err"
rows_rc=$?

chain_fail=""
if [ ! -s "$TMP/shellrows.txt" ]; then
  chain_fail="the shell-row probe produced nothing (exit $rows_rc)"
elif grep -q '^CHAINFAIL ' "$TMP/shellrows.txt"; then
  chain_fail="$(sed -n 's/^CHAINFAIL //p' "$TMP/shellrows.txt" | head -1)"
elif ! grep -q '^CHAIN ' "$TMP/shellrows.txt"; then
  chain_fail="the probe ran but did not report a layer chain"
fi

if [ -n "$chain_fail" ]; then
  bad "check 7  the bundle layer chain could not be enumerated — $chain_fail"
  note "refusing to fall back to the [declaration] rule: a chain that cannot be enumerated is not a chain that is clean"
  [ -s "$TMP/shellrows.err" ] && note "$(head -3 "$TMP/shellrows.err" | tr '\n' ' ')"
else
  skipped_n="$(sed -n 's/^CHAIN .*skipped=//p' "$TMP/shellrows.txt" | head -1)"
  skipped_n="${skipped_n:-0}"
  # A skipped bundle is reported, never swallowed: it is the one state where the
  # composed tree is not the tree this profile asked for.
  if [ "$skipped_n" -gt 0 ] 2>/dev/null; then
    while IFS= read -r line; do
      warn "check 7  the host loader SKIPPED a bundle: $line"
    done < <(sed -n 's/^SKIPPED //p' "$TMP/shellrows.txt")
    note "a skipped bundle means the composed tree is not the tree this profile asked for, so no row is judged on the [declaration] rule"
  fi
  note "check 7  layer order from the host loader ($(sed -n 's/^CHAIN //p' "$TMP/shellrows.txt" | head -1)): $(sed -n 's/^ORDER [0-9]* //p' "$TMP/shellrows.txt" | tr '\n' ' ')"
  grep '^ROW ' "$TMP/shellrows.txt" | sed 's/^ROW //' >"$TMP/rows.tsv"
  if [ ! -s "$TMP/rows.tsv" ]; then
    if grep -q '^NOCOMPOSED$' "$TMP/shellrows.txt"; then
      warn "check 7  the [preset] and [override] comparisons did not run — there is no composed tree to compare against"
    else
      bad "check 7  the shell-row probe reported a chain but no rows — an unjudged row is not a clean one"
    fi
  else
    host_platform="$(node -e 'process.stdout.write(process.platform)' 2>/dev/null || echo unknown)"
    if [ "$host_platform" = "win32" ]; then want_bash="true"; want_pwsh="false"
    else want_bash="false"; want_pwsh="true"; fi
    preset_bad=0
    while IFS="$(printf '\t')" read -r id composed preset layer lval; do
      want="$want_bash"; [ "$id" = "tool-pwsh" ] && want="$want_pwsh"
      [ "$preset" = "$want" ] || preset_bad=1
    done < "$TMP/rows.tsv"
    if [ "$preset_bad" -eq 0 ]; then
      ok "check 7  [preset] the preset's own rows gate both shells for $host_platform (tool-bash disabled=$want_bash, tool-pwsh disabled=$want_pwsh)"
    else
      bad "check 7  [preset] the preset's own rows do not match its declaration on $host_platform (see $TMP/rows.tsv)"
    fi
    while IFS="$(printf '\t')" read -r id composed preset layer lval; do
      want="$want_bash"; [ "$id" = "tool-pwsh" ] && want="$want_pwsh"
      if [ "$lval" = "-" ]; then
        if [ "$skipped_n" -gt 0 ] 2>/dev/null; then
          warn "check 7  [declaration] $id disabled=$composed — no layer in the INCOMPLETE chain names it, so this row was not judged"
        elif [ "$composed" = "$want" ]; then
          ok "check 7  [declaration] $id disabled=$composed on $host_platform — no layer names it, and it matches the declaration"
        else
          bad "check 7  [declaration] $id disabled=$composed (expected $want on $host_platform; no layer names it)"
        fi
      else
        if [ "$composed" = "$lval" ]; then
          ok "check 7  [override] $id disabled=$composed, as $layer decides (composition applied the layer)"
        else
          bad "check 7  [override] $id composed=$composed but $layer says $lval — the layer was not applied"
        fi
      fi
    done < "$TMP/rows.tsv"
  fi
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
head_ "check 13 — every lane preset declares the official tool set it may see, and an unsupported host mounts none"
# ===========================================================================
# WHAT THIS CHECKS NOW. Since 362d1c8 each lane declares what it MAY see, instead of
# listing what it must lose. The narrowing still happens in ONE place — the
# `lane-gate` plugin inside each lane's Agent Preset row — but the value it carries
# changed from `deny` to `official`:
#
#     preset-orch-lane-<lane>  ->  config.plugins[]  ->  id: 'lane-gate'  ->  config.official
#
# `official` is a LITERAL ARRAY of host tool names. The deny list is no longer in
# the artifact at all: `lane-tool-gate.mjs` computes
# `deny = (names known to the live registry) − official` when the lane mounts and
# again on every `tools/change`, so a tool that appears later (an MCP server's
# `mcp_<server>`, say) is stripped without anyone having written its name down.
# ⛔ That is why a `!!js` allow-list FAILS below. The migration's whole point is
# that an allow-list needs no per-machine evaluation; an evaluated `official`
# would silently reintroduce the machine-dependent artifact that was removed.
#
# The earlier form looked for `config.toolFilter` on the lane rows, then at
# `lane-gate.config.deny`. When the first subject was deleted this check silently
# stopped seeing all nine lanes (LANES=12 DENY_LANES=0) and then failed on its own
# exit condition rather than on the boundary. The subject moved twice; the boundary
# it protects did not. Hence the vacuous-pass guards below.
#
# WHERE THE MCP CLOSURE PROOF WENT — and why it is not here any more. The old check
# asserted that each lane's deny list MOVED between a simulated no-MCP machine and a
# simulated MCP machine. Under `official` that assertion has no subject left in the
# artifact: `official` is a literal array, identical on both machines, so the
# assertion could only ever be vacuously true — and a check that cannot fail is not
# a check. It was dropped on purpose (user ruling) rather than kept green.
# The behaviour it stood for did NOT disappear; it moved into the mechanism.
# `lane-tool-gate.mjs` computes the deny against the LIVE registry at mount and
# again on every `tools/change`, which is what keeps a late-registered MCP tool from
# being granted. That proof is now split across two files, because the two halves
# fail independently:
#   · ARTIFACT side — `tools/patch-contract.test.mjs`, the responsible tests being
#       `gate 里不再出现静态 deny 名，声明侧也不再导出那三份名单`
#       `九条 lane 的官方集逐条核对：与字面表一致（不多、不少、不重）`
#       `没有任何官方集授予写面之外的危险名字（寻址 / fork / schedule / 写工具的交叉核对）`
#   · RUNTIME side — `tools/lane-tool-gate.test.mjs`, which calls the real `apply()`
#     with a fake `ctx.tools` and asserts the recomputation: a name that appears in
#     the registry AFTER mount, then a `tools/change`, and the name is in the new
#     deny list. That file is the one that covers "the deny is computed from the
#     live registry"; before it existed this half was guaranteed by construction
#     and untested, which is why the header no longer claims otherwise.
#
# WHY THE `unsupported` MACHINE EXISTS (the fail-closed leg). The host axis used to
# be about picking a lane FORM. It is now a single switch, and the switch reads the
# VERSION: LANE_FORM_SUPPORTED_EXPR resolves dsh-tool-subagent, walks up to its
# package.json and returns TRUE when that version is not one of the supported two
# (0.2.1-rc.2, 0.2.1-rc.3). The old
# structural test (`/persona:/` in the Config literal) survives only as the fallback
# for the case where no version can be read at all.
#
# The `unsupported` machine below is therefore a stub that differs from the supported
# host in ONE respect — its version — and is deliberately IDENTICAL to it in shape
# (same Config keys, agentPreset + allowedAgentPresets, NO `persona:`). If the stub
# declared `persona:`, the fallback would disable it and this check would pass while
# proving nothing about version discrimination. On an unsupported host every lane row,
# every lane preset row and the fork row must be `disabled` — the bundle mounts ZERO
# lanes rather than nine un-narrowed ones. That is the direction that matters: a host
# we cannot narrow is a host we must not populate.
#
# WHAT IS ASSERTED, per lane preset row:
#   1. a `lane-gate` plugin exists and carries `config.official` (its absence means
#      the lane is not narrowed at all);
#   2. `official` is a PLAIN ARRAY — a `{ __jsExpr }` node fails (see above);
#   3. SET EQUALITY against the literal design table, reported as two different
#      failures: names the design grants but `official` lacks (capability
#      starvation) and names `official` carries that the design does not grant
#      (capability escalation), each naming the offending names;
#   4. the FORBIDDEN names, asserted separately from the set equality so each
#      message names the escalation instead of burying it: lane-addressing, fork,
#      the nine dispatch names, the four `schedule_*` names — on every lane — and
#      the write surface plus both shells on every READ-ONLY lane.
# ⛔ The expected membership is a LITERAL table inside the probe, NEVER read from
# `tools/preset-declaration.mjs`. The old deny table stated the rule and it applies
# unchanged: deriving the expectation from the declaration makes the assertion
# `x === x` — a mutated declaration produces a mutated artifact and the two agree
# while the boundary is gone. So the table's authority is THIS FILE — not
# `docs/DESIGN.md`. §3.3.4 is still titled "toolFilter 名字目录与最终 deny 名单" and
# enumerates the OLD deny lists; `official` reaches that document only through the
# row-8 (`subagent_forge`) ruling. Migrating §3.3.3/§3.3.4 to `official` is
# outstanding debt, so the design document is the debt here, not the source.
# Only the roster-to-set assignment is read off the artifact.
#
# It parses the generated artifact with the host's own patch parser (so the `!!js`
# dialect and the indentation are the ones the Loader reads), and evaluates each
# row's `disabled` gate with the Loader's own evaluator on two simulated hosts: a
# supported one, and an unsupported one. Every assertion below was seen firing
# against a mutated copy of the artifact while this check was rewritten.
#
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
  # An UNSUPPORTED host stub. It must be unsupported by VERSION, not merely by shape:
  # alpha.3 / alpha.4 / alpha.5 are structurally identical to the supported host and
  # differ only in the version string, so a shape-only stub would test the wrong fact.
  # ⛔ It must be structurally IDENTICAL to the supported host (no persona:), so that
  # the VERSION is the only thing that can make it unsupported. If this stub declared
  # persona:, a shape-only probe would still disable it and the gate would look correct
  # while being unable to distinguish alpha.3/4/5 from the supported release.
  # WARNING: this mkdir must exist. Without it the two cat-redirects below fail, the
  # stub never appears, createRequire(...).resolve() throws on the stub machine, and
  # every row reads as fail-closed disabled — so the leg would pass 19/19 for the
  # WRONG reason (measured: it did exactly that before this line was restored).
  mkdir -p "$TMP/unsupported-host/node_modules/@deepseek-ai/dsh-tool-subagent/lib"
  cat > "$TMP/unsupported-host/node_modules/@deepseek-ai/dsh-tool-subagent/package.json" <<'STUBPKG'
{ "name": "@deepseek-ai/dsh-tool-subagent", "version": "0.2.1-alpha.5", "main": "lib/index.js" }
STUBPKG
  cat > "$TMP/unsupported-host/node_modules/@deepseek-ai/dsh-tool-subagent/lib/index.js" <<'STUBJS'
const Config = z.object({
	provider: z.string(),
	agentPreset: z.string(),
	allowedAgentPresets: z.array(z.string())
});
STUBJS
  mkdir -p "$TMP/unsupported-host/node_modules/@quill507"
  ln -s "$REPO_ROOT" "$TMP/unsupported-host/node_modules/@quill507/dsh-orchestrator-preset" 2>/dev/null || cp -r "$REPO_ROOT/personas" "$TMP/unsupported-host/personas"
  # Guard against a vacuous pass: if the stub is not really there, the probe fails closed
  # on every row and the leg reports 19/19 disabled for the wrong reason. Refuse that.
  if [ ! -f "$TMP/unsupported-host/node_modules/@deepseek-ai/dsh-tool-subagent/package.json" ]; then
    bad "check 13  the unsupported-host stub was not created — the fail-closed leg would pass vacuously (every row reads as disabled because resolution throws)"
  fi
  # The expected lane roster, derived from the DECLARATION (not a literal copy).
  # Two sets: the `tool-subagent-*` rows, and the `preset-orch-lane-*` rows that carry
  # each lane's gate. Deriving both here is what makes the coverage assertion below
  # exact without introducing a second hardcoded roster that could drift from the
  # declaration it is supposed to police.
  EXPECTED_LANE_IDS="$( cd -- "$REPO_ROOT" && node --input-type=module -e '
    const d = await import("./tools/preset-declaration.mjs")
    process.stdout.write(d.LANES.map((l) => "tool-subagent-" + l.tool.replace(/^subagent_/, "").replace(/_/g, "-")).join(" "))
  ' 2>/dev/null )"
  EXPECTED_PRESET_IDS="$( cd -- "$REPO_ROOT" && node --input-type=module -e '
    const d = await import("./tools/preset-declaration.mjs")
    process.stdout.write(d.lanePresetRows.map((r) => r.id).join(" "))
  ' 2>/dev/null )"
  if [ -z "$EXPECTED_LANE_IDS" ] || [ -z "$EXPECTED_PRESET_IDS" ]; then
    bad "check 13  the lane roster could not be derived from the declaration — the coverage assertion would be vacuous"
  fi
  # ⛔ The per-lane OFFICIAL expectation is deliberately NOT derived here. It is a
  # literal table inside the probe (design fact). A declaration-derived expectation
  # would move with a mutated declaration and could not see the boundary go.
  ( cd -- "$DSH_PKG_ROOT" && ARTIFACT="$DENY_JSON" DSH_PKG_ROOT="$DSH_PKG_ROOT" UNSUPPORTED_HOST_BASE="$TMP/unsupported-host" EXPECTED_LANE_IDS="$EXPECTED_LANE_IDS" EXPECTED_PRESET_IDS="$EXPECTED_PRESET_IDS" node --input-type=module -e '
import { loadOverlayPatches } from "@deepseek-ai/dsh-app-boot"

// ── the LITERAL lane table (authority: this file) ────────────────────────────
// Which set each lane gets is asserted against the literal table below, written
// out here on purpose. Its authority is THIS FILE, not docs/DESIGN.md: §3.3.4 is
// still titled "toolFilter 名字目录与最终 deny 名单" and enumerates the OLD deny
// lists, and `official` reaches that document only through the row-8
// (`subagent_forge`) ruling. For eight of the nine lanes the ONLY enumeration of
// the allow-list is LANE_OFFICIAL in tools/preset-declaration.mjs — the very array
// this literal table exists to police. Migrating §3.3.3/§3.3.4 to `official` is
// outstanding debt; it is not a source this check can cite.
// ⛔ NOT derived from tools/preset-declaration.mjs. A declaration-derived
// expectation is x === x: mutate the declaration, regenerate, and the expectation
// and the artifact agree while the boundary is gone. Only the roster-to-set
// ASSIGNMENT is read off the artifact (by lane id); what each set must CONTAIN is
// asserted against this table.
const READ_ONLY_SET = ["read", "read_image", "glob", "grep"]
const WRITER_SET = [...READ_ONLY_SET, "write", "edit", "skill", "todo_write", "bash", "pwsh"]
const DESIGN_OFFICIAL = {
  scout: READ_ONLY_SET,
  analyst: READ_ONLY_SET,
  seer: READ_ONLY_SET,
  auditor: READ_ONLY_SET,
  archivist: [...READ_ONLY_SET, "web_fetch", "web_search"],
  reader: ["read", "read_image"],
  wright: WRITER_SET,
  forge: WRITER_SET,
  planner: [...READ_ONLY_SET, "skill"],
}
// The lanes allowed a writable surface. Every OTHER lane is read-only, and there
// the write surface and both shells are forbidden (asserted separately below).
const WRITER_LANES = new Set(["wright", "forge"])

// Names this bundle registers into the Lead own scope. A lane inherits them, so any
// occurrence in `official` is an escalation rather than a grant.
const ADDRESSING_SIBLING = ["subagent_children", "subagent_send", "subagent_interrupt"]
const ADDRESSING_LEAD = ["send_message", "interrupt_agent", "list_agents"]
// The four schedule_* names are UNCONDITIONAL: both supported hosts depend on
// @deepseek-ai/dsh-tool-schedule, and the user ruled the reminder surface is
// Lead-only. They must never appear in a lane allow-list.
const SCHEDULE_NAMES = ["schedule_create", "schedule_delete", "schedule_list", "schedule_update"]
// The nine dispatch names: a lane that may dispatch is a lane running its own roster.
const DISPATCH_ALL = ["subagent_scout", "subagent_archivist", "subagent_seer", "subagent_reader",
  "subagent_analyst", "subagent_auditor", "subagent_wright", "subagent_forge", "subagent_planner"]

// `baseUrl` is the Loader entry context base the real `!!js` expressions see
// (cordis-plugin-loader: `Entry.ctx = loader.ctx.extend({ baseUrl })`).
const HOST_SUPPORTED = { baseUrl: process.env.DSH_PKG_ROOT + "/package.json" }
// The unsupported host points at the version-stub package, so the host gate reads
// TRUE there -- the same trick patch-contract.test.mjs uses, for the same reason:
// the reading must not depend on which dsh is installed on this machine.
const UNSUPPORTED_STUB = process.env.UNSUPPORTED_HOST_BASE + "/package.json"
// Two simulated hosts now, not three. The MCP axis is gone from the artifact (see
// the header comment): `official` is identical on every machine, so the only
// machine axis left to evaluate is supported / unsupported.
const machines = {
  none: { ...HOST_SUPPORTED, get: () => undefined, loader: { entries: () => [] } },
  unsupported: { baseUrl: UNSUPPORTED_STUB, get: () => undefined, loader: { entries: () => [] } },
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
// A `!!js` value is parsed into a { __jsExpr } node. Evaluate it; a plain value is
// returned as-is (so a literal array, if one ever came back, is still readable).
const valueOn = (node, machineKey) => {
  if (node === undefined || node === null) return undefined
  if (typeof node === "object" && typeof node.__jsExpr === "string") {
    return evaluate(machines[machineKey], node.__jsExpr)
  }
  return node
}

// A LANE row is a tool-subagent row that declares maxDepth. The delegation group also
// holds tool-subagent-control and tool-subagent-list-agents, which are NOT lanes (no
// config at all) -- an id-prefix match would sweep them in and then demand a gate that
// was never supposed to exist. Derive the set from the artifact shape instead.
const laneRows = rows.filter((r) => typeof r.id === "string" && r.id.startsWith("tool-subagent-")
  && r.config && r.config.maxDepth !== undefined)
const presetRows = rows.filter((r) => typeof r.id === "string" && r.id.startsWith("preset-orch-lane-"))
const FORK_CONTROL_ID = "tool-subagent-fork"
console.log("LANES=" + laneRows.length + " PRESET_ROWS=" + presetRows.length)

let bad = 0
const fail = (msg) => { console.log("BAD " + msg); bad++ }

// ── leg 1: every lane preset declares an official set, and it is the design one ──
// The subject is the preset row, so a preset that lost its gate, or whose allow
// list stopped being a literal array, is caught here rather than looking like
// "no lane".
// ⛔ EXACTLY ONE gate, and that is a separate assertion from "carries official".
//    `plugins.find(...)` reads the FIRST `lane-gate` and never notices a second,
//    so an artifact could append a second gate with a wider `official` and this
//    check would still pass it (measured: it did, exit 0, on a review-built
//    artifact). "two gates" and "no gate" are different defects — a second gate is
//    a second narrowing rule, and which one the host applies last is not something
//    this check should have to guess — so they get different messages.
const gatePluginsOf = (presetRow) => {
  const plugins = presetRow.config && presetRow.config.plugins
  if (!Array.isArray(plugins)) return []
  return plugins.filter((p) => p && p.id === "lane-gate")
}
const narrowed = []
for (const preset of presetRows) {
  const gates = gatePluginsOf(preset)
  if (gates.length > 1) {
    fail(preset.id + " carries " + gates.length + " lane-gate plugins -- exactly one is allowed: a second gate is a second narrowing rule, and reading only the first would hide whichever one the host applies last")
    continue
  }
  // 1. the gate itself. No `official` means the lane is not narrowed at all.
  const gate = gates[0]
  if (!gate || !gate.config || !Object.hasOwn(gate.config, "official")) {
    fail(preset.id + " has no lane-gate.config.official -- that lane is not narrowed at all")
    continue
  }
  const official = gate.config.official
  const lane = preset.id.replace(/^preset-orch-lane-/, "")
  const design = DESIGN_OFFICIAL[lane]
  if (design === undefined) {
    fail(preset.id + " has no row in the literal design table -- a lane appeared (or was renamed) without a declared surface, so nothing below can judge it")
    continue
  }
  // 2. a plain array. A `!!js` node fails: an allow-list is a declaration, and
  // evaluating it per machine is exactly what the migration removed.
  if (!Array.isArray(official)) {
    const isExpr = official !== null && typeof official === "object" && typeof official.__jsExpr === "string"
    fail(preset.id + " lane-gate.config.official is " +
      (isExpr ? "a !!js expression" : "not an array (" + (typeof official) + ")") +
      " -- an allow-list must be a LITERAL array: a per-machine allow-list reintroduces the mechanism this migration removed")
    continue
  }
  narrowed.push({ id: preset.id, lane, official })
  const got = new Set(official)
  const want = new Set(design)
  // 3. set equality, in two directions, with two different meanings.
  const starved = design.filter((n) => !got.has(n))
  const escalated = official.filter((n) => !want.has(n))
  if (starved.length) {
    fail(preset.id + " official lacks [" + starved.join(", ") + "] -- the design grants " +
      (starved.length === 1 ? "it" : "them") + " to this lane (capability starvation)")
  }
  if (escalated.length) {
    fail(preset.id + " official carries [" + escalated.join(", ") + "] -- the design does not grant " +
      (escalated.length === 1 ? "it" : "them") + " to this lane (capability escalation)")
  }
  // 4. the FORBIDDEN names, separately from the set equality, so each message
  // names the escalation instead of burying it in "does not match the table".
  for (const name of ADDRESSING_SIBLING) {
    if (got.has(name)) fail(preset.id + " official grants " + name + " -- that lane could address a sibling lane (permission escalation)")
  }
  if (got.has("subagent_fork")) {
    fail(preset.id + " official grants subagent_fork -- a lane could fork a child outside the declared roster (permission escalation)")
  }
  for (const name of DISPATCH_ALL) {
    if (got.has(name)) fail(preset.id + " official grants " + name + " -- that lane could dispatch its own children (permission escalation)")
  }
  for (const name of SCHEDULE_NAMES) {
    if (got.has(name)) fail(preset.id + " official grants " + name + " -- the reminder tools are Lead-only by user decision (permission escalation)")
  }
  for (const name of ADDRESSING_LEAD) {
    if (got.has(name)) fail(preset.id + " official grants " + name + " -- that name belongs to the Lead scope, so a lane holding it is an escalation")
  }
  if (!WRITER_LANES.has(lane)) {
    for (const name of ["bash", "pwsh"]) {
      if (got.has(name)) fail(preset.id + " official grants " + name + " -- A READ-ONLY LANE GAINED A SHELL (permission escalation)")
    }
    // The write surface is the one that matters most: asserted separately so the
    // message names the escalation rather than burying it inside a set mismatch.
    for (const name of ["write", "edit"]) {
      if (got.has(name)) fail(preset.id + " official grants " + name + " -- READ-ONLY LANE GAINED THE WRITE SURFACE (permission escalation)")
    }
  }
  console.log("OK " + preset.id + " official=" + official.length + " [" + official.join(" ") + "]")
}
// The non-fork lane rows: every tool-subagent row that is a lane (the fork control row
// is excluded by id, because it is the one row that is not a named lane).
const nonForkLaneRows = laneRows.filter((r) => r.id !== FORK_CONTROL_ID)
// ── lane coverage: the gated set must EQUAL the declared set, by id ────────────
// A count floor (`>= 8`) let a lane vanish while every gate stayed green: drop one
// preset row and you get 8 gated lanes, which still satisfies "at least 8". So the
// assertion is set equality against the roster derived from the declaration, and the
// failure prints the symmetric difference by NAME. A count cannot tell you which lane
// is missing; the ids can.
//
// ⚠️ Vacuous-pass guard: if the artifact yields no preset rows at all, that is the
// shape of a broken artifact, not of a clean one — it gets its own message rather
// than sliding through set equality with an empty expectation.
// ⛔ THE DESIGN ROSTER, AS A LITERAL. Everything else in this block is derived (from the
// declaration, from the artifact), and derived-on-both-sides comparisons are
// self-fulfilling: remove a lane from `LANES`, regenerate, and the expected set and the
// artifact both shrink together, so the sets still match and every gate stays green. The
// literal below is the one thing that does NOT move when the lane list is edited, so it is
// what makes "a lane disappeared" observable. DESIGN §3.3.3 names the same nine
// lanes, but under the OLD deny mechanism, and only its row 8 states an `official`
// set — so it corroborates this roster, it does not authorise it.
const ROSTER_LANES = ["scout", "archivist", "seer", "reader", "analyst", "auditor", "wright", "forge", "planner"]
const ROSTER_LANE_IDS = ROSTER_LANES.map((l) => "tool-subagent-" + l).sort()
const ROSTER_PRESET_IDS = ROSTER_LANES.map((l) => "preset-orch-lane-" + l).sort()
if (ROSTER_LANE_IDS.length !== 9) {
  fail("the literal lane roster is not 9 entries — the roster itself is wrong, so every coverage assertion below is meaningless")
}
// A reporting helper: symmetric difference, by id, both directions.
const setReport = (label, want, got) => {
  const missing = want.filter((id) => !got.includes(id))
  const unexpected = got.filter((id) => !want.includes(id))
  if (missing.length || unexpected.length) {
    fail(label + " does not match the literal 9-lane roster -- missing: [" + missing.join(", ") + "] unexpected: [" + unexpected.join(", ") + "]")
  }
}
const expectedLanes = (process.env.EXPECTED_LANE_IDS || "").split(/\s+/).filter(Boolean)
const expectedPresets = (process.env.EXPECTED_PRESET_IDS || "").split(/\s+/).filter(Boolean)
if (expectedLanes.length === 0 || expectedPresets.length === 0) {
  fail("the expected lane roster is empty — the declaration could not be read, so coverage cannot be asserted (an empty expectation is not a clean artifact)")
} else {
  const actualLaneIds = nonForkLaneRows.map((r) => r.id)
  const actualPresetIds = presetRows.map((r) => r.id)
  if (actualLaneIds.length === 0) {
    fail("the artifact yielded ZERO lane rows — a preset with no lanes is a broken artifact, not a clean one")
  }
  if (actualPresetIds.length === 0) {
    fail("the artifact yielded ZERO lane preset rows — that is a broken artifact, not a clean one")
  }
  const diff = (want, got) => ({
    missing: want.filter((id) => !got.includes(id)),
    unexpected: got.filter((id) => !want.includes(id)),
  })
  // ── the LITERAL roster, asserted against BOTH the declaration and the artifact ──
  // This is the assertion that catches a lane removed from the DECLARATION. The two
  // comparisons below (declaration vs artifact) are derived on both sides and therefore
  // cannot see it: remove a lane from LANES, regenerate, and both sides shrink together.
  setReport("the declaration lane roster", ROSTER_LANE_IDS, expectedLanes.slice().sort())
  setReport("the declaration preset roster", ROSTER_PRESET_IDS, expectedPresets.slice().sort())
  setReport("the artifact lane rows", ROSTER_LANE_IDS, actualLaneIds.slice().sort())
  setReport("the artifact lane preset rows", ROSTER_PRESET_IDS, actualPresetIds.slice().sort())
  const laneDiff = diff(expectedLanes, actualLaneIds)
  const presetDiff = diff(expectedPresets, actualPresetIds)
  if (laneDiff.missing.length || laneDiff.unexpected.length) {
    fail("lane rows do not match the declaration — missing: [" + laneDiff.missing.join(", ") + "] unexpected: [" + laneDiff.unexpected.join(", ") + "]")
  }
  if (presetDiff.missing.length || presetDiff.unexpected.length) {
    fail("lane preset rows do not match the declaration — missing: [" + presetDiff.missing.join(", ") + "] unexpected: [" + presetDiff.unexpected.join(", ") + "]")
  }
  // Every expected lane must also have been seen carrying a gate in leg 1, or the
  // row exists but is un-narrowed.
  const gatedIds = narrowed.map((l) => l.id)
  const ungated = expectedPresets.filter((id) => !gatedIds.includes(id))
  if (ungated.length) {
    fail("these lane presets exist but carry no usable gate: [" + ungated.join(", ") + "]")
  }
  console.log("LANESET expected=" + expectedLanes.length + " actual=" + actualLaneIds.length + " presets=" + actualPresetIds.length + " gated=" + gatedIds.length)
}
// ── leg 2: the fork control row is contract-neutral, gated, and dangles nowhere ──
// It used to be asserted to carry ONLY a schedule tail; then, after T1, to carry no
// filter at all. It now carries a host gate as well, so what is asserted is the
// shape that makes it both safe AND fail-closed:
//   * no `toolFilter` / no `persona` -- either key is hard-rejected by the host
//     apply(), so its presence would stop the row activating at all;
//   * no `agentPreset` / `allowedAgentPresets` -- the lane preset rows are disabled
//     on an unsupported host, so a fork row naming one would dangle toward a preset
//     that is not mounted;
//   * it DOES carry `disabled` (the same expression as the lane rows). Without it,
//     an unsupported host would keep the one row that can still delegate.
const fork = rows.find((r) => r.id === FORK_CONTROL_ID)
if (!fork) fail("no fork control row (" + FORK_CONTROL_ID + ") in the artifact")
else {
  const cfg = fork.config || {}
  if (Object.hasOwn(cfg, "toolFilter")) fail("fork control row still carries toolFilter -- the host apply() hard-rejects that key, so the row cannot activate")
  if (Object.hasOwn(cfg, "persona")) fail("fork control row still carries persona -- the host apply() hard-rejects that key, so the row cannot activate")
  if (fork.disabled === undefined) fail("fork control row has NO host gate -- on an unsupported host it would stay mounted and keep subagent_fork available, so a Lead could delegate into a composition with no lane presets")
  // Fail-closed coupling: the lane preset rows are disabled on an unsupported host, so
  // a fork row naming one would point at a preset that is not mounted.
  if (Object.hasOwn(cfg, "agentPreset")) fail("fork control row names an agentPreset -- the preset rows are disabled on an unsupported host, so that reference would dangle")
  if (Object.hasOwn(cfg, "allowedAgentPresets")) fail("fork control row names allowedAgentPresets -- same dangle as agentPreset")
}

// ── leg 3: an UNSUPPORTED host mounts nothing ──────────────────────────────────
// Fail closed. LANE_FORM_SUPPORTED_EXPR true = legacy host = not supported. Every
// lane row, every preset row AND the fork control row must be disabled there.
// The fork row is the one that used to stay open: with it enabled, a Lead on an
// unsupported host could still delegate through subagent_fork into a composition
// where every lane preset is dark. Zero rows that can delegate, not nine
// un-narrowed lanes, is the property this leg protects.
const forkRow = rows.find((r) => r.id === FORK_CONTROL_ID)
const gatedRows = [...laneRows, ...presetRows, ...(forkRow ? [forkRow] : [])]
if (!forkRow) fail("no fork control row (" + FORK_CONTROL_ID + ") to sweep -- it is the row that can still delegate")
let unsupportedChecked = 0
for (const row of gatedRows) {
  const d = valueOn(row.disabled, "unsupported")
  if (d !== true) fail(row.id + " is NOT disabled on an unsupported host (disabled evaluated to " + JSON.stringify(d) + ") -- that host would mount an un-narrowed lane, or keep a delegation door open")
  else unsupportedChecked++
}
// And the same rows MUST be enabled on the supported host, or the fail-closed leg
// above would pass trivially by disabling everything everywhere.
let supportedChecked = 0
for (const row of gatedRows) {
  const d = valueOn(row.disabled, "none")
  if (d !== false) fail(row.id + " is disabled on the SUPPORTED host (disabled evaluated to " + JSON.stringify(d) + ") -- every lane would vanish on the host this preset is for")
  else supportedChecked++
}
if (unsupportedChecked === 0 || supportedChecked === 0) fail("the fail-closed leg checked no rows -- an empty sweep is not a verdict")
if (unsupportedChecked !== gatedRows.length || supportedChecked !== gatedRows.length) {
  fail("the fail-closed sweep did not cover every gated row (" + unsupportedChecked + "/" + supportedChecked + " of " + gatedRows.length + ")")
}
console.log("HOSTGATE unsupported_disabled=" + unsupportedChecked + " supported_enabled=" + supportedChecked + " of " + gatedRows.length + " gated rows (" + expectedLanes.length + " lanes + " + expectedPresets.length + " presets + 1 fork row)")
console.log("BAD=" + bad)
process.exit(bad === 0 && narrowed.length === expectedLanes.length ? 0 : 1)
' >"$TMP/lanes13.txt" 2>"$TMP/lanes13.err" )
  lanes_rc=$?
  if [ ! -s "$TMP/lanes13.txt" ]; then
    bad "check 13  the lane-gate probe could not run (exit $lanes_rc) — an official set that was never read is not a narrowed lane:"
    sed 's/^/      /' "$TMP/lanes13.err" | head -3
  else
    d_lane_bad="$(sed -n '/^BAD /p' "$TMP/lanes13.txt")"
    d_hostgate="$(sed -n '/^HOSTGATE /p' "$TMP/lanes13.txt")"
    d_laneset="$(sed -n 's/^LANESET //p' "$TMP/lanes13.txt")"
    if [ -n "$d_lane_bad" ]; then
      bad "check 13  a lane's declared official set does not match the design, or an unsupported host would mount lanes:"
      printf '%s\n' "$d_lane_bad" | sed 's/^/      /'
    else
      ok "check 13  every declared lane is present by id [$EXPECTED_LANE_IDS] and every lane preset carries exactly ONE lane-gate whose literal official set EQUALS the design table; no lane is granted an addressing / fork / dispatch / schedule name; no read-only lane gained the write surface or a shell; and an unsupported host mounts nothing ($d_laneset $d_hostgate)"
    fi
    if [ "$lanes_rc" -ne 0 ] && [ -z "$d_lane_bad" ]; then
      bad "check 13  the probe exited $lanes_rc without naming a bad lane — treat an unexplained non-zero as a failure"
    fi
    # The reason, beside the verdict it explains: what the expectation is made of,
    # what the one simulated machine is, and the residual the mechanism still has.
    note "check 13  the expected official set is a LITERAL table inside this check (not tools/preset-declaration.mjs): a declaration-derived expectation would move with a mutated declaration and the boundary could go unobserved"
    note "check 13  simulated machine C is an UNSUPPORTED host (dsh-tool-subagent version 0.2.1-alpha.5 — structurally identical to the supported host, only the version differs): every lane row, every preset row and the fork row must be disabled there — zero lanes mount rather than nine un-narrowed ones. $d_hostgate"
    # Is this residual still true of the MECHANISM? The old one (singleToolThreshold /
    # eager-server loader-name computation) described the retired deny expression, and
    # it no longer names anything this check reads. The new one is the mechanism's
    # own failure mode: lane-tool-gate.mjs warns and clears its de-dup key when
    # restrict() throws, so the lane stays WIDER and the artifact still looks right.
    note "check 13  residual: the narrowing runs inside the host — if ctx.tools.restrict() throws there, lane-tool-gate.mjs logs a warning and that lane stays wider for the rest of the run; the artifact this check reads is still correct, so the widening is visible only in the host log"
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
printf 'SUMMARY  %d passed, %d failed, %d info  (profile: %s)\n' "$PASS" "$FAIL" "$INFO" "$PROFILE"
printf '========================================\n'
[ "$FAIL" -eq 0 ] || exit 1
exit 0
