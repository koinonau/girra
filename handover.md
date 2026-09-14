# Girra Handover

Facts, each dated when measured. Check a fact against its source before acting on it.

## Status

As of 2026-09-14: Phases 0 to 2, the ADRs and the cross-version harness deletion are merged. Phase 3 is split into pull requests; the first, Orca cloud, is in its pull request. Crash reporting and telemetry follow.

- Feature selection is final: 432 kept, 103 dropped. See [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md).
- The build is a fork of Orca with rejected features deleted. See [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) for phases, order and verification.
- `koinonau/girra` is private on GitHub, moved from `shanedolley/girra` on 2026-09-13; GitHub redirects the old URL. Its `main` holds Orca's code at the surveyed commit, with history older than 2026-08-29 squashed.
- Phase 0 merged in [#4](https://github.com/koinonau/girra/pull/4): `mise.toml`, the baseline, and `cloud/` added to the deletion table.
- ADRs [0001](docs/adr/0001-fork-orca-and-delete.md) and [0002](docs/adr/0002-keep-internal-orca-identifiers.md) merged in [#5](https://github.com/koinonau/girra/pull/5).
- The cross-version wire harness deletion merged in [#6](https://github.com/koinonau/girra/pull/6).
- Phase 1 merged in [#7](https://github.com/koinonau/girra/pull/7): 2,222 files deleted and 380,483 lines removed, measured with `git diff --shortstat` across its merge commit.
- Phase 2 merged in [#8](https://github.com/koinonau/girra/pull/8): star-nag, voice input and the updater. 245 files deleted, 45,450 lines removed.
- Phase 3a deletes everything that reached Orca cloud: artifacts, skill sharing, the cloud relay, push, mobile pairing, and Orca profiles and accounts. 486 files deleted, 77,388 lines removed and 516 added, measured with `git diff --shortstat origin/main`. Its pull request: `gh pr list --repo koinonau/girra`.

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
- **Reliability gates:** 118 after Phase 1, which removed three gates whose tests all lived in the deleted trees and trimmed four more (2026-09-14). Still 118 after Phase 2, which trimmed `runtime.headless-desktop-promotion-continuity` and moved an AppImage startup check from `updater-setup-done` to `first-window-startup-services-ready`. 115 after Phase 3a, which removed `desktop-relay.assignment-backpressure`, `mobile-relay.endpoint-recovery` and `mobile-push.headless-startup-and-policy`.
- **Orca profiles reach:** 141 files outside `src/main/orca-profiles` name them, 38 in `src/main/browser`, which imports only `getOrcaProfileBrowserSessionPartition` (`git grep -l`, 2026-09-14).
- **Inbound references from outside each module:** star-nag 3, speech 10, updater 13, orca-profiles 27, crash-reporting 39, telemetry 45, codex 125 (2026-09-13).
- **Orca in locale files:** 4,559 case-insensitive matches across six files in `src/renderer/src/i18n/locales/` (2026-09-13).
- **`onorca.dev` references:** 15 non-test files. Fourteen belong to dropped features; the sidebar help menu is the one kept (2026-09-13).

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
- 2026-09-14: keep the default profile storage layout while deleting profiles; see [ADR 0003](docs/adr/0003-keep-the-default-profile-storage-layout.md).
- 2026-09-14: delete remote skill install from share links and cloud package versions with skill sharing, since Orca cloud was its only package source. The host-side install RPC and SSH relay skill handler stay.
- 2026-09-14: delete the mobile companion pairing page, its settings pane, the Orca Mobile sidebar button and QR generation with the cloud relay. The feature tree drops them, and both options of the web renderer decision remove them.
- 2026-09-14: delete remote server updates and the macOS serve update handoff with the updater, since only the updater used them. The CLI keeps foreground signal forwarding. The app version moves to `window.api.app.getVersion`.
- 2026-09-14: delete the cross-version wire harness, its CI job, its change-scope category, and the gate evidence citing it. It compared girra against Orca releases girra does not ship.
- Keep Claude, OpenCode, Pi and MiniMax credentials. Drop Codex and 13 minor agent CLIs.
- Drop the mobile companion, Orca cloud profiles, telemetry, crash submission, the updater, voice input, marketing pages, product tours and onboarding.
- Drop artifacts and skill sharing, which publish to `share.onorca.dev`. Skill install stays.
- Keep the Android emulator, all remaining desktop features, and remote SSH.
- Change every string a person reads. Leave the 359 internal `orca*` identifiers.

## Open Decisions

- **Web renderer and pairing.** The feature tree keeps "Web UI served over the network", "Headless serve mode", "Cross-device session tab sync" and "Paired-runtime remote browser host", but drops "Web/mobile companion renderer" (`src/renderer/src/web`) and the mobile pairing items: end-to-end encryption, device tokens, QR pairing. The code does not split that way. Serve mode serves the web client built from `src/renderer/src/web`, and `src/main/runtime/runtime-rpc/` imports `device-registry.ts` and `e2ee-keypair.ts` for every remote client. Keep both, and drop only mobile-specific surfaces; or drop the web UI and remote serving with them. Phase 3a already removed the mobile pairing page, QR pairing, push and the cloud relay. Still in place: `orca serve --mobile-pairing`, the mobile session tab runtime, the mobile RPC allowlist and mobile-scope devices in the registry.
- **Remote skill install.** Since skill sharing left, nothing calls the host-side skill install RPC (`skills.install`, uploads) or the SSH relay skill handler. Delete them, or add a local package source that uses them.
- **Workflows.** Which of the 36 to keep before Actions is re-enabled. Until then, no change has CI.
- **Help menu.** Seventeen links point at Orca's docs. Remove the menu or repoint it.
- **`.orca/` and `ORCA_*`.** Renaming breaks existing worktrees and hook scripts. Keeping them leaves Orca's name in every hook you debug.
- **CLI binary.** Rename `orca` if both apps will run side by side.

## Traps

| Date | Trap | Cost | Avoid it |
|---|---|---|---|
| 2026-09-12 | Named subagents are mailbox-only. Their final text is lost | One round of messages to recover six surveys | Tell each agent to write its result to a file |
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
| 2026-09-14 | Feature share and line share differ: 103 of 535 features is 19%, but their code is 12% of source lines | "A fifth of the codebase" in the plan and an ADR draft | Measure lines before quoting a code proportion |
