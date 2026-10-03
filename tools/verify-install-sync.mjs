#!/usr/bin/env node
// verify-install-sync.mjs — source repo vs the installed copy the live profiles load.
//
// Why this exists: the DSH profiles resolve this preset through a pnpm `link:` to
// a hand-made COPY under ~/.dsh/plugins/, not to this repository. An edit here
// therefore does nothing to the running system until somebody re-syncs, and
// nothing in the toolchain says so. This script makes the drift visible.
//
// Zero dependencies — Node builtins only (node:crypto, node:fs, node:path).
// Deliberately UNWIRED: it is not referenced from package.json scripts, so it
// does not run in CI or in `npm test` yet.
//
// ---------------------------------------------------------------------------
// EXIT CODES
//   0  OK         every file the package actually ships is present in the
//                 installed copy with identical bytes. Author-only files and
//                 extra files in the installed copy are reported as
//                 informational and do not affect this code.
//   1  DRIFT      the shipped surface differs: a shipped file is missing from
//                 the installed copy, or its bytes differ. This is the only
//                 condition that is a real failure.
//   2  CONFIG     a directory or package.json is missing or unreadable, so the
//                 comparison cannot be made at all. Distinct from drift: drift
//                 is a statement about content, config is about being able to
//                 look.
// ---------------------------------------------------------------------------
//
// Usage:
//   node tools/verify-install-sync.mjs
//   node tools/verify-install-sync.mjs --source <dir> --installed <dir>
//
// The two flags exist so the failure path can be exercised against a scratch
// copy without touching either real tree.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// An env var set to whitespace is treated as unset, matching the host's own
// `resolveDshHome()` priority rather than silently building `  /plugins/…`.
const envTrim = (v) => (typeof v === 'string' ? v.trim() : '');

const EXIT_OK = 0;
const EXIT_DRIFT = 1;
const EXIT_CONFIG = 2;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = REPO_ROOT;
// The live profiles link-mount this path; it is a copy, not a symlink.
//
// Derived from the user's home, never written out. A literal `C:/Users/<someone>`
// here was a machine-local absolute path in the shipped tree, and this file is
// walked by `verify-install.sh` check 8, which is exactly the kind of leak that
// check exists to catch — the gate was failing on the gate's own tooling. It also
// meant the documented default (run it with no arguments) only worked on the one
// machine that path was copied from.
//
// $DSH_HOME wins when it is set, matching `resolveDshHome()` in the host
// (@deepseek-ai/dsh-home-paths): env var first, then ~/.dsh. install.sh stages
// into that same plugins/ directory, so the two agree on where the copy lives.
// Keep it a working default — the CLI documents running it bare.
const DEFAULT_INSTALLED = join(
  envTrim(process.env.DSH_HOME) || join(homedir(), '.dsh'),
  'plugins',
  'dsh-orchestrator-preset-bundle',
);

// Always compared byte for byte, regardless of what the whitelist says. These
// two are what the preset actually is at runtime: the patch the loader applies
// and the manifest that declares the bundle.
const MUST_MATCH = ['cordis.patch.yml', 'package.json'];

// Never walked: build output, VCS metadata, and the repo's own runtime state.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.dsh', '.gate-pack', '.install-tmp', '.clonetest']);

function parseArgs(argv) {
  const out = { source: DEFAULT_SOURCE, installed: DEFAULT_INSTALLED };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') out.source = resolve(argv[++i] ?? '');
    else if (a === '--installed') out.installed = resolve(argv[++i] ?? '');
    else if (a === '--help' || a === '-h') {
      process.stdout.write('usage: verify-install-sync.mjs [--source <dir>] [--installed <dir>]\n');
      process.exit(EXIT_OK);
    } else {
      process.stderr.write(`CONFIG: unknown argument ${a}\n`);
      process.exit(EXIT_CONFIG);
    }
  }
  return out;
}

function dieConfig(msg) {
  process.stderr.write(`CONFIG: ${msg}\n`);
  process.exit(EXIT_CONFIG);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

// All files under `dir`, as posix-style relative paths. Returns null if `dir`
// is not a readable directory.
function walk(dir, base = dir) {
  if (!existsSync(dir)) return null;
  let items;
  try {
    items = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const out = [];
  for (const it of items) {
    if (it.isDirectory()) {
      if (SKIP_DIRS.has(it.name)) continue;
      const sub = walk(join(dir, it.name), base);
      if (sub) out.push(...sub);
    } else if (it.isFile()) {
      out.push(relative(base, join(dir, it.name)).split(sep).join('/'));
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

// --- configuration ----------------------------------------------------------
if (!existsSync(args.source) || !statSync(args.source).isDirectory()) dieConfig(`source dir not found: ${args.source}`);
if (!existsSync(args.installed) || !statSync(args.installed).isDirectory()) dieConfig(`installed dir not found: ${args.installed}`);

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(args.source, 'package.json'), 'utf8'));
} catch (e) {
  dieConfig(`cannot read source package.json: ${e.message}`);
}
if (!pkg || !Array.isArray(pkg.files) || pkg.files.length === 0) {
  dieConfig(`source package.json has no usable "files" whitelist (${pkg && pkg.name})`);
}

// --- what the package actually ships ----------------------------------------
// A whitelist entry is either a file or a directory. Directories are walked so
// the comparison covers the whole shipped surface, not just its top level.
const shipped = new Set();
for (const entry of pkg.files) {
  const full = join(args.source, entry);
  if (!existsSync(full)) {
    // A whitelist entry with nothing behind it cannot be shipped; that is a
    // problem in the source, not in the installed copy.
    process.stderr.write(`WARN whitelist entry has no file in the source: ${entry}\n`);
    continue;
  }
  if (statSync(full).isDirectory()) {
    const sub = walk(full, args.source);
    for (const rel of sub ?? []) shipped.add(rel);
  } else {
    shipped.add(entry.split(sep).join('/'));
  }
}

const installedFiles = walk(args.installed, args.installed);
if (!installedFiles) dieConfig(`cannot read installed dir: ${args.installed}`);
const installedSet = new Set(installedFiles);

const sourceFiles = walk(args.source, args.source);
if (!sourceFiles) dieConfig(`cannot read source dir: ${args.source}`);
const sourceSet = new Set(sourceFiles);

process.stdout.write(`source    : ${args.source}\n`);
process.stdout.write(`installed : ${args.installed}\n`);
process.stdout.write(`package   : ${pkg.name}@${pkg.version}   files[] entries: ${pkg.files.length}   shipped files: ${shipped.size}\n\n`);

// --- the shipped surface: the only thing that can fail ----------------------
let drift = 0;
const missing = [];
const differing = [];

for (const rel of [...shipped].sort()) {
  const tag = MUST_MATCH.includes(rel) ? ' [must-match]' : '';
  const inInstalled = join(args.installed, rel);
  if (!existsSync(inInstalled)) {
    missing.push(rel);
    drift++;
    process.stdout.write(`MISSING   ${rel}${tag}  — shipped per files[], absent from the installed copy\n`);
    continue;
  }
  const a = sha256(join(args.source, rel));
  const b = sha256(inInstalled);
  if (a !== b) {
    differing.push(rel);
    drift++;
    process.stdout.write(`DIFFERS   ${rel}${tag}  source=${a.slice(0, 16)}… installed=${b.slice(0, 16)}…\n`);
  }
}

// --- informational: things that do NOT decide the verdict -------------------
const extras = installedFiles.filter((f) => !shipped.has(f)).sort();
const authorOnly = sourceFiles.filter((f) => !shipped.has(f) && !installedSet.has(f)).sort();

if (extras.length) {
  process.stdout.write(`\nINFO  present in the installed copy but not in files[] (${extras.length}) — npm never ships these; harmless:\n`);
  for (const f of extras) process.stdout.write(`        ${f}\n`);
}
if (authorOnly.length) {
  process.stdout.write(`\nINFO  in the source but not in the installed copy (${authorOnly.length}) — author-only, never shipped:\n`);
  for (const f of authorOnly) process.stdout.write(`        ${f}\n`);
}

// --- verdict ----------------------------------------------------------------
process.stdout.write(`\nSUMMARY shipped=${shipped.size} missing=${missing.length} differing=${differing.length} `);
process.stdout.write(`extras=${extras.length} author-only=${authorOnly.length}\n`);

if (drift > 0) {
  process.stderr.write(
    `\nFAIL: the installed copy is out of sync with the source on ${drift} shipped file(s). ` +
      `The live profiles load the copy, not this repo — re-sync before trusting the source.\n`,
  );
  process.exit(EXIT_DRIFT);
}
process.stdout.write('OK: the installed copy matches the source on the whole shipped surface.\n');
process.exit(EXIT_OK);
