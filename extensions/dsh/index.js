/**
 * Thin DeepSeek Harness bundle adapter for the orchestrator preset's own skills.
 *
 * Deliberately aegis-shaped and nothing more:
 * - the host-owned filesystem provider stays the discovery implementation; this
 *   adapter only points one isolated provider at this package's own skills/ tree;
 * - no skill bodies are copied at load time and the native skill tool is untouched;
 * - no agent or agentTeams injection, so `inject` is just ["skills"].
 *
 * The `orch-` prefix is NOT applied here. It lives in each SKILL.md's frontmatter
 * `name:`, which is where the filesystem provider reads the skill name from, so a
 * resync from source can never bake a second naming decision into the tree.
 *
 * `includeDefaultRoots: false` is what keeps this isolated: the user's global
 * skills directory is somebody else's environment and is not this package's
 * business.
 *
 * Entry specifier: the bundle patch mounts this file as
 *   @quill507/dsh-orchestrator-preset/extensions/dsh/index.js
 * The full scoped form is required. A bare or short form resolves to a directory
 * that does not exist and the bundle fails to load with MODULE_NOT_FOUND, which
 * is silent from the user's side — measured on this host, see the note in
 * tools/verify-install.sh and hw-skills' own cordis.patch.yml.
 */

import { fileURLToPath } from "node:url";
import { apply as applyFilesystemProvider } from "@deepseek-ai/dsh-skill-filesystem";

const skillsRoot = fileURLToPath(new URL("../../skills/", import.meta.url));

export const name = "orch-method-pack";
export const inject = ["skills"];

export function apply(ctx) {
  applyFilesystemProvider(ctx, {
    providerName: "orch-method-pack",
    includeDefaultRoots: false,
    bundledSkillDir: skillsRoot,
    watch: false,
  });
}
