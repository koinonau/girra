# Girra and Orca Names

Girra's variables are `GIRRA_*`. Orca's were `ORCA_*`, and every one of them is
still read.

## Reading

`adoptLegacyOrcaEnvNames` in `src/shared/legacy-orca-env-aliases.ts` mirrors each
`ORCA_*` onto its `GIRRA_*` name at process start, before any module reads the
environment. It runs from three entry points, each importing it first:

| Entry                             | Why it needs the mirror                          |
| --------------------------------- | ------------------------------------------------ |
| `src/main/index.ts`               | The user's shell profile, and `serve` mode       |
| `src/main/daemon/daemon-entry.ts` | An older client may start the daemon             |
| `src/cli/index.ts`                | An SSH host's shim, installed by an older client |

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

## The desktop profile directory

Electron names the `userData` directory after `app.getName()`, which comes from
`productName` in `package.json`, then `name`. Girra 1.0.0 set neither, so the name
fell through to `orca` and the packaged app wrote its whole profile into
`~/Library/Application Support/orca`, the directory upstream Orca owns. The two
apps could not run at once, because Electron derives the single-instance lock
identity from that path.

`productName: "Girra"` fixes the name before `ready`, so every reader resolves
`<appData>/Girra`: `~/Library/Application Support/Girra` on macOS,
`%APPDATA%\Girra` on Windows, `~/.config/Girra` on Linux. It must stay equal to
`productName` in `config/electron-builder.config.cjs`, which names the bundle.
`USER_DATA_DIR_NAME` in `src/shared/desktop-user-data-dir.ts` is the same string
for the two processes that resolve the directory without Electron: the bundled CLI
and the logs fallback. A test asserts the three stay equal.

**There is no userData migration.** A 1.0.0 profile under `<appData>/orca` is left
exactly where it is and never read. Girra starts from an empty `<appData>/Girra`,
and repos are added again by hand. That is deliberate: the directory belongs to
upstream Orca, which stays installed and working, and moving it would take Orca's
own profile with it.

Dev and E2E runs pin `userData` elsewhere, so `<appData>/orca-dev` keeps its own
lock namespace. That name stays: the CLI and the coordinator detect a dev instance
by the `orca-dev` substring in `GIRRA_USER_DATA_PATH`.

Filenames inside the profile keep the Orca spelling: `orca-data.json`,
`orca-runtime.json`, `orca-github-cache.json`. `orca-runtime.json` is read by CLI
shims installed on SSH hosts by older builds, so its name is a disk contract with
readers that update on their own schedule.

Renaming the app moved the macOS safeStorage Keychain item from
`orca Safe Storage` to `Girra Safe Storage`. `decryptSealedSecret` in
`src/main/host/legacy-orca-safe-storage.ts` reads the old items, trying each key
it finds, because a host that ran both apps has more than one and only one of them
sealed a given blob.

## Retiring both

Drop the two functions and their call sites once no supported host predates the
rename, alongside the other compatibility shims listed in `prompt.md`.
