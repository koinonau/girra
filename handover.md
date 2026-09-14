# Girra Handover

Facts, each dated when measured. Check a fact against its source before acting on it.

## Status

As of 2026-09-14: Phase 0 is done and its baseline is recorded below. No Orca code has changed.

- Feature selection is final: 432 kept, 103 dropped. See [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md).
- The build is a fork of Orca with rejected features deleted. See [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) for phases, order and verification.
- `koinonau/girra` is private on GitHub, moved from `shanedolley/girra` on 2026-09-13; GitHub redirects the old URL. Its `main` holds Orca's code at the surveyed commit, with history older than 2026-08-29 squashed.
- Phase 0 travels in one pull request with `mise.toml`, this baseline, and `cloud/` added to the deletion table: `gh pr list --repo koinonau/girra`.

## Files

At the repository root, beside Orca's code.

| File | Holds |
|---|---|
| [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) | Phases 0-8, deletion table, identity strip, open decisions |
| [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md) | The selection, nested by module. Authoritative |
| [ORCA-FEATURE-INVENTORY.md](ORCA-FEATURE-INVENTORY.md) | The flat survey the tree came from. Superseded; kept for history |
| `mise.toml` | Pins Node 24 for this repository |
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
- **Release tags are incomplete.** The clone holds 860 of Orca's tags (`git tag | wc -l`), only those reachable when history was fetched. `v1.4.190`, which the cross-version tests need, is absent; the survey clone at `~/Development/github_clones/orca` has it (2026-09-14). None were pushed.
- No Git LFS; largest blob 8.2 MB (`docs/assets/readme-feature-showcase.gif`).
- **GitHub Actions is disabled** on the repository (`gh api repos/koinonau/girra/actions/permissions` returns `"enabled":false`, 2026-09-14). Orca ships 65 workflows, including an hourly macOS build.
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

Rerunning the nine failing files alone gave 10 failed, 31 passed, 13 skipped, 1 error. A phase matches the baseline when these, and only these, fail:

| Tests | Failing | Cause |
|---|---|---|
| `tests/e2e/cross-version-wire/release-checkout.unit.test.ts` | 6 | Tag `v1.4.190` is absent |
| `tests/e2e/cross-version-wire/cross-version-{browser-placement,terminal-wire}.unit.test.ts` | Files error, 13 tests skip | Same missing tag |
| `tests/e2e/relay-region-correction.unit.test.ts` | File errors | Imports `pg` through `cloud/apps/relay`, which is not installed |
| `config/scripts/skill-recipe-shell.test.mjs` | 1 | macOS `/bin/bash` is 3.2 and rejects an empty `"${array[@]}"` under `set -u` |
| `src/main/claude/claude-structured-real-cli.test.ts` | 1 | Runs the real `claude` binary; this machine's commands do not match the fixture |
| `src/main/claude/claude-tui-resume-real-binary.integration.test.ts` | 1 | Runs the real `claude` binary |
| `src/main/daemon/repro-13767-shell-ready-marker-lost-to-exec.test.ts` | 1, plus 1 unhandled error | Times out waiting for a real bash profile prompt |

`src/main/daemon/daemon-reattach-checkpoint-isolation.test.ts` failed under the full suite with `ENOTEMPTY` in teardown and passed alone. Treat it as load-flaky.

## Environment

Measured 2026-09-14 on this laptop.

| Tool | Required | Resolved in this repository |
|---|---|---|
| Node | 24 (`package.json` engines) | v24.16.0 from mise, pinned by `mise.toml`. Global default stays v22.22.0 |
| pnpm | 12.0.0 (`packageManager`) | 12.0.0 through corepack's shim in mise's Node 24. Elsewhere `/opt/homebrew/bin/pnpm` is 10.33.0 and fails to switch |
| bash | Any | `/bin/bash` 3.2.57 |

## Databases

No command reaches an external database.

- **Tests** use in-memory SQLite and a fresh temporary user-data directory per test file, `$TMPDIR/orca-vitest-userdata-*`, removed on teardown (`config/scripts/vitest-host-ports-setup.ts`). Parallel runs share no state. The one exception, `tests/e2e/relay-region-correction.unit.test.ts`, imports a Postgres client from `cloud/` and fails before connecting.
- **The app** keeps its state in `orca-data.json`, with a sidecar `orca-github-cache.json`, inside Electron's user-data directory (`src/main/persistence/loading-store/user-data-path.ts`). Development and production resolve separate directories. Electron derives the directory from the app name, so the Phase 7 rename gives girra a fresh one.

## Measurements

Taken at Orca `403b62a8d` by a Python walk over non-test `.ts` and `.tsx` files.

- **Deletion scope:** 197,983 lines across 27 directories (2026-09-13). `mobile/` holds 137,454; the four `codex*` directories hold 35,233.
- **`cloud/`:** 28,365 lines in 132 files, with no imports from `src/`. It holds Orca's server-side `push`, `relay`, `relay-fence-broker` and `relay-ops` apps, which serve features girra drops. Four test or source files outside it reference `cloud/apps` (2026-09-14). Added to the deletion table on 2026-09-14.
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
- Keep Claude, OpenCode, Pi and MiniMax credentials. Drop Codex and 13 minor agent CLIs.
- Drop the mobile companion, Orca cloud profiles, telemetry, crash submission, the updater, voice input, marketing pages, product tours and onboarding.
- Drop artifacts and skill sharing, which publish to `share.onorca.dev`. Skill install stays.
- Keep the Android emulator, all remaining desktop features, and remote SSH.
- Change every string a person reads. Leave the 359 internal `orca*` identifiers.

## Open Decisions

- **Cross-version wire tests.** 15 files in `tests/e2e/cross-version-wire/` compare wire compatibility against Orca releases. Fetch the release tags locally so they pass, or delete the harness, since girra will diverge from Orca's releases.
- **Workflows.** Which of the 65 to keep before Actions is re-enabled. Until then, no change has CI.
- **Help menu.** Seventeen links point at Orca's docs. Remove the menu or repoint it.
- **`.orca/` and `ORCA_*`.** Renaming breaks existing worktrees and hook scripts. Keeping them leaves Orca's name in every hook you debug.
- **CLI binary.** Rename `orca` if both apps will run side by side.
- **Telemetry call sites.** Replace the 45 with no-ops, or remove them.

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
