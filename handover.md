# Girra Handover

Facts, each dated when measured. Check a fact against its source before acting on it.

## Status

As of 2026-09-18: every phase through 7b is merged, with the ADRs, the cross-version harness deletion, the remote serving cleanup and kothar install, the workflow prune with the signed macOS build, and the mobile client prune. The documentation command sweep is merged, the desktop's own CLI strings follow it, the orchestration wire enum accepts `girra`, and the runtime's recovery strings now name `girra` with the SSH relay installing that name too. The app was launched and the e2e suite run for the first time on 2026-09-19, which found the `ORCA` wordmark and a set of stale specs. The user answered three open decisions on 2026-09-18, and all three are built. The take-back deletion went ahead on 2026-09-19 once tracing established what the path actually was: an orphaned API stack with no caller, beside a reclaim that works. Actions is still disabled, and the repository has no Apple signing secrets yet.

- Feature selection is final: 432 kept, 103 dropped. See [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md).
- The build is a fork of Orca with rejected features deleted. See [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) for phases, order and verification.
- `koinonau/girra` is private on GitHub, moved from `shanedolley/girra` on 2026-09-13; GitHub redirects the old URL. Its `main` holds Orca's code at the surveyed commit, with history older than 2026-08-29 squashed.
- Phase 0 merged in [#4](https://github.com/koinonau/girra/pull/4): `mise.toml`, the baseline, and `cloud/` added to the deletion table.
- ADRs [0001](docs/adr/0001-fork-orca-and-delete.md) and [0002](docs/adr/0002-keep-internal-orca-identifiers.md) merged in [#5](https://github.com/koinonau/girra/pull/5).
- The cross-version wire harness deletion merged in [#6](https://github.com/koinonau/girra/pull/6).
- Phase 1 merged in [#7](https://github.com/koinonau/girra/pull/7): 2,222 files deleted and 380,483 lines removed, measured with `git diff --shortstat` across its merge commit.
- Phase 2 merged in [#8](https://github.com/koinonau/girra/pull/8): star-nag, voice input and the updater. 245 files deleted, 45,450 lines removed.
- Phase 3a merged in [#9](https://github.com/koinonau/girra/pull/9): artifacts, skill sharing, the cloud relay, push, mobile pairing, and Orca profiles and accounts. 486 files deleted, 77,388 lines removed.
- Phase 3b merged in [#10](https://github.com/koinonau/girra/pull/10): crash reporting. 108 files deleted, 23,966 lines removed.
- Phase 3c merged in [#11](https://github.com/koinonau/girra/pull/11): telemetry and the hang watchdog that only fed it. 135 files deleted, 23,837 lines removed.
- Phase 4a merged in [#12](https://github.com/koinonau/girra/pull/12): the managed hook integrations for 14 agent CLIs and Cursor's trust bypass. 94 files deleted, 20,455 lines removed.
- Phase 4b merged in [#13](https://github.com/koinonau/girra/pull/13): Gemini, Grok, Kimi and Antigravity usage, the Grok account check and the Grok stats pane. 30 files deleted, 6,923 lines removed.
- Phase 6 merged in [#14](https://github.com/koinonau/girra/pull/14): the feature wall, contextual tours and first-run onboarding. 189 files deleted, 27,662 lines removed.
- Phase 5a merged in [#15](https://github.com/koinonau/girra/pull/15): Codex accounts, managed homes, reset credits, rate limits, usage, the CLI lock, the per-pane account registry and stale-pane restart. 254 files deleted, 58,851 lines removed.
- Phase 5b merged in [#19](https://github.com/koinonau/girra/pull/19): Codex out of the PTY and shell environment, hooks, trust, startup, the agent-hooks CLI and RPC, and renderer terminal special cases. 179 files deleted, 41,801 lines removed.
- Phase 5c merged in [#20](https://github.com/koinonau/girra/pull/20): OMP and Prime Agent out of Pi, and the dropped agents' title, keyboard, readiness and output-scraping special cases. 73 files deleted, 19,596 lines removed.
- Phase 5d merged in [#21](https://github.com/koinonau/girra/pull/21): Codex and dropped agents out of structured sessions, native chat, AI Vault and resume, and `src/main/codex` deleted. 252 files deleted, 55,947 lines removed.
- Phase 5e merged in [#22](https://github.com/koinonau/girra/pull/22): `TuiAgent` and every registry shrunk to `claude`, `claude-agent-teams`, `opencode` and `pi`; the agent trust preset system, the `codex-cli/command.ts` shim, the Codex-only e2e specs and the dropped agents' icons and docs deleted; about 1,000 test files retargeted. 71 files deleted, 20,787 lines removed.
- The remote serving cleanup and kothar install merged in [#23](https://github.com/koinonau/girra/pull/23): it removes `serve --mobile-pairing`, the mobile device scope, the mobile RPC allowlist, E2EE version 2, the mobile markdown tab and notification RPCs, and the remote skill install API and relay handler, and adds "Install kothar" to the Skills page. 163 files deleted, 27,661 lines removed.
- Phase 7a merged in [#16](https://github.com/koinonau/girra/pull/16): the in-app feedback form and the plugin kill-list fetch, the last calls to Orca's servers apart from the Help menu links. 22 files deleted, 4,552 lines removed.
- The Phase 7b text sweep renames displayed capital `Orca` to `Girra` across the six locale catalogues and their pinned override scripts, the renderer, shared and preload strings, the main process, CLI and relay, the skill guides and the documentation. It merged in [#24](https://github.com/koinonau/girra/pull/24): 1,958 files changed, 7,829 lines added and 7,827 removed.
- Phase 7b's identity constants move what the operating system sees: `productName` `Girra`, `appId` `com.koinonau.girra` with the native Swift owner check, the executable names, the NSIS product id, the Windows daemon host root, the Casks, and the CLI installed as `girra` with `orca`, `orca-ide` and `orca-dev` kept as aliases. It merged in [#25](https://github.com/koinonau/girra/pull/25): 309 files changed, 2,357 lines added and 2,012 removed.
- The workflow prune keeps `pr.yml`, `unit-tests.yml`, `e2e.yml` (dispatch only) and a new `mac-build.yml` that signs and notarizes an arm64 DMG, and deletes the other 33 workflows with the release scripts and contract tests they owned. It merged in [#26](https://github.com/koinonau/girra/pull/26): 87 files deleted, 16,681 lines removed.
- The mobile client prune merged in [#27](https://github.com/koinonau/girra/pull/27): the presence lock, the driver subsystem, phone fit, the driver overlays, ten uncalled RPC methods and the legacy terminal subscription path. 67 files deleted, 18,972 lines removed.
- The documentation command sweep writes `girra <verb>` in every `docs/**` example and corrects the Linux CLI name. It merged in [#29](https://github.com/koinonau/girra/pull/29): 33 files changed, 432 lines added and 424 removed. Measured 2026-09-18 with a verb-anchored `rg` over `docs/`: 0 files still write `orca <verb>`, down from 29.
- The desktop string sweep writes `girra <verb>` in the 55 strings the app prints about its own local CLI: seven source files and the six locale catalogues. It merged in [#30](https://github.com/koinonau/girra/pull/30).
- **The app runs.** First launch and e2e run of this fork, 2026-09-19: a fresh profile reaches Landing, a seeded workspace opens, and a shell command round-trips through a real PTY, with no renderer console errors. Runtime identity reads `Girra Dev`, window title `Girra`.
- The Landing wordmark said `ORCA`. The Phase 7b sweep renamed capital `Orca` and never matched all-caps, so the most prominent brand string in the app kept the old name until 2026-09-20.
- The orphaned desktop take-back stack is deleted: `reclaimTerminalForDesktop`, the `runtime:restoreTerminalFit` IPC, the preload bridge, the renderer restore actions and their shared deadline constant. 344 lines removed across four deleted files, plus edits in eight more.
- The install documentation names girra's own artifacts and points at `koinonau/girra/releases`. Those links 404 until a release exists, which the user accepted. The Homebrew cask and AUR instructions are gone: girra publishes to neither, so following them installed Orca.
- The 41 runtime recovery strings name `girra`. The SSH relay installs `girra` beside `orca` on every host, and `retargetCliOutputCommandName` rewrites the name to whatever the caller actually has, so a host whose best-effort shim refresh failed still reads a command it can run.
- The orchestration wire enum accepts `girra` and `girra-dev`. It merged in [#31](https://github.com/koinonau/girra/pull/31). Only the host side moved; the CLI still normalises down, because a host built before the widening rejects the new spelling and fails the whole call.

## Files

At the repository root, beside Orca's code.

| File | Holds |
|---|---|
| [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) | Phases 0-8, deletion table, identity strip, open decisions |
| [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md) | The selection, nested by module. Authoritative |
| [ORCA-FEATURE-INVENTORY.md](ORCA-FEATURE-INVENTORY.md) | The flat survey the tree came from. Superseded; kept for history |
| `mise.toml` | Pins Node 24 for this repository |
| `docs/adr/` | Architecture decision records |
| `prompt.md` | How to work, and "Start here" |

## Board

No tracker. Linear holds no girra or orca project and no matching issue: `lincli project list --newer-than all_time --limit 100` returned 18 projects, none matching (2026-09-13), and `lincli search projects girra` and `lincli issue search girra` found nothing (2026-09-14). Limits above 100 fail with "Query too complex".

Until a tracker exists, the phases in the build plan are the backlog.

## Repository

`~/Development/koinonau/girra`, pushed to `koinonau/girra` (private).

| Remote | Points to |
|---|---|
| `origin` | `koinonau/girra` |
| `upstream` | `stablyai/orca`. Push URL set to `DISABLED` |

- Show the head with `git log -1 --format='%h %ad %s' --date=short main`. On 2026-09-13 it matched Orca `403b62a8d`, upstream/main from 2026-09-12, v1.4.197, apart from the planning files at the root (`git diff --stat orca-full-history main`).
- **History is squashed.** The first 1,308 commits of `main` are Orca's: one root commit holding Orca's tree at `51ed7d4f6` (2026-08-29) in place of 9,426 older commits, then the 1,307 later Orca commits with their original authors. Girra's own commits follow. Estimated at 89 MiB of objects, down from 219 MiB (2026-09-13).
- **`main` shares no ancestry with upstream** (`git merge-base main upstream/main` finds none). Take upstream fixes with `git cherry-pick` after `git fetch upstream`. `git merge upstream/main` fails as unrelated histories.
- **`orca-full-history`** is a local-only branch at Orca `403b62a8d` holding all 10,733 commits. It exists in this clone alone and is the only place `git blame` reaches past 2026-08-29. Measure upstream drift against it: `git fetch upstream && git rev-list --count orca-full-history..upstream/main` gave 189 (2026-09-14).
- **Release tags are incomplete.** The clone holds 860 of Orca's tags (`git tag | wc -l`), only those reachable when history was fetched; `v1.4.190` is absent, and the survey clone at `~/Development/github_clones/orca` has it (2026-09-14). Nothing needs them since the cross-version harness went. None were pushed.
- No Git LFS; largest blob 8.2 MB (`docs/assets/readme-feature-showcase.gif`).
- **GitHub Actions is disabled** on the repository (`gh api repos/koinonau/girra/actions/permissions` returns `"enabled":false`, 2026-09-14). 36 workflows remain after Phase 1 removed the 29 for mobile and cloud (`git ls-files .github/workflows | wc -l`), including Orca's hourly macOS build.
- Branch protection and rulesets are unavailable: the rulesets API returns 403 and asks for a paid plan on this private repository (2026-09-13).
- `pnpm install` runs husky, which sets `core.hooksPath` to `.husky/_`. The only hook is `pre-commit`, running `pnpm exec lint-staged`.
- Licence: MIT.
- The survey clone at `~/Development/github_clones/orca` still exists at Orca `403b62a8d`. Its `origin` is `shanedolley/orca`, a stale standalone copy. Girra does not depend on it.

## Commands

Run in this repository through mise, so Node 24 and pnpm 12 apply: prefix each with `mise exec --`, or use a shell where `mise activate` has run. Set `ORCA_BACKGROUND_LAUNCH=1` for tests, as `AGENTS.md` requires, so Electron windows stay hidden.

| Purpose | Command |
|---|---|
| Install | `mise exec -- pnpm install --frozen-lockfile` |
| Typecheck | `mise exec -- pnpm tc`, an alias of `pnpm typecheck`. Narrower: `tc:node`, `tc:cli`, `tc:web` |
| Unit tests | `ORCA_BACKGROUND_LAUNCH=1 mise exec -- pnpm test`, or append file paths (Vitest, `config/vitest.config.ts`) |
| Lint | `mise exec -- pnpm lint` for everything. `pnpm run check:code-quality:changed` for changed files |
| Format | `mise exec -- pnpm format` |
| Build | `mise exec -- pnpm build`, desktop and native |
| Run the app | `mise exec -- pnpm dev` |
| Commit | `mise exec -- git commit`, so the pre-commit hook finds pnpm 12 |

## CLI Names

Measured 2026-09-18 from `package.json` `bin`, `src/shared/orca-cli-command-name.ts`,
`src/main/cli/cli-install-constants.ts`, `src/main/cli/bundled-cli-launcher-path.ts` and
`config/electron-builder.config.cjs`.

| Surface | Name |
|---|---|
| The command to type, every platform | `girra` (`girra.cmd` on Windows) |
| Aliases kept for hosts and scripts written before the rename | `orca` everywhere, `orca-ide` on Linux |
| Dev CLI | `girra-dev`, with `orca-dev` and `orca` as aliases |
| Linux executable, AppImage, deb and rpm package | `girra` |
| Artifacts | `girra-macos-${arch}.dmg`, `girra-windows-setup.exe`, `girra-linux.AppImage`, `girra_${version}_${arch}.deb`, `girra-${version}.${arch}.rpm` |

`orca-ide` no longer exists to dodge GNOME Orca: `girra` never collided with
`/usr/bin/orca`, so Linux takes the same name as every other platform. The alias
stays because hook scripts and SSH hosts on disk still call it.

**On an SSH host `orca` stays primary, with `girra` installed beside it.**
`createRemoteCliInstallPlan` (`src/main/ssh/ssh-remote-cli-launcher.ts`) now
writes both names from one script, and copies the compiled `orca.exe` to
`girra.exe` on Windows. `orca` keeps the primary slot because a host reached by a
client that predates this install has only that one, and
`ssh-remote-cli-host-passthrough.ts:116` still pins `ORCA_CLI_COMMAND=orca` to
match. So `orca <verb>` in `src/main/ssh` help text is correct, not stale.

**The install is best-effort, which is why the CLI also rewrites the name.**
`installRemoteOrcaCliLauncher` runs on every relay session setup
(`ssh-relay-session.ts:1066`) but its caller warns instead of failing the
connection, because it can fail on a `MaxSessions=1` remote. So a host can keep
an old `orca`-only shim. `retargetCliOutputCommandName`
(`src/cli/cli-output-command-name.ts`) closes that gap: the runtime writes the
canonical `girra <verb>`, and the CLI process rendering the error rewrites it to
whatever `resolveOrchestrationCliExecutable` says the caller has, on both the
human and `--json` paths.

`resolveOrchestrationCliExecutable` (`src/cli/runtime/orchestration-recovery-command.ts`)
is how a caller learns its own name: `ORCA_CLI_COMMAND` first, then `girra-dev`
in a dev checkout, then `girra`. `src/cli/orchestration-mutation-recovery.ts`
already uses it, rebuilding the recovery command from the caller's own
executable rather than trusting the name the runtime wrote.

**On the orchestration wire the CLI still sends a pre-rename token.** The host's
`compatibilityCliCommand` enum accepts `girra`, `girra-dev`, `orca`, `orca-ide`
and `orca-dev`, and `compatibilityWindowsCommand` accepts `girra`, `orca` and
`orca-ide` (`src/shared/rpc-contract/orchestration-params.ts`), but
`resolveCompatibilityCliCommand` in
`src/cli/handlers/orchestration/runtime-compatibility.ts` still maps `girra` down
to an alias. Send the new spelling once no supported host predates the widening.
`src/cli/handlers/orchestration-compatibility-cli-command-wire.test.ts` is what
makes that safe to do.

**Names the rename did not touch,** because they are internal identifiers under
[ADR 0002](docs/adr/0002-keep-internal-orca-identifiers.md): the SSH relay shim
at `~/.orca-relay/bin/orca`, the updater cache directory `orca-updater`,
`orca-data.json`, `orca.yaml`, `.orca/` and `ORCA_*`.

## Baseline

Phase 0, run on 2026-09-14 against `main` at Orca `403b62a8d` plus the planning files, sequentially on this laptop. Logs were not committed; rerun a command to reproduce.

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 31 s | No errors. Prints nothing on success |
| `pnpm test` | 1 | 772 s | Files: 9 failed, 8,507 passed, 62 skipped of 8,579. Tests: 11 failed, 79,363 passed, 407 skipped of 79,792. 2 unhandled errors |
| `pnpm lint` | 0 | 52 s | No oxlint findings. 122 reliability gates, 7 grandfathered max-lines suppressions, 171 ts-nocheck files, 14,262 English locale keys |
| `pnpm build` | 0 | 41 s | Main 5,721 modules, renderer 12,447. Native Swift helpers built |

Six of those 11 failures were `release-checkout` tests, and two cross-version files errored, all for want of tag `v1.4.190`. The harness deletion removed them.

After Phase 1, on 2026-09-14, with `out/` left by an earlier build:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 5 s | No errors. Incremental: `config/*.tsbuildinfo` caches earlier runs |
| `pnpm test` | 1 | 1,208 s | Files: 6 failed, 8,504 passed, 61 skipped of 8,571. Tests: 7 failed, 79,328 passed, 388 skipped of 79,723 |
| `pnpm lint` | 0 | 59 s | 118 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 22 s | Desktop and native |

After Phase 2, on 2026-09-14:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 730 s | Files: 5 failed, 8,412 passed, 61 skipped of 8,478. Tests: 5 failed, 78,421 passed, 388 skipped of 78,814 |
| `pnpm lint` | 0 | 47 s | 118 reliability gates; ratchets unchanged; 1,562 English locale entries not statically referenced |
| `pnpm build` | 0 | Untimed | Main 5,633 modules, renderer 12,388. It failed until the speech worker's build entry was removed |

After Phase 3a, on 2026-09-14:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 14 s | No errors |
| `pnpm test` | 1 | 722 s | Files: 7 failed, 8,233 passed, 61 skipped of 8,301. Tests: 7 failed, 77,086 passed, 386 skipped of 77,479. Two of the seven were fixtures naming deleted code, fixed before merge; the other five are the known failures below |
| `pnpm lint` | 0 | 49 s | 115 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 18 s | Main 5,505 modules, renderer 12,220 |

After Phase 3b, on 2026-09-14:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 3 s | No errors |
| `pnpm test` | 1 | 875 s | Files: 5 failed, 8,187 passed, 61 skipped of 8,253. Tests: 5 failed, 76,550 passed, 385 skipped of 76,940. Only the known failures below |
| `pnpm lint` | 0 | 53 s | 114 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 20 s | Main 5,467 modules, renderer 12,195 |

After Phase 3c, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 21 s | No errors |
| `pnpm test` | 1 | 631 s | Files: 5 failed, 8,131 passed, 61 skipped of 8,197. Tests: 5 failed, 76,016 passed, 385 skipped of 76,406. Only the known failures below |
| `pnpm lint` | 0 | 43 s | 114 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 16 s | Main 5,422 modules, renderer 12,165 |

After Phase 4a, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 6 s | No errors |
| `pnpm test` | 1 | 668 s | Files: 7 failed, 8,100 passed, 61 skipped of 8,168. Tests: 9 failed, 75,656 passed, 355 skipped of 76,020. Two files were the child-process ratchets, fixed before merge (both pass alone, 8 tests); the other five are the known failures below |
| `pnpm lint` | 0 | 46 s | 114 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 18 s | Main 5,361 modules, renderer 12,165 |

After Phase 4b, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 3 s | No errors |
| `pnpm test` | 1 | 678 s | Files: 5 failed, 8,089 passed, 61 skipped of 8,155. Tests: 6 failed, 75,542 passed, 355 skipped of 75,903. Only the known files below; `claude-structured-real-cli` failed a second, load-flaky case |
| `pnpm lint` | 0 | 50 s | 114 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 18 s | Main 5,350 modules, renderer 12,161 |

After Phase 6, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 685 s | Files: 5 failed, 8,057 passed, 61 skipped of 8,123. Tests: 5 failed, 75,326 passed, 355 skipped of 75,686. Only the known failures below |
| `pnpm lint` | 0 | 48 s | 114 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 19 s | Main 5,349 modules, renderer 12,054 |

After Phase 5a, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 1, then 0 | 5 s | Two errors the subagents had reported clean: a stale re-export in `orca-runtime.ts` and a `'codex'` status bar id in a typed test fixture. Fixed, then clean |
| `pnpm test` | 1 | 668 s | Files: 6 failed, 7,950 passed, 60 skipped of 8,016. Tests: 6 failed, 74,327 passed, 351 skipped of 74,684. The five known failures plus `terminal-pane-hook-order-parity`, whose pin moved from 209 to 207 hooks with the restart state; fixed and passing alone |
| `pnpm lint` | 0 | 48 s | 114 reliability gates; ratchets lowered (`DIRECT_IMPORTER_PIN` 147, `UNHIDDEN_SPAWNER_PIN` 63) |
| `pnpm build` | 0 | Untimed | Failed on the typecheck step, then passed after the fix. Main 5,256 modules, renderer 12,025 |

After Phase 7a, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 643 s | Files: 5 failed, 7,943 passed, 60 skipped of 8,008. Tests: 5 failed, 74,208 passed, 351 skipped of 74,564. Only the known failures below |
| `pnpm lint` | 0 | 42 s | 114 reliability gates; ratchets unchanged |
| `pnpm build` | 0 | 15 s | Main 5,250 modules, renderer 12,019 |

After Phase 5b, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 3 s | No errors |
| `pnpm test` | 1 | 773 s | Files: 11 failed, 7,864 passed, 57 skipped of 7,932. Tests: 12 failed, 73,216 passed, 332 skipped of 73,560. The five known failures plus six stale tests (a deleted-file boundary check, two inventory entries, a CLI import floor, three commit-message env expectations), fixed before merge and passing alone (48 tests) |
| `pnpm lint` | 0 | 45 s | 113 reliability gates (the Codex state-DB backfill gate lost its tests); `DIRECT_IMPORTER_PIN` 145 |
| `pnpm build` | 0 | 17 s | Renderer 12,014 modules |

After Phase 5c, on 2026-09-15:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 696 s | Files: 6 failed, 7,846 passed, 56 skipped of 7,908. Tests: 6 failed, 72,439 passed, 321 skipped of 72,766. The five known failures plus the load-flaky `relay/subprocess.test.ts`, which passes alone (32 tests) |
| `pnpm lint` | 0 | 42 s | 113 reliability gates |
| `pnpm build` | 0 | 16 s | Main 5,138 modules, renderer 12,001 |

After Phase 5d, on 2026-09-16:

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 5 s | No errors |
| `pnpm test` | 1 | 1,128 s | Files: 7 failed, 7,742 passed, 56 skipped of 7,805. Tests: 7 failed, 71,096 passed, 321 skipped of 71,424. The five known failures, the load-sensitive `browser-history-match.performance.test.ts` (passes alone), and `tests/e2e/completed-worker-retirement-resume.unit.test.ts`, which recorded a Codex worker; retargeted to Claude and passing |
| `pnpm lint` | 1, then 0 | 19 s | Six type-aware `restrict-template-expressions` warnings where narrowed provider types became `never` in runtime guards; fixed with `String(...)`. Then clean, 113 reliability gates, `DIRECT_IMPORTER_PIN` 143 |
| `pnpm build` | 0 | 26 s | Main 5,004 modules, renderer 11,992 |

After Phase 5e, on 2026-09-16 (run with `/opt/homebrew/bin` first on `PATH` and `DEVELOPER_DIR=/Library/Developer/CommandLineTools`, see Traps):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 575 s | Files: 5 failed, 7,736 passed, 56 skipped of 7,797. Tests: 6 failed, 70,805 passed, 320 skipped of 71,131. Four known failures, plus `preflight-agent-detection-no-subprocess`, whose guardrail expected 20 probe commands; lowered to 3 and passing. `skill-recipe-shell` passed, because Homebrew bash 5 was first on `PATH` |
| `pnpm lint` | 1, then 0 | 6 s | Five `import/no-duplicates` warnings where the shim swap left two imports from one module; merged. Then clean, 113 reliability gates |
| `pnpm build` | 0 | 107 s | Renderer 11,963 modules |

After the remote serving cleanup and kothar install, on 2026-09-16 (same `PATH` and `DEVELOPER_DIR`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 554 s | Files: 4 failed, 7,681 passed, 45 skipped of 7,730. Tests: 4 failed, 70,437 passed, 282 skipped of 70,723. The four known failures; `skill-recipe-shell` passed with Homebrew bash first on `PATH` |
| `pnpm lint` | 0 | 41 s | Clean, 112 reliability gates |
| `pnpm build` | 0 | 16 s | Renderer 11,961 modules |

After the Phase 7b text sweep, on 2026-09-16 (same `PATH` and `DEVELOPER_DIR`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 3 s | No errors |
| `pnpm test` | 1 | 552 s | Files: 8 failed, 7,677 passed, 45 skipped of 7,730. Four are the known failures; the other four are the `config/scripts/*-skill-guidance.test.mjs` files, which assert guide prose and sat outside every agent's area. Renamed and passing, 63 tests |
| `pnpm lint` | 0 | 41 s | Clean, 112 reliability gates |
| `pnpm build` | 0 | 15 s | Renderer 11,961 modules |

After Phase 7b's identity constants, on 2026-09-16 (same `PATH` and `DEVELOPER_DIR`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 5 s | No errors |
| `pnpm test` | 1 | 550 s | Files: 8 failed, 7,679 passed, 45 skipped of 7,732. Four are the known failures; the other four are `src/main/cli` installer tests asserting the "non-Orca command" refusal text the lead renamed. Renamed and passing, 211 tests |
| `pnpm lint` | 0 | 42 s | Clean, 112 reliability gates |
| `pnpm build` | 0 | 33 s | Renderer 11,961 modules |

After the workflow prune, on 2026-09-16 (same `PATH` and `DEVELOPER_DIR`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 553 s | Files: 4 failed, 7,650 passed, 45 skipped of 7,699. The four known failures only |
| `pnpm lint` | 0 | 41 s | Clean, 112 reliability gates |
| `pnpm build` | 0 | 27 s | Renderer 11,961 modules |

After the mobile client prune, on 2026-09-16 (same `PATH` and `DEVELOPER_DIR`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 2 s | No errors |
| `pnpm test` | 1 | 611 s | Files: 4 failed, 7,616 passed, 45 skipped of 7,665. The four known failures only |
| `pnpm lint` | 0 | 41 s | Clean, 111 reliability gates |
| `pnpm build` | 0 | 16 s | Renderer 11,961 modules |

After the documentation command sweep, on 2026-09-18 (`DEVELOPER_DIR=/Library/Developer/CommandLineTools`, stock `/bin/bash` on `PATH`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 20 s | No errors |
| `pnpm test` | 1 | 1,151 s | Files: 7 failed, 7,613 passed, 45 skipped of 7,665. Tests: 7 failed, 69,778 passed, 279 skipped of 70,064. Five are the known failures, `skill-recipe-shell` among them because Homebrew bash was not first on `PATH`; the other two are load-flaky and passed alone |
| `pnpm lint` | 0 | 44 s | Clean, 111 reliability gates |
| `pnpm build` | 0 | 24 s | Renderer 11,950 modules |

After the desktop string sweep, on 2026-09-18 (same `DEVELOPER_DIR`, stock `/bin/bash`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 18 s | No errors |
| `pnpm test` | 1 | 599 s | Files: 5 failed, 7,615 passed, 45 skipped of 7,665. Tests: 5 failed, 69,780 passed, 279 skipped of 70,064. The five known failures and nothing else |
| `pnpm lint` | 0 | 45 s | Clean, 111 reliability gates. Inline defaults differing fell from 38 to 37 |
| `pnpm build` | 0 | 38 s | Renderer 11,950 modules |

After the orchestration wire widening, on 2026-09-18 (same `DEVELOPER_DIR`, stock `/bin/bash`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 21 s | No errors |
| `pnpm test` | 1 | 590 s | Files: 5 failed, 7,616 passed, 45 skipped of 7,666. Tests: 5 failed, 69,794 passed, 279 skipped of 70,078. The five known failures and nothing else |
| `pnpm lint` | 0 | 43 s | Clean, 111 reliability gates |
| `pnpm build` | 0 | 35 s | Desktop and native |

After the SSH shim and runtime string sweep, on 2026-09-18 (same `DEVELOPER_DIR`, stock `/bin/bash`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 22 s | No errors |
| `pnpm test` | 1 | 1,555 s | Files: 9 failed, 7,613 passed, 45 skipped of 7,667. Five are the known failures; the other four are load-flaky and passed alone. The run was heavily loaded, which is why it took twice the usual time |
| `pnpm lint` | 0 | 44 s | Clean, 111 reliability gates |
| `pnpm build` | 0 | 45 s | Desktop and native |

After deleting the take-back stack, on 2026-09-19 (same `DEVELOPER_DIR`, stock `/bin/bash`):

| Command | Exit | Time | Result |
|---|---|---|---|
| `pnpm tc` | 0 | 20 s | No errors |
| `pnpm test` | 1 | 679 s | Files: 5 failed, 7,612 passed, 45 skipped of 7,662. Tests: 5 failed, 69,796 passed, 279 skipped of 70,080. The five known failures and nothing else |
| `pnpm lint` | 0 | 43 s | Clean, 111 reliability gates, 165 ts-nocheck files after pruning the deleted one |
| `pnpm build` | 0 | 36 s | Desktop and native |

A phase matches the baseline when these, and only these, fail. Rerun any other failure alone before calling it a regression:

| Tests | Failing | Cause |
|---|---|---|
| `src/main/runtime/orchestration-cli-subprocess.test.ts` | 1 | Runs only when `out/cli/index.js` exists (`describeIfBuilt`), so Phase 0, which tested before building, skipped it. The spawned CLI exits 1. Not yet root-caused |
| `config/scripts/skill-recipe-shell.test.mjs` | 1 | macOS `/bin/bash` is 3.2 and rejects an empty `"${array[@]}"` under `set -u` |
| `src/main/claude/claude-structured-real-cli.test.ts` | 1 | Runs the real `claude` binary; this machine's commands do not match the fixture |
| `src/main/claude/claude-tui-resume-real-binary.integration.test.ts` | 1 | Runs the real `claude` binary |
| `src/main/daemon/repro-13767-shell-ready-marker-lost-to-exec.test.ts` | 1 | Times out waiting for a real bash profile prompt |

Load-flaky: these failed under a full suite and passed alone (2026-09-14):

- `src/main/daemon/daemon-reattach-checkpoint-isolation.test.ts`, `ENOTEMPTY` in teardown.
- `src/relay/subprocess.test.ts`, "uses configured grace after a detached relay has accepted a socket client".
- `src/main/claude/claude-structured-real-cli.test.ts`, "reports the current effort through get_settings".
- `src/main/runtime/rpc/terminal-output-frame-chunks-equivalence.test.ts`, an 800-trial fuzz that exceeds the 30 s test timeout under load (2026-09-18).
- `src/renderer/src/lib/palette-match/palette-match-performance.test.ts`, a wall-clock budget (2026-09-18).
- `src/main/daemon/pty-subprocess-io-failure-native.test.ts`, `src/main/native-chat/transcript-watch-liveness.test.ts`, `src/renderer/src/components/right-sidebar/ai-vault-session-worktree-map.test.tsx` and `src/renderer/src/lib/browser-history-match.performance.test.ts`, all four under one heavily loaded run (2026-09-18).

## End-to-end Suite

First run on this fork, 2026-09-19. `pnpm test:e2e` runs Playwright against a real
Electron app and is **not** part of `pnpm test`; the 349 spec files under
`tests/e2e/` had never executed here, and `e2e.yml` is dispatch-only with Actions
off.

Run it windowless: `ORCA_BACKGROUND_LAUNCH=1 SKIP_BUILD=1 pnpm exec playwright test
--config tests/playwright.config.ts --project=electron-headless`. Omit `SKIP_BUILD`
after a source change, because the suite needs its own `--mode e2e` build that
exposes `window.__store`. Switch native modules first with
`pnpm run ensure:electron-runtime`, and switch back with
`node config/scripts/ensure-native-runtime.mjs --runtime=node` or the unit suite
cannot load them.

| 2026-09-19 | Result |
|---|---|
| First run, 4 workers | 530 passed, 53 failed, 98 skipped, 7 did not run, 48 min |
| The 53 rerun alone at 1 worker | 11 passed, 42 failed |

**Use 2 workers on this laptop, not 4.** Four parallel Electron instances drove the
load average to 53 on 10 cores, and every one of the 11 that passed alone had failed
in that window, three of them after 18 minutes against a 120 s budget.

The 42 deterministic failures, as classified on 2026-09-19:

| Cause | Count | Standing |
|---|---|---|
| Stale assertions from the rename | 9 | Fixed 2026-09-20; the two `POINTER_COMMAND` constants said `orca-dev`, the app prints `girra-dev` |
| Specs for deleted features | 3 | Deleted 2026-09-20: `voice-microphone-selection` (2) and `dictation-indicator`, both for voice input, gone in Phase 2 |
| This laptop's `~/.zshrc` | 3 | Not a fork defect, proved 2026-09-20. Line 67 is `export PATH="/usr/local/bin:…"` with no `$PATH`, so it discards the stub directory the agent goldens prepend, and the stub is then `command not found`. Overriding `agentCmdOverrides.claude` with the stub's **absolute path** launches it in 5.6 s while the bare name still fails, so only `PATH` resolution is broken, not agent launch |
| `ORCA_BACKGROUND_LAUNCH` refusing a reveal | 2 | The guard working. Both specs need native focus or a visible window, which `AGENTS.md` keeps off the user's desktop |
| ~~Docker absent~~ | 0 | Wrong on 2026-09-19. Docker 29.5.2 was running the whole time and the image builds in 31 s; the build failed only under the load-53 window. `ephemeral-vm-provisioned-root` now fails a visibility assertion instead, so it moved to unattributed |
| Specs that need a runner's env vars | 2 | `paired-startup-exec-readiness` passes in the terminal-parking lane and `remote-session-bulk-open-freeze-repro` in its own; both fail in a plain suite run because no shard sets their gates |
| ~~Unattributed~~ | 0 | All 23 attributed on 2026-09-22 by the upstream A/B below: 12 pre-existing, 10 stale "Orca" text in specs (fixed), 1 flaky |

### Docker-gated lanes, 2026-09-21

26 specs self-skip without `ORCA_E2E_SSH_DOCKER`, so they never ran here either. Docker
29.5.2 runs them fine. Run each lane on its own: parallel Electron plus containers is
what poisoned the first suite run.

| Lane | Command | Result |
|---|---|---|
| Main SSH over Docker | `pnpm test:e2e:ssh-docker -- --grep-invert=@headful` | **32 passed**, 18.2 min |
| Watcher isolation | `pnpm test:e2e:ssh-docker-watcher-isolation` | **2 passed** |
| Terminal parking | `pnpm test:e2e:ssh-docker-terminal-parking` | **5 passed** |
| Bulk-open freeze | `pnpm test:e2e:ssh-docker-bulk-open-freeze` | **1 passed** |
| Relay perf | `pnpm test:e2e:ssh-docker-perf` | **4 passed**, latency budgets met |
| Nested runtime | `pnpm test:e2e:nested-runtime-ssh` | **2 failed, 3 did not run** |

That is 44 green tests over real SSH containers: remote PTYs, reconnects, transport
drops, cold activation, port forwards, the AI Vault history and client-hosted browsers.
It is the strongest evidence so far that the fork's SSH boundary survived, and it covers
the `girra`-beside-`orca` shim from [#33](https://github.com/koinonau/girra/pull/33),
which nothing else exercises end to end.

`--grep-invert=@headful` matters: the runner lists the `electron-headful` project, and
under `ORCA_BACKGROUND_LAUNCH=1` a headful spec fails on the reveal guard rather than
showing a window.

**Nested runtime has never run in any CI, upstream or here** — its gate,
`ORCA_E2E_NESTED_RUNTIME_SSH`, is set by no workflow, and `run-ssh-docker-e2e.mjs` says
so in its own comments. Both failures are behavioural, not stale assertions: a dialog
stays visible when the spec expects it hidden, and a renamed file never reaches a paired
client's explorer. Three more tests in the lifecycle file never ran, because Playwright
stops a file after its first failure. This is paired and remote code, the area the fork
pruned hardest, so it is the most likely place for a real regression and the least likely
to have a clean upstream baseline. Treat it as part of the attribution decision.

`ssh-egress-indicator-preview` and `ssh-routing-optout-demo` belong to no runner on
purpose: both are opt-in demos, and the first holds a window open for 20 minutes for a
human to watch. Not coverage gaps.

### Upstream A/B, 2026-09-22

**The fork introduced no e2e regression in app behaviour.** Every failure from the first
run is now accounted for, and none is a defect the fork put into the product.

Method: a detached worktree at `orca-full-history` (Orca `403b62a8d`, the fork point),
its own `node_modules`, and the same specs under the same conditions Girra failed them —
one worker, `ORCA_BACKGROUND_LAUNCH=1`. Telemetry off with `DO_NOT_TRACK=1` and
`ORCA_TELEMETRY_DISABLED=1`; upstream crashpad runs with `uploadToServer: false` and no
submit URL, and an unpackaged build runs no updater, so the run cannot phone home. A
passing upstream test that Girra fails is a regression; a test failing on both is not.
The install took 7 s because pnpm hardlinks from the shared store. The worktree was
removed afterwards; recreate it with `git worktree add --detach <dir> orca-full-history`,
copy `mise.toml` in, then `pnpm install --frozen-lockfile`.

| Of the 23 | Count | What |
|---|---|---|
| Pre-existing | 12 | Upstream fails them identically on this laptop: activity-agent-pane-isolation, github-created-issue-start-prefill, headless-paired-remote-terminal-retention-memory (2), runtime-host-status-recovery (2), terminal-korean-preedit-visibility, terminal-restart-persistence, worktree-switch-responsiveness, worktree (2), paired-remote-browser-link-open-routing |
| Stale "Orca" text | 10 | Specs asserting UI strings the app now renders as "Girra": ssh-config-host-import (4), ssh-config-host-picker (2), settings-skill-detection, browser-tab, paired-remote-terminal-browser-link, ephemeral-vm-provisioned-root. Fixed 2026-09-22 |
| Flaky | 1 | terminal-link-hover-after-worktree-return passes on rerun |

**Nested runtime is pre-existing too.** Upstream fails the same two tests at the same
assertions and blocks the same three. It was the lead candidate for a real regression,
because it touches the paired and remote code the fork pruned hardest; the A/B clears it.

`paired-remote-browser-link-open-routing` looked like a regression once: Girra failed in
the first context-menu open (line 284) where upstream got as far as line 304. A rerun put
Girra at 304 as well, so both fail at the same point and the early failure was flake.

Fixing the stale text meant 25 assertions across 9 files, including two specs that were
**passing** on the old text. `paired-browser-create-navigation-deadline` asserted a menu
item it simply had not reached yet, and `paired-quick-open-large-tree` asserted
`not.toContainText('Remote Orca runtime closed the connection')`: once the app said
"Girra", that guard passed without checking anything. Kept on purpose, because a fixture
supplies the text rather than the app: the demo plugin's `Hello Orca`, the marketplace
fixture's `Orca Plugins`, the seeded `Orca E2E Test Repo` README and the `Orca E2E` git
user.

**Why the terminal specs are suspect on this machine at all:** an e2e PTY sources the
real `~/.zshrc`, powerline prompt and all, even though the fixture isolates `HOME`.
Orca's zsh shell-integration wrapper sources the user's own config by design, and
`git log` shows no girra commit touched it.

## Environment

Measured 2026-09-14 on this laptop.

| Tool | Required | Resolved in this repository |
|---|---|---|
| Node | 24 (`package.json` engines) | v24.16.0 from mise, pinned by `mise.toml`. Global default stays v22.22.0 |
| pnpm | 12.0.0 (`packageManager`) | 12.0.0 through corepack's shim in mise's Node 24. Elsewhere `/opt/homebrew/bin/pnpm` is 10.33.0 and fails to switch |
| bash | Any | `/bin/bash` 3.2.57 |

## Databases

No command reaches an external database.

- **Tests** use in-memory SQLite and a fresh temporary user-data directory per test file, `$TMPDIR/orca-vitest-userdata-*`, removed on teardown (`config/scripts/vitest-host-ports-setup.ts`). Parallel runs share no state.
- **The app** keeps its state in `orca-data.json`, with a sidecar `orca-github-cache.json`, inside Electron's user-data directory (`src/main/persistence/loading-store/user-data-path.ts`). Development and production resolve separate directories. Electron derives the directory from the app name, so the Phase 7 rename gives girra a fresh one.

## Measurements

Taken at Orca `403b62a8d` by a Python walk over non-test `.ts` and `.tsx` files.

- **Deletion scope:** 197,983 lines across 27 directories (2026-09-13). `mobile/` holds 137,454; the four `codex*` directories hold 35,233. With `cloud/`, 226,348 lines: 12% of the 1,905,345 non-test source lines in `src/`, `mobile/` and `cloud/` (2026-09-14).
- **Runtime behind the CLI:** 265,344 lines across `src/main/runtime`, `src/relay`, `src/main/daemon` and `src/main/orcad` (2026-09-14).
- **`cloud/`:** 28,365 lines in 132 files, Orca's server-side `push`, `relay`, `relay-fence-broker` and `relay-ops` apps. Added to the deletion table and deleted in Phase 1 (2026-09-14).
- **Reliability gates:** 118 after Phase 1, which removed three gates whose tests all lived in the deleted trees and trimmed four more (2026-09-14). Still 118 after Phase 2, which trimmed `runtime.headless-desktop-promotion-continuity` and moved an AppImage startup check from `updater-setup-done` to `first-window-startup-services-ready`. 115 after Phase 3a, which removed `desktop-relay.assignment-backpressure`, `mobile-relay.endpoint-recovery` and `mobile-push.headless-startup-and-policy`. 114 after Phase 3b, which removed `terminal-observability.lifecycle-breadcrumbs`. Still 114 after Phase 3c, which trimmed the telemetry tests from `git-worktree.refresh-event-semantics`, and after Phase 4a, which trimmed a deleted listener test from `agent-status.manual-compact-identity` (2026-09-15).
- **Orca profiles reach:** 141 files outside `src/main/orca-profiles` name them, 38 in `src/main/browser`, which imports only `getOrcaProfileBrowserSessionPartition` (`git grep -l`, 2026-09-14).
- **Inbound references from outside each module:** star-nag 3, speech 10, updater 13, orca-profiles 27, crash-reporting 39, telemetry 45, codex 125 (2026-09-13).
- **Orca left in the locale catalogues:** 23 capital `Orca` across the six files, all code tokens or the kept Support and share-card copy, and 579 case-insensitive matches once `orca-cli`, `orca.yaml` and the scheme are counted (2026-09-18).
- **`onorca.dev` references:** one non-test file, `SidebarSettingsHelpMenu.tsx`, holding the Docs and Changelog links the user left in place (2026-09-18). The documentation still links there too.
- **Orca left in the source:** 113 capital `Orca` in non-test files, every one a keep: paths derived from `productName`, `TERM_PROGRAM`, the `X-Orca-*` headers, the font face, GNOME Orca, the marine creature and upstream URLs (2026-09-18). Lowercase `orca*` identifiers stay by ADR 0002.

## Decisions Made

All 2026-09-13 unless dated otherwise.

- 2026-09-12: reset the survey clone to `upstream/main`, discarding a half-finished merge of 221 commits and 3,392 staged files.
- Fork and delete rather than rebuild.
- Fork from `403b62a8d`, the commit every measurement used. Pull newer upstream commits later as a sync.
- Move the repository to the `koinonau` organisation; it already sat at `~/Development/koinonau/girra` locally.
- This directory is the repository, and `upstream` stays fetchable so upstream patches remain pullable by cherry-pick.
- Squash history older than 14 days, keeping 1,307 commits, and replace the already-pushed full history with `git push --force-with-lease`.
- Disable GitHub Actions until the workflows are pruned.
- 2026-09-14: pin Node through a committed `mise.toml` and get pnpm 12 from corepack, leaving the global Node untouched.
- 2026-09-14: Phase 3 deletes telemetry call sites outright rather than replacing them with no-ops.
- 2026-09-14: crash reporting keeps GPU fallback and renderer crash recovery, which the feature tree keeps, though it unticks the crash-reporting entries they live beside. Submission, the report store, breadcrumbs and minidump capture go.
- 2026-09-14: keep the default profile storage layout while deleting profiles; see [ADR 0003](docs/adr/0003-keep-the-default-profile-storage-layout.md).
- 2026-09-14: delete remote skill install from share links and cloud package versions with skill sharing, since Orca cloud was its only package source. The host-side install RPC and SSH relay skill handler stay.
- 2026-09-14: delete the mobile companion pairing page, its settings pane, the Orca Mobile sidebar button and QR generation with the cloud relay. The feature tree drops them, and both options of the web renderer decision remove them.
- 2026-09-14: delete remote server updates and the macOS serve update handoff with the updater, since only the updater used them. The CLI keeps foreground signal forwarding. The app version moves to `window.api.app.getVersion`.
- 2026-09-14: delete the cross-version wire harness, its CI job, its change-scope category, and the gate evidence citing it. It compared girra against Orca releases girra does not ship.
- 2026-09-15: delete the main-thread hang watchdog with telemetry. Its worker only wrote a marker that the telemetry event read.
- 2026-09-15: keep the startup payload field named `telemetry` (`agent_kind`, `launch_source`, `request_kind`). Terminal colour-query replies, tab launch agents and the Windows focus guard read it. Renaming it is Phase 7 work at most.
- 2026-09-15: remove telemetry-only RPC params (`telemetrySource` on `terminal.split` and `worktree.create`). Neither schema is strict, so older clients that still send the field have it stripped; a test for each proves it.
- 2026-09-15: the Privacy settings section now holds only local diagnostics. Its copy still says diagnostics go to support, and observability still honours `ORCA_TELEMETRY_DISABLED`; both wait for Phase 7.
- 2026-09-15: Phase 4a deletes only hook integrations. The 14 agents stay launchable, with title-based status, until the launch roster decision below. AI Vault session resume for them still works; it never used hooks.
- 2026-09-15: drop Cursor's workspace trust bypass as the feature tree says, and keep Copilot's trust preset and Claude's `DEVIN_PROJECT_DIR` guard while those agents stay launchable.
- 2026-09-15: leave the PowerShell execution-policy bypass in `windows-powershell-hook-launcher.ts`. Only Copilot's removed `.ps1` hook needed it, but it is part of an antivirus-scored payload documented in `docs/reference/windows-edr-posture.md`.
- 2026-09-15: the Grok stats pane goes with Grok usage fetching in Phase 4b. The tree keeps "Usage stats panes (Claude/Codex/OpenCode/Grok)" but unticks the Grok fetch, and the pane reads nothing else.
- 2026-09-15: delete the Antigravity usage mirror with the Gemini fetcher. It only republished the Gemini quota read; the tree has no separate entry for it.
- 2026-09-15: keep MiniMax usage fetching for now, although the tree unticks it, because the selection keeps MiniMax credentials and they serve only that fetch. See the open decision.
- 2026-09-15: the `ui.set` schema keeps the removed status bar ids (`gemini`, `antigravity`, `kimi`, `grok`) and the three `_*StatusBarDefaultAdded` flags as deprecated, because the schema is strict and would reject an older client's whole update. The TypeScript types are narrowed, and hydration drops the stale ids.
- 2026-09-15: the build plan had no phase for the feature wall, contextual tours and onboarding, which the tree unticks. Phase 6 took them with the relocation.
- 2026-09-15: drop `UsagePage.tsx` and the other tree-kept cards inside the feature wall (usage accounts, keep awake, AI commit and PR, browser use skill, orchestration setup). `UsagePage` is a looping animation with hardcoded numbers, not a usage dashboard, and each card was mounted only by the deleted feature wall body and duplicates a settings pane. The real usage UI is the stats panes and status bar. Relocated instead: the setup guide checklist, the default agent and notification setup steps, the inline command terminal, agent feature setup, and the feature tips orchestration visual.
- 2026-09-15: without onboarding, a fresh profile lands on Landing, the macOS notification prompt is requested at every startup (it guards itself), and a session that starts with no projects shows no app-open feature tip. Upgraded profiles keep their dismissed setup guide entry through a one-shot read of the retired `onboarding` block, which stays on disk.
- 2026-09-15: `ui.set` still accepts `contextualToursSeenIds` and `contextualToursAutoEligible`, stripped before saving, because its schema is strict. Feature interactions the tours used to record are recorded by `useFeatureInteractionWhileVisible`.
- 2026-09-15: Phase 5a keeps the Codex wire shapes older paired clients dereference: `AccountsSnapshot.codex` is always `{ accounts: [], activeAccountId: null }`, `RateLimitState` always publishes `codex: null`, a host `codexTarget` and empty `inactiveCodexAccounts`, `ui.set` accepts the `codex` status bar id, and the catalog keeps `codex-account-switching`. The Codex account RPC methods and the `accounts.codex-reset-credit.v1` capability are gone. Retired Codex settings keys are stripped on load; managed homes stay on disk.
- 2026-09-15: after 5a, Codex launches run on the user's own `~/.codex` (`prepareCodexRuntimeHomeForLaunch` returns null after the trust preset and real-home hook install). Known gaps until 5b to 5d: Windows has no Codex status hook install path, because the real-home lane still needs the shell probe; and resuming a legacy session from the shared mirror fails when the real-home lane is off.
- 2026-09-15: the index heal CI job and its contract tests went with the orphaned index heal module.
- 2026-09-15: remove the plugin kill-list's remote fetch, though the tree ticks it with a `[STRIP]` PHONE-HOME tag, because the selection drops phone-home. The plugin system and marketplace stay; nothing blocks a plugin now.
- 2026-09-15: delete `src/main/codex` files as soon as kept code stops reaching them, measured by an import walk from non-test files outside the directory, rather than waiting for the phase that owns the directory. A pull request must typecheck, and those files broke once hook types narrowed.
- 2026-09-15: the SSH relay's hook installer ignores agents it does not know instead of failing the whole install, so an older desktop asking for Codex hooks still gets Claude's.
- 2026-09-16: Phase 5e normalizes stored agent ids on load: `defaultTuiAgent` becomes `null` (auto-pick) unless `'blank'` or a kept agent; `commitMessageAi.agentId` and `sourceControlAi.agentId` become `null` unless a kept agent or custom; automations naming a dropped agent load disabled, show "Agent no longer available", and cannot be re-enabled until another agent is chosen. `worktree.create` `startupAgent`, `terminal.create` `launchAgent` and session tab agents turn an unknown id into `undefined`; explicit agent-session, automation and worker-start requests naming one are rejected. A `worktree.create` with a startup prompt and a retired agent is rejected rather than dropping the prompt.
- 2026-09-16: Phase 5e also drops the Hermes skill home (Hermes automations stay), adds no `@pi` orchestration group, keeps the Codex scratch-repo heuristic and `AGENT_PROCESS_NAMES`, and deletes the skill plugin-cache freshness scan, whose only input was the Codex plugin cache.
- 2026-09-16: deferred after 5e: the Windows input-record paste chain past its removed config field; the locale script brand lists and four stale Korean key overrides; collapsing the Pi title identity group; the SSH background `startupCommandDelivery: 'shell-ready'` chain, still reachable from paired, mobile and CLI clients; the PowerShell execution-policy bypass in `windows-powershell-hook-launcher.ts`, which may protect nothing now that no managed `.ps1` hook remains.
- 2026-09-16: Phase 5d keeps `AiVaultSession.codexHome: null` on the wire and the strict `ui.set` `codex` ids, but removes the Phase 5a Codex slots from `AccountsSnapshot` and `RateLimitState`, since girra does not pair with Orca. `aiVault.prepareSessionResume` and the Kimi and OMP resume capabilities are gone; creating or attaching a Codex structured session is rejected. The AI Vault search index and parse cache bump their schema versions and rebuild.
- 2026-09-16: known gaps after 5d. Copying an AI Vault resume command no longer refuses a session a structured chat owns (the terminal-send guards still block the paste). The deleted Codex rewind and integration tests covered concurrent rewind refusal, outcome-unknown rewind blocking sends, provider-exit reacquire and capability-less host refusal; no Claude test covers those yet.
- 2026-09-16: most code named "mobile" serves the web client and runtime-scope desktop clients too (`session.tabs.*`, `files.*`, version 1 E2EE, socket wiring, pairing files, tab selections), so it stays under its name. Removed: `serve --mobile-pairing` and its QR output (`orca_server_ready` still publishes `scope: 'runtime'` and `qr: null`), the `'mobile'` device scope (the registry drops mobile and scopeless entries on load rather than promoting them), the mobile RPC allowlist, E2EE version 2, the custom pairing address settings (stripped on load), `runtime.clientCapabilities.update`, `markdown.readTab` and `markdown.saveTab`, and the mobile notification RPCs and replay. Plugin notifications call the desktop surface directly. `protocolVersion` and `minCompatibleMobileVersion` stay in `status.get`; `mobile.tasks.v1` is no longer advertised.
- 2026-09-16: remote skill install is gone: 11 RPC methods, the upload sessions, placement transactions, startup install-journal recovery, the relay handler, and eight `skills.*` host capabilities. Discovery, freshness, update, delete (with its own recovery) and the CLI `skills install` stay. An install journal left by an older build is no longer recovered.
- 2026-09-16: "Install kothar…" sits in the Skills page's More actions menu. For a local or runtime environment host it opens an inline terminal with the wizard command pasted, and the user presses Enter. Each connected SSH host gets its own entry, which activates a repository or folder workspace on that host and runs the command in a new terminal tab; a host with no open workspace is disabled. Windows hosts are disabled. The gist URL has no revision, so it always serves the latest wizard.
- 2026-09-16: deferred after the remote serving cleanup: the mobile presence lock, driver overlays, phone-fit and display mode (`mobileAutoRestoreFitMs`, `terminal.setDisplayMode`, `terminal.resizeForClient`), the `clientKind: 'mobile'` unions and their dead branches, and RPC methods only the mobile app called (`files.readTerminalArtifact*`, `repo.sparsePresets`, `agentSession.commands`, `linear.resolveCurrentIssue` and others; check each for callers first).
- 2026-09-15: dropping OMP and title special cases changes hand-started CLIs: OMP started by hand in a Pi pane reports as Pi, and dropped CLIs started by hand get no title-based status. The renderer GPU gate now follows only the user setting, WebGL capability and context loss, since the Gemini fallback went.
- 2026-09-15 (user): keep remote serving, pairing and the web UI (option A); remove only the mobile leftovers (`--mobile-pairing`, mobile session tabs, the mobile RPC allowlist, mobile-scope devices).
- 2026-09-15 (user): workflows keep `pr.yml` and `unit-tests.yml` trimmed of Orca jobs and `e2e.yml` on demand, add one macOS build that signs and notarizes with the user's Apple developer account, and delete the rest; then re-enable Actions once the secrets exist (`MAC_CERTS`, `MAC_CERTS_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
- 2026-09-15 (user): delete remote skill install (the host-side `skills.install` API and the SSH relay skill handler). In its place, the Skills page gets an "Install kothar" action that opens a terminal on the chosen local or SSH host running the guided installer from gist `6d79d83dd27851d57fd1e346e04c7585` (`kothar-install-wizard.sh`, which installs the private `shanedolley/kothar` repository).
- 2026-09-15 (user): the launch roster keeps only Claude Code (with its Agent Teams launch mode), OpenCode and Pi. Codex and every other agent go, including OMP and Prime Agent, which share Pi's hooks.
- 2026-09-15 (user): keep MiniMax usage and credentials, although the tree unticks the usage fetch.
- 2026-09-15 (user): the app is named Girra, and the CLI binary is `girra`. `.orca/`, `ORCA_*` and the `orca://` scheme are not part of that decision and stay for now. The Help menu, Support section and share card are left as they are.
- 2026-09-16 (user): the renamed app uses the bundle id `com.koinonau.girra`. macOS treats it as a new app, so Full Disk Access, Accessibility, Screen Recording and notification permissions are granted again once, for the app and for the computer-use helper.
- 2026-09-16 (user): the rename ships a first-run migration. It copies the old user-data directory forward and re-encrypts safe-storage secrets while the old key still reads, leaving the originals in place. The only existing helper is `migrateMobilePairingDataToCanonicalUserDataPath` (`src/main/persistence/loading-store/user-data-path.ts:66`), which copies two files; its guards and comment are the template.
- 2026-09-16 (user): the CLI installs as both `girra` and `orca`, with `girra` primary, so hook scripts, skill guides and SSH hosts already written against `orca` keep working. Retire the alias in a later story.
- 2026-09-16: the Girra text sweep renames displayed capital `Orca` only. Kept: install and bundle paths derived from `productName`, `TERM_PROGRAM: 'Orca'` (third-party tools match it), `X-Orca-*` headers, `'Orca Nerd Font Symbols'`, GNOME Orca, the marine creature, `'Claude Code-credentials'`, upstream URLs and community labels, fixture repositories named Orca, and every lowercase `orca` code token. The locale toolchain lost its killer-whale brand repairs (`BRAND_MISTRANSLATIONS` and the re-Latinisation block in `locale-translation-policy.mjs`), which existed only to undo machine translations of "Orca".
- 2026-09-16: the mobile client prune removes what only a connected phone could reach, now that no client can produce `clientKind: 'mobile'`: the presence lock and mobile driver mixins, the driver-state subsystem with its `driver-changed` frame and `runtime:getTerminalDrivers`, phone fit and display mode, both driver overlays, ten RPC methods nothing called, and `terminal.subscribe` with the legacy binary subscription path. Girra ships both ends of its own wire, so the compatibility argument for the legacy path did not apply. Four legacy-subscribe suites were ported onto `terminal.multiplex` rather than deleted. Three chains died with it: the mobile background wake, the native-chat launch-draft resolution and its store action.
- 2026-09-16: the workflow prune keeps four workflows. `e2e.yml` is dispatch only, so `pr.yml` no longer runs end-to-end specs and the changed-spec routing that fed it is gone. `mac-build.yml` builds an arm64 DMG on `macos-latest`, signs and notarizes it with the five Apple secrets, verifies the staple before uploading, and publishes nothing. The dev channels, the release cut, the Homebrew bump and the Windows signing rehearsal are gone, along with the release scripts and `.github` actions only they used. Neither the credentials nor the notary round trip can be verified until Actions is on.
- 2026-09-16 (user): a packaged Girra does not adopt the installed Orca.app's profile. The two stay separate, so Orca keeps working and Girra never touches another app's live data.
- 2026-09-16: what the rename actually breaks, measured rather than assumed. The dev profile keeps its own directory (`orca-dev`, pinned in `configure-process.ts`), and Windows and Linux resolve their user-data directory from `package.json`'s `name`, still `orca`, because the file carries no `productName`. So only macOS moves, and a packaged Girra has no earlier profile of its own. The one real loss is the macOS safe-storage key, which Electron names after the app.
- 2026-09-16: instead of a bulk re-encryption, `decryptSealedSecret` in `src/main/host/legacy-orca-safe-storage.ts` reads the old key when the current one fails: it finds the pre-rename keychain item, derives Chromium's PBKDF2 key and decrypts the `v10` AES-128-CBC blob. Every secret path routes through it (the secret store port, both MiniMax stores, plugin secrets). Nothing is rewritten, so a failed read loses nothing and the next save reseals under the new key. `ORCA_CLAUDE_SERVICE` keeps its Orca name for the same reason: renaming it would orphan every managed Claude account behind a keychain prompt.
- 2026-09-16: `TERM_PROGRAM` stays `'Orca'`. Nothing in the repo reads it; the readers are third-party tools that feature-gate on the value.
- 2026-09-16: the CLI is `girra`, with `orca`, `orca-ide` and `orca-dev` shipped as aliases in the same directory every managed terminal puts on `PATH`, so hook scripts and SSH hosts written against the old name keep working. `girra` and `girra-dev` are normalised to the legacy token before crossing the orchestration RPC wire, because an older host's strict enum would reject them.
- 2026-09-16: two string pairs are parsed as well as displayed, so their text and their parser moved together: `ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX` with `orchestration/preamble.ts`, and `ORCA_LINE_PREFIX` with the truncation marker in `journal-payload-bounds.ts`. A capital-only sweep also misses lowercased copies compared with `toLowerCase()` or an `/i` regex; three existed in `src/shared`.
- Keep Claude, OpenCode, Pi and MiniMax credentials. Drop Codex and 13 minor agent CLIs.
- Drop the mobile companion, Orca cloud profiles, telemetry, crash submission, the updater, voice input, marketing pages, product tours and onboarding.
- Drop artifacts and skill sharing, which publish to `share.onorca.dev`. Skill install stays.
- Keep the Android emulator, all remaining desktop features, and remote SSH.
- Change every string a person reads. Leave the 359 internal `orca*` identifiers.

## Open Decisions

- **Help menu.** Its Docs and Changelog links point at `onorca.dev`, and its Discord and GitHub items at Orca's community. Remove the menu or repoint it. Left for now (user, 2026-09-15).
- **Star and support links.** The settings Support section stars and links `github.com/stablyai/orca`, and the usage share card says "Orca IDE" with that URL. Left for now (user, 2026-09-15).
- **`.orca/` and `ORCA_*`.** Renaming breaks existing worktrees and hook scripts. Keeping them leaves Orca's name in every hook you debug. Not part of the 2026-09-15 rename; they stay until decided.
- **DECIDED 2026-09-18 (user): install `girra` on SSH hosts, and rewrite the name at the CLI seam as well.** Kept below for the reasoning. The second half was added because the shim install is best-effort by design: `ssh-relay-session.ts:1065` warns rather than failing the connection, since it can fail on a `MaxSessions=1` remote, so a host with an old `orca`-only shim can keep it across a connect.
- ~~**The 39 runtime strings that name a command.**~~ The main process builds `nextSteps`, `recovery` and `recoveryCommand` strings saying `orca <verb>`, and they reach a caller that may be local, where the command is `girra`, or on an SSH host, where it is `orca`. Counted 2026-09-18 across `src/main`, excluding tests and comments: 15 in the Linear write and lookup commands, 11 in orchestration worker receipts and releases, 6 in the browser CDP paths, 2 in the emulator, and 5 elsewhere. Three options.
  1. **Rewrite at the CLI output seam.** The runtime writes `girra` canonically and `src/cli/cli-error.ts` substitutes `resolveOrchestrationCliExecutable(process.env)` on both the human and `--json` paths. Costs one helper and two call sites, plus care not to rewrite prose that legitimately says Girra. Buys one canonical name in the runtime and the existing precedent in `orchestration-mutation-recovery.ts`.
  2. **Install `girra` on SSH hosts too,** then sweep the strings plainly. `createRemoteCliInstallPlan` writes one shim; writing the same launcher again as `girra` and flipping the passthrough's `ORCA_CLI_COMMAND` makes one name correct everywhere. Costs a compatibility window for a host whose shim an older client installed, which the remote-wire rules cover, and it changes what lands on remote machines. Buys no per-message machinery at all.
  3. **Leave them as `orca`.** Costs telling the local majority a name the documentation no longer uses. Buys nothing.

  Answered: 2 plus 1. Raised and answered 2026-09-18.
- **DECIDED 2026-09-19 (user): delete the desktop take-back stack, keep the fit-override state.** Three tracing passes, each correcting the last, so the record is worth keeping:
  1. The first framing called the path inert because the host's `terminalFitOverrides` has no writer. True, but only half the system.
  2. The second framing called it a user-visible bug, because the renderer keeps its own override store that `applyLayout` feeds directly with `remote-desktop-fit` (`orca-runtime-apply-layout.ts:70`, `src/renderer/src/lib/pane-manager/fit-overrides.ts:54`). That store is live, but the conclusion was wrong.
  3. What settled it: **no `.tsx` file reads the fit overrides at all.** The take-back UI went with the mobile prune. `restorePaneTerminalFit`, `restoreAllTerminalFits` and `getHeldTerminalPtyIds` were returned from `use-terminal-pane-fit-actions.ts` and consumed by nothing, and the only other reference in the repo was their own test. Nobody could reach the path, so nobody saw it fail.

  **Taking back already works, by another route.** On host keystroke `claimViewportForUserActivity` (`pty-input-recovery.ts:189`), gated on `mode === 'remote-desktop-fit'`, sends `pty:claimViewport` to `claimRemoteDesktopHost`, and `RemoteDesktopTerminalFloor.claimHost` drops the viewer owner and lays the PTY out at the host size. `src/main/runtime/remote-desktop-host-take-back.test.ts` pins that, which nothing did before.

  **Kept deliberately:** `terminalFitOverrides` and the fit-override notifier, because `remote-desktop-fit` parks xterm at the remote's dimensions and a mismatched grid garbles the wrapped stream; and `terminal.restoreFit` as a `{ restored: false }` stub, because an older paired client still carries the preload bridge and `method_not_found` is a louder failure than the `false` every caller already got. Retire the stub with the orchestration normalisation.
- **DECIDED 2026-09-22: the e2e failures are attributed, and none is a fork regression.** The upstream A/B under "End-to-end Suite" settles all 23 unattributed failures and both nested-runtime ones. Run on the user's go-ahead once disk space allowed.
- **DECIDED 2026-09-18 (user): write girra's asset names now.** The install pages name what `config/electron-builder.config.cjs` builds and link `koinonau/girra/releases`, accepting that every link 404s until a release exists. `mac-build.yml` is dispatch only, Actions is disabled, and the repository holds no Apple signing secrets, so publishing one is still item 4 of "Start Here".

## Traps

| Date | Trap | Cost | Avoid it |
|---|---|---|---|
| 2026-09-12 | Named subagents are mailbox-only. Their final text is lost | One round of messages to recover six surveys; bit again 2026-09-15, caught by a hook | Tell each named agent to send its report to `main` with SendMessage; now in `prompt.md` |
| 2026-09-12 | The shell's `ls` alias prints nothing in tool output | Two empty directory listings | Use `/bin/ls` |
| 2026-09-13 | Transitive import closure reaches 11,213 of about 13,000 files | One analysis pass with 191 false dependencies | Measure direct imports only |
| 2026-09-13 | Directory-level paths in the inventory match unrelated features | A first duplicate pass whose labels were mostly wrong | Test path containment, and read both entries |
| 2026-09-13 | Docs-derived entries restated code entries | Feature count inflated from 535 to 575 | Treat marketing names as reference only |
| 2026-09-13 | A surveyor called Orca artifacts "Claude Artifacts" | One wrong premise in a recommendation | Confirm a subagent's claim in the code |
| 2026-09-13 | The delete guard rejects shell commands it cannot parse: loops, several heredocs, apostrophes inside a heredoc | Five failed commands | Put multi-step work in a script file, and commit messages in a file passed with `-F` |
| 2026-09-13 | About half the Orca mentions under `src/` sit in `.test.` files | Counts that never reach zero | Filter out `.test.` files |
| 2026-09-13 | Orca's `CLAUDE.md` imports `AGENTS.md`, so both load in every session here | None yet | Follow its code conventions; `prompt.md` governs girra's process |
| 2026-09-13 | Enabling Actions starts Orca's hourly macOS build on a private repository | Avoided by disabling Actions before the first push | Prune workflows before re-enabling |
| 2026-09-13 | A background `git push ... \| tail` prints nothing until it exits, so stopping it hid that the push had already landed | A force-push to replace full history with squashed | Check `git ls-remote origin` before assuming a stopped push did nothing |
| 2026-09-13 | `pgrep -f "git push"` matched another session's push to a different repository | None; it was not killed | Stop tasks by their task ID, never by process pattern |
| 2026-09-13 | GitHub reported the repository size as 0 KB straight after the force-push | None | Do not read `gh api repos/... --jq .size` as a measurement until GitHub recomputes it |
| 2026-09-13 | The commit guard checks the current branch before a command chain runs, so `git switch -c` and `git commit` in one command are refused on `main` | One refused commit | Switch branches in a separate command |
| 2026-09-14 | Homebrew's pnpm 10.33 cannot switch to the pinned 12.0.0, and the pre-commit hook calls bare `pnpm` | Would block every commit | Run pnpm and `git commit` through `mise exec --` |
| 2026-09-14 | `pnpm build` runs `install-dev-cli.mjs`, which tries to symlink `/usr/local/bin/orca-dev`; permission is denied and the build continues | None | Leave it denied. Never rerun it with `sudo` |
| 2026-09-14 | The full test suite loads the machine enough to fail `daemon-reattach-checkpoint-isolation` | One false failure in the baseline | Rerun a failing file alone before treating it as a regression |
| 2026-09-14 | The cross-version tests write 404 MB of Orca release checkouts into `tests/e2e/.cross-version-checkouts/`, which git ignores | Disk space only | Expect it after every full test run |
| 2026-09-14 | Orca's `.gitignore` ignores `docs/**` apart from an allow-list, so a new file under `docs/` is silently untracked. `docs/adr/` is now allow-listed | One `git add` that staged nothing | Add a new docs path to the allow-list in `.gitignore`; never `git add -f` |
| 2026-09-14 | Deleting a merged pull request's head branch closed the pull request stacked on it instead of retargeting it | Pushing the branch back, reopening, retargeting to `main`, then deleting it again | Retarget a stacked pull request to `main` before deleting its base branch |
| 2026-09-14 | `pnpm lint` checks that every test file a reliability gate lists exists, so each deletion must edit `config/reliability-gates.jsonc` in the same change, not in Phase 8 | Three gates edited for the harness | Grep the manifest for deleted paths; edit it with `jsonc-parser`'s `modify` so comments survive |
| 2026-09-14 | Some tests skip until `pnpm build` has written `out/`, so a baseline taken before building undercounts failures | One failure mistaken for new | Build before taking a baseline |
| 2026-09-14 | The survey labelled shared remote-runtime code as mobile-only, so the feature tree drops code that kept features import | A Phase 1 plan that would have broken the web UI and remote servers | Trace imports before deleting anything a feature entry names |
| 2026-09-14 | zsh's `noclobber` refuses `>` onto an existing file, so a redirected command does not run and the old log is read instead | One stale lint result | Redirect with `>|`, or give each run a new log name |
| 2026-09-14 | zsh does not word-split an unquoted `$VAR`, so a list of test paths reaches Vitest as one filter and it finds no tests | One empty test run | Put multi-file commands in a `sh` script |
| 2026-09-14 | The plan's inbound-reference counts miss preload bridges, persisted UI-state fields, telemetry schemas and locale keys: star-nag's "3" is about 20 files | A Phase 2 estimate that reads cheaper than it is | Grep the module's identifiers, not only its import path |
| 2026-09-14 | With `noImplicitAny` off, tsc resolved `useAppStore` to `any` once the updater slice left its import cycle, and reported 900 errors about `unknown` store fields | Most of an hour on a cascade with no root error | When errors say store fields are `unknown`, look for an inferred type in a cycle. `useAppStore` is now annotated |
| 2026-09-14 | The locale prune matched keys only when `translate(` and the key shared a line, so multi-line calls kept dead keys | About 21 dead keys left by the voice deletion | Match any quoted `auto.`, `menu.` or `tray.` key in removed code |
| 2026-09-14 | A deleted worker stays a build input in `electron.vite.config.ts` and the entry guard, and only `pnpm build` notices | One failed full-suite build | Grep the build config for a deleted module's path before the full run |
| 2026-09-14 | Feature-named files hold generic code: `updater-renderer-events.ts` held app restart events and `serve-update-supervisor.ts` held CLI signal forwarding | A restart and a serve regression, caught by typecheck | Read a file's exports before deleting it, and move what other features use |
| 2026-09-14 | A deletion leaves modules with no importers, and typecheck cannot see them | `windows-mobile-firewall.ts` and two files it alone used, found only by a scan | Extract HEAD's `src` with `git archive`, list files nothing imports in both trees, and delete what the new list adds |
| 2026-09-14 | Cutting a test file from a mid-file test to the end of the file deletes every later test too | One SSH passthrough test file restored from HEAD | Cut between two named markers, or check the file's test list after the edit |
| 2026-09-14 | Words in file names mislead: most files named `artifact` are build, terminal or test artifacts, not the published artifacts feature | None; a subagent traced imports first | Decide from imports, never from names |
| 2026-09-14 | Editors and shell prompts poll git, so a commit or `git rm` can hit `.git/index.lock` | Two failed commits | Retry once; the lock clears within a second |
| 2026-09-14 | A subagent reported `pnpm tc` clean while one test file still failed to compile | One typecheck error found at verification | Rerun `pnpm tc` yourself before committing a subagent's work |
| 2026-09-16 | After a restart, macOS required the Xcode licence again, so `/usr/bin/git` and `/usr/bin/python3` exit 69 and a scripted edit through them silently changes nothing | Two agents re-ran edits; one `git rm` did nothing until redone | Put `/opt/homebrew/bin` first on `PATH` and set `DEVELOPER_DIR=/Library/Developer/CommandLineTools` for native builds until the user runs `sudo xcodebuild -license accept` |
| 2026-09-16 | Running `pnpm exec` in a temporary worktree whose `node_modules` symlinks to the main repo runs postinstall, which wipes node-pty's native build in the shared `node_modules` | PTY tests failed spuriously until a rebuild | Never share `node_modules` into a temporary worktree; rebuild with `node config/scripts/ensure-native-runtime.mjs --runtime=node` |
| 2026-09-16 | A capital-only rename misses lowercased copies of the same prose used by `toLowerCase()` comparisons and `/i` regexes, and copies written after an escape such as `\nOrca:`, which no `\bOrca\b` matches | Would have killed remote-runtime auto-reconnect silently; caught by an agent's own sweep | After a prose rename, sweep `rg -i` and `rg '\\[nrt]Orca'` as well, and read the matches by neighbour character |
| 2026-09-18 | Homebrew's pnpm downloads a placeholder instead of the pnpm 12 binary, so the husky pre-commit hook, which calls bare `pnpm`, fails with `ENOEXEC` even under `mise exec --`. Clearing `~/Library/pnpm/.tools/pnpm/12.0.0` re-fetches the same placeholder | One docs-only commit made with `--no-verify` | For a commit that stages no file lint-staged matches (its globs cover TypeScript, JavaScript, JSON and CSS only), `--no-verify` is safe. For code, run `pnpm exec oxlint` and `oxfmt --check` on the staged files first |
| 2026-09-16 | A `package.json` `bin` change makes pnpm install before every `pnpm run`, and that postinstall rebuild needs `DEVELOPER_DIR` while the Xcode licence is unaccepted | Agents chased a broken node-pty build twice | Run vitest directly (`mise exec -- node node_modules/vitest/vitest.mjs run --config config/vitest.config.ts <files>`) or export `DEVELOPER_DIR=/Library/Developer/CommandLineTools` |
| 2026-09-18 | A code comment called the take-back path inert, and the handover repeated it. Correcting it once overshot: the renderer's override store is live, but no component reads it, so the path was unreachable rather than broken | Two decisions taken on wrong premises, both caught before any deletion | State and reachability are different questions. Ask who writes it, then ask who reads it, and treat a hook's return value as unused until a consumer is named |
| 2026-09-19 | A capital-only rename misses an all-caps wordmark. `ORCA` sat in the Landing page's `<h1>`, the largest brand string in the app, through every phase | Nobody saw it until the app was launched for the first time | After a brand rename, grep the all-caps form too, and launch the app and look at it |
| 2026-09-22 | A negative assertion on old text keeps passing after a rename, because the old text can never appear. `not.toContainText('Remote Orca runtime …')` guarded nothing once the app said Girra | Found only by grepping every "Orca" assertion, not by any failure | After a displayed-text rename, grep negative assertions too; a green `not.` check may have stopped checking |
| 2026-09-22 | One run is not enough to call a regression. `paired-remote-browser-link-open-routing` failed earlier on Girra than upstream once, and at the same point on the next run | A regression nearly reported that was flake | Rerun a suspected regression on both sides before reporting it |
| 2026-09-21 | A failing `docker build` in a spec was read as "Docker is not installed" without checking. Docker was running the whole time, and the build takes 31 s; it had only been starved during the load-53 window. That wrong verdict hid 26 Docker-gated specs, including the only end-to-end coverage of the SSH shim | Two days of SSH coverage not run | Check the tool before believing the error. `docker info` costs a second |
| 2026-09-20 | `pnpm build` writes a production bundle over the same `out/` the e2e suite uses, and the suite needs its own `--mode e2e` build that exposes `window.__store`. With `SKIP_BUILD=1` afterwards, specs run against the wrong bundle and fail far from the cause: every store helper, `waitForActiveWorktree` included, times out on a landing page with no workspace | Two confusing runs and a wrong conclusion about a diagnostic | Never pass `SKIP_BUILD=1` after a plain `pnpm build`. Let global setup rebuild, or rebuild with `npx electron-vite build --mode e2e` |
| 2026-09-19 | The e2e suite is not in `pnpm test`, so 349 spec files never ran and their assertions rotted quietly against the rename | 9 stale failures and 3 specs for features deleted a week earlier | Run `pnpm test:e2e` after any sweep that changes displayed strings or deletes a feature |
| 2026-09-19 | `terminal-pane-hook-order-parity.test.ts` pins the flattened render-hook count and a SHA over their order, so removing a `useCallback` fails it | One run; the file's comment block is a log of every prior move | Update the count, the SHA and add a line saying why. Read the new SHA from the assertion's Received value |
| 2026-09-18 | The six translated READMEs and the install page told the reader to `brew install --cask stablyai/orca/orca` or `yay -S stably-orca-bin`. Both install Orca, a different application with a different bundle id, under prose that says Girra | None; removed with the release-link rename | A download instruction is only correct if girra publishes the thing it names. Girra publishes to no package manager |
| 2026-09-18 | `generate-rpc-params-catalog.mjs` bundles every file under `src/shared/rpc-contract/` into CommonJS, so a `.test.ts` placed there fails `pnpm lint` with "Vitest cannot be imported in a CommonJS module" | One lint run and a file move | Test a contract schema from outside that directory |
| 2026-09-18 | `pairingCommand` and `960e901ae4` in the locale catalogues still read `orca serve --pairing-address <host>`, and nothing references either: the mobile pairing removal orphaned them. `verify-localization-extraction` reports 1,331 such entries | None; caught before editing them | Check a locale key has a caller before renaming its value. Dead keys belong to a prune, not a sweep |
| 2026-09-18 | Two tests pin the prose of the Linux guides verbatim: `config/scripts/headless-serve-shutdown-workflow.test.mjs` and `orcad-operations-restart-safety.test.mjs`. A doc edit fails them | Three assertions, found by running them | Run both after editing `docs/reference/headless-linux-server.md` or `orcad-operations.md`. `headlessLinuxProse` is whitespace-collapsed, `headlessLinuxGuide` is the raw file; assert wrapped prose against the former |
| 2026-09-16 | Tests in `config/scripts` assert the prose of files that agents own, so a rename splits across ownership areas and the area owner never runs them | Four skill-guidance test files failed in the full suite | Give the lead every test outside the areas, and run the full suite before calling a sweep done |
| 2026-09-16 | After a `package.json` or lockfile change, pnpm 12 installs before `pnpm run`, and the postinstall native rebuild fails without `DEVELOPER_DIR`, leaving node-pty unbuilt | One rebuild | Update the lockfile with `pnpm install --lockfile-only`, then run `DEVELOPER_DIR=/Library/Developer/CommandLineTools node config/scripts/rebuild-native-deps.mjs` before any other pnpm command |
| 2026-09-15 | The build plan omitted feature-tree drops that live outside its deletion table (feature wall, tours, onboarding) and misread `UsagePage.tsx` as a real dashboard | Caught only when Phase 6 was mapped | Diff the tree's unticked entries against the plan's phases before calling the plan complete |
| 2026-09-15 | A subagent ran `pnpm format` across the repository and reformatted files other agents and the lead were editing | Eight format-only files restored; mixed edits left to re-read | Tell subagents to format only the files they changed |
| 2026-09-14 | Feature share and line share differ: 103 of 535 features is 19%, but their code is 12% of source lines | "A fifth of the codebase" in the plan and an ADR draft | Measure lines before quoting a code proportion |
