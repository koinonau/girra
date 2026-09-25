# Girra and Orca Names

Girra's variables are `GIRRA_*`. Orca's were `ORCA_*`, and every one of them is
still read.

## Reading

`adoptLegacyOrcaEnvNames` in `src/shared/legacy-orca-env-aliases.ts` mirrors each
`ORCA_*` onto its `GIRRA_*` name at process start, before any module reads the
environment. It runs from three entry points, each importing it first:

| Entry | Why it needs the mirror |
|---|---|
| `src/main/index.ts` | The user's shell profile, and `serve` mode |
| `src/main/daemon/daemon-entry.ts` | An older client may start the daemon |
| `src/cli/index.ts` | An SSH host's shim, installed by an older client |

A variable set both ways keeps its `GIRRA_*` value: setting both means the new
name was meant.

Write new code against `GIRRA_*` only. A per-call-site fallback is a bug, not
belt and braces, because it will outlive the seam above.

## Writing

`withLegacyOrcaEnvAliases` adds an `ORCA_*` alias beside every `GIRRA_*` in an
environment bound for a child that may be an older reader: an installed agent
hook script, a remote CLI shim, an agent teams shim. Those live on disk and
survive an upgrade, so they read whichever name the build that wrote them used.

## The per-user directory

`~/.girra` replaced `~/.orca`, and the same two rules apply.

`getGirraHomeDir` in `src/shared/girra-home-dir.ts` reads whichever tree exists,
preferring the current one. The CLI, the relay and a headless `orcad` never run a
migration, so this is what keeps them working. `resolveUserDataPath` applies the
rule to `$XDG_DATA_HOME/Girra` and `$XDG_DATA_HOME/Orca` as well.

`migrateGirraHomeDirOnStartup` does the move once, on the desktop, and then
rewrites the hook-script paths stored in `~/.claude/settings.json`. The move and
the rewrite are one step because between them the agent's stored command names a
script that is not there, and a missing hook script fails silently.

The move refuses when both trees exist. That means an older build recreated
`~/.orca` after a migration, and merging them without knowing which is current
loses whichever gets overwritten.

Per-repo directories are the user's own files, so they are read where they lie:
`.girra/issue-command` is written, `.orca/issue-command` still read, locally and
over SFTP. Staging directories, `.girra/drops` and `.girra/browser-downloads`,
just moved.

A remote host's hook script is installed under `~/.girra` on the next connect,
which rewrites that host's `settings.json` in the same pass. The old script stays
where it is and keeps working until then.

## Retiring both

Drop the two functions and their call sites once no supported host predates the
rename, alongside the other compatibility shims listed in `prompt.md`.
