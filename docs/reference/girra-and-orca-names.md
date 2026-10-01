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

`~/.girra` replaced `~/.orca`, and upstream Orca stays installed and running
beside Girra, so `~/.orca` is Orca's. **There is no home-directory migration.**
See [`../adr/0004-leave-the-orca-home-tree-alone.md`](../adr/0004-leave-the-orca-home-tree-alone.md).

`getGirraHomeDir` in `src/shared/girra-home-dir.ts` names `~/.girra` and nothing
else. Every desktop reader calls it: hook scripts, `keybindings.json`, the
hook-install lock, and the Jira, Linear, Bitbucket and MiniMax credential stores.
A user arriving from Orca therefore starts from an empty `~/.girra` and re-enters
those credentials, exactly as they do for the profile directory below.

`getGirraHomeDirWithLegacyFallback` keeps the old reading, `~/.girra` or the
`~/.orca` it replaced while that is the only tree present. Two processes call it,
and no others may: the relay's session store in
`src/relay/workspace-session-handler.ts` and `resolveOrcadPath` in
`src/main/orcad/orcad-app-paths.ts`. Both run on a host that upgrades on its own
schedule and runs no migration, so legacy state is only reachable through the
legacy name. `resolveUserDataPath` applies the same rule to
`$XDG_DATA_HOME/Girra` and `$XDG_DATA_HOME/Orca`.

Per-repo directories are the user's own files, so they are read where they lie:
`.girra/issue-command` is written, `.orca/issue-command` still read, locally and
over SFTP. Staging directories, `.girra/drops` and `.girra/browser-downloads`,
just moved.

A remote host's hook script is installed under `~/.girra` on the next connect,
and registers itself in that host's `settings.json` in the same pass. An Orca
client's script stays where it is and keeps working, because the two entries no
longer collide.

## The shared agent settings file

`~/.claude/settings.json` is one file both Girra and an installed Orca manage,
and `createManagedCommandMatcher` in
`src/main/agent-hooks/installer-utils.ts` decides which entries an install may
sweep by the script file name alone. Under one name each install deleted the
other app's hooks, so the last app to launch owned them.

Girra's scripts are therefore named `claude-girra-hook` and
`claude-girra-statusline`, set by `scriptBaseName` in
`src/main/claude/hook-settings.ts`. Neither name contains Orca's
`agent-hooks/claude-hook.sh` needle, so Orca's sweep passes over them, and
Girra's needles miss Orca's entries. The agent prefix stays first: a refresher
owns a script by the `<agent>-` start of its file name, and a test in
`managed-hook-script-refresh.test.ts` enforces it.

`SUPERSEDED_SCRIPT_FILE_NAMES` adds one more needle, for the entries Girra wrote
under the shared `claude-hook` name. `createLegacyGirraCommandMatcher` scopes it
to `.girra/`, because an unscoped sweep of that name is the thing this section
exists to prevent.

Three consequences follow, and a real launch is what confirms them:

- Both apps' hooks fire on every Claude event. Each script reads its own pane's
  environment, so a Girra pane reports to Girra's hook server and an Orca pane to
  Orca's. A hook never crosses to the other app's store, but a pane does post
  twice to its own.
- `statusLine` is a single slot, so one app owns it. Neither app recognises the
  other's statusline script, so neither steals the slot and the first to find it
  empty keeps it. When Orca holds it, Girra falls back to the OAuth usage poll.
- Two home trees means two hook-install locks, so the apps no longer serialize
  their merges into the file. Each merge is read-modify-write with an atomic
  rename and touches only its own entries, so a simultaneous launch can drop one
  app's entries until its next install.

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

## Retiring the seams

Drop `adoptLegacyOrcaEnvNames` and `applyLegacyOrcaEnvAliases` with their call
sites once no supported host predates the rename, alongside the other
compatibility shims listed in `prompt.md`.

`getGirraHomeDirWithLegacyFallback` and `SUPERSEDED_SCRIPT_FILE_NAMES` go on the
same terms. The script names do not: they keep Girra's entries separable from a
coexisting Orca's for as long as both apps are installed.
