# Girra Handover

Facts, each dated when measured. Check a fact against its source before acting on it.

## Status

As of 2026-09-15: Phases 0 to 4, 5a, 6 and 7a, the ADRs and the cross-version harness deletion are merged. Phases 5b and 5c are merged, and Phase 5d (Codex and dropped agents out of structured sessions, native chat, AI Vault and resume, with `src/main/codex` deleted) is in its pull request.

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
- Phase 5d removes Codex and the dropped agents from structured sessions, main and renderer native chat, AI Vault scanning and search, and session resume, and deletes what remained of `src/main/codex`: 252 files deleted, 55,947 lines removed and 4,675 added, measured with `git diff --shortstat origin/main` (2026-09-16). Its pull request: `gh pr list --repo koinonau/girra`.
- Phase 7a merged in [#16](https://github.com/koinonau/girra/pull/16): the in-app feedback form and the plugin kill-list fetch, the last calls to Orca's servers apart from the Help menu links. 22 files deleted, 4,552 lines removed.

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
- **Reliability gates:** 118 after Phase 1, which removed three gates whose tests all lived in the deleted trees and trimmed four more (2026-09-14). Still 118 after Phase 2, which trimmed `runtime.headless-desktop-promotion-continuity` and moved an AppImage startup check from `updater-setup-done` to `first-window-startup-services-ready`. 115 after Phase 3a, which removed `desktop-relay.assignment-backpressure`, `mobile-relay.endpoint-recovery` and `mobile-push.headless-startup-and-policy`. 114 after Phase 3b, which removed `terminal-observability.lifecycle-breadcrumbs`. Still 114 after Phase 3c, which trimmed the telemetry tests from `git-worktree.refresh-event-semantics`, and after Phase 4a, which trimmed a deleted listener test from `agent-status.manual-compact-identity` (2026-09-15).
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
- 2026-09-16: Phase 5d keeps `AiVaultSession.codexHome: null` on the wire and the strict `ui.set` `codex` ids, but removes the Phase 5a Codex slots from `AccountsSnapshot` and `RateLimitState`, since girra does not pair with Orca. `aiVault.prepareSessionResume` and the Kimi and OMP resume capabilities are gone; creating or attaching a Codex structured session is rejected. The AI Vault search index and parse cache bump their schema versions and rebuild.
- 2026-09-16: known gaps after 5d. Copying an AI Vault resume command no longer refuses a session a structured chat owns (the terminal-send guards still block the paste). The deleted Codex rewind and integration tests covered concurrent rewind refusal, outcome-unknown rewind blocking sends, provider-exit reacquire and capability-less host refusal; no Claude test covers those yet.
- 2026-09-15: dropping OMP and title special cases changes hand-started CLIs: OMP started by hand in a Pi pane reports as Pi, and dropped CLIs started by hand get no title-based status. The renderer GPU gate now follows only the user setting, WebGL capability and context loss, since the Gemini fallback went.
- 2026-09-15 (user): keep remote serving, pairing and the web UI (option A); remove only the mobile leftovers (`--mobile-pairing`, mobile session tabs, the mobile RPC allowlist, mobile-scope devices).
- 2026-09-15 (user): workflows keep `pr.yml` and `unit-tests.yml` trimmed of Orca jobs and `e2e.yml` on demand, add one macOS build that signs and notarizes with the user's Apple developer account, and delete the rest; then re-enable Actions once the secrets exist (`MAC_CERTS`, `MAC_CERTS_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
- 2026-09-15 (user): delete remote skill install (the host-side `skills.install` API and the SSH relay skill handler). In its place, the Skills page gets an "Install kothar" action that opens a terminal on the chosen local or SSH host running the guided installer from gist `6d79d83dd27851d57fd1e346e04c7585` (`kothar-install-wizard.sh`, which installs the private `shanedolley/kothar` repository).
- 2026-09-15 (user): the launch roster keeps only Claude Code (with its Agent Teams launch mode), OpenCode and Pi. Codex and every other agent go, including OMP and Prime Agent, which share Pi's hooks.
- 2026-09-15 (user): keep MiniMax usage and credentials, although the tree unticks the usage fetch.
- 2026-09-15 (user): the app is named Girra, and the CLI binary is `girra`. `.orca/`, `ORCA_*` and the `orca://` scheme are not part of that decision and stay for now. The Help menu, Support section and share card are left as they are.
- Keep Claude, OpenCode, Pi and MiniMax credentials. Drop Codex and 13 minor agent CLIs.
- Drop the mobile companion, Orca cloud profiles, telemetry, crash submission, the updater, voice input, marketing pages, product tours and onboarding.
- Drop artifacts and skill sharing, which publish to `share.onorca.dev`. Skill install stays.
- Keep the Android emulator, all remaining desktop features, and remote SSH.
- Change every string a person reads. Leave the 359 internal `orca*` identifiers.

## Open Decisions

- **Help menu.** Its Docs and Changelog links point at `onorca.dev`, and its Discord and GitHub items at Orca's community. Remove the menu or repoint it. Left for now (user, 2026-09-15).
- **Star and support links.** The settings Support section stars and links `github.com/stablyai/orca`, and the usage share card says "Orca IDE" with that URL. Left for now (user, 2026-09-15).
- **`.orca/` and `ORCA_*`.** Renaming breaks existing worktrees and hook scripts. Keeping them leaves Orca's name in every hook you debug. Not part of the 2026-09-15 rename; they stay until decided.

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
| 2026-09-15 | The build plan omitted feature-tree drops that live outside its deletion table (feature wall, tours, onboarding) and misread `UsagePage.tsx` as a real dashboard | Caught only when Phase 6 was mapped | Diff the tree's unticked entries against the plan's phases before calling the plan complete |
| 2026-09-15 | A subagent ran `pnpm format` across the repository and reformatted files other agents and the lead were editing | Eight format-only files restored; mixed edits left to re-read | Tell subagents to format only the files they changed |
| 2026-09-14 | Feature share and line share differ: 103 of 535 features is 19%, but their code is 12% of source lines | "A fifth of the codebase" in the plan and an ADR draft | Measure lines before quoting a code proportion |
