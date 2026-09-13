# Girra Handover

Facts, each dated when measured. Check a fact against its source before acting on it.

## Status

As of 2026-09-13: planning is complete and the repository exists. No Orca code has changed.

- Feature selection is final: 432 kept, 103 dropped. See [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md).
- The build is a fork of Orca with rejected features deleted. See [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) for phases, order and verification.
- `koinonau/girra` is private on GitHub, moved from `shanedolley/girra` on 2026-09-13; GitHub redirects the old URL. Its `main` holds Orca's code at the surveyed commit, with history older than 2026-08-29 squashed.
- The planning and handover files reached `main` through [#1](https://github.com/koinonau/girra/pull/1), merged 2026-09-13.
- Phase 0, the baseline, has not run.

## Files

At the repository root, beside Orca's code.

| File | Holds |
|---|---|
| [GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) | Phases 0-8, deletion table, identity strip, open decisions |
| [GIRRA-FEATURE-TREE.md](GIRRA-FEATURE-TREE.md) | The selection, nested by module. Authoritative |
| [ORCA-FEATURE-INVENTORY.md](ORCA-FEATURE-INVENTORY.md) | The flat survey the tree came from. Superseded; kept for history |
| `prompt.md` | How to work, and "Start here" |

## Board

No tracker. Linear holds no girra or orca project and no matching issue: `lincli project list --newer-than all_time --limit 100` returned 18 projects, none matching, and `lincli issue search girra` and `lincli issue search orca` found nothing (2026-09-13). Limits above 100 fail with "Query too complex".

Until a tracker exists, the phases in the build plan are the backlog.

## Repository

`~/Development/koinonau/girra`, pushed to `koinonau/girra` (private).

| Remote | Points to |
|---|---|
| `origin` | `koinonau/girra` |
| `upstream` | `stablyai/orca`. Push URL set to `DISABLED` |

- Show the head with `git log -1 --format='%h %ad %s' --date=short main`. On 2026-09-13 it matched Orca `403b62a8d`, upstream/main from 2026-09-12, v1.4.197, apart from the five planning files at the root (`git diff --stat orca-full-history main`).
- **History is squashed.** The first 1,308 commits of `main` are Orca's: one root commit holding Orca's tree at `51ed7d4f6` (2026-08-29) in place of 9,426 older commits, then the 1,307 later Orca commits with their original authors. Girra's own commits follow. Estimated at 89 MiB of objects, down from 219 MiB (2026-09-13).
- **`main` shares no ancestry with upstream** (`git merge-base main upstream/main` finds none). Take upstream fixes with `git cherry-pick` after `git fetch upstream`. `git merge upstream/main` fails as unrelated histories.
- **`orca-full-history`** is a local-only branch at Orca `403b62a8d` holding all 10,733 commits. It exists in this clone alone and is the only place `git blame` reaches past 2026-08-29. Measure upstream drift against it: `git fetch upstream && git rev-list --count orca-full-history..upstream/main` gave 137 (2026-09-13).
- No Git LFS; largest blob 8.2 MB (`docs/assets/readme-feature-showcase.gif`). Orca's release tags exist locally and point into the unsquashed history; none were pushed.
- **GitHub Actions is disabled** on the repository (`gh api repos/koinonau/girra/actions/permissions` returns `"enabled":false`, 2026-09-13). Orca ships 65 workflows, including an hourly macOS build.
- Branch protection and rulesets are unavailable: the rulesets API returns 403 and asks for a paid plan on this private repository (2026-09-13).
- Licence: MIT.
- The survey clone at `~/Development/github_clones/orca` still exists at the same commit. Its `origin` is `shanedolley/orca`, a month-stale standalone copy (`isFork: false`) holding 61 commits from earlier work. Girra no longer depends on either.

## Commands

Run in this repository. None has run yet: `node_modules` is absent (2026-09-13).

| Purpose | Command |
|---|---|
| Install | `pnpm install` |
| Typecheck | `pnpm tc`, an alias of `pnpm typecheck`. Narrower: `tc:node`, `tc:cli`, `tc:web` |
| Unit tests | `pnpm test`, or `pnpm test path/to/file.test.ts` (Vitest, `config/vitest.config.ts`) |
| Lint | `pnpm lint` for everything, slow. `pnpm run check:code-quality:changed` for changed files |
| Format | `pnpm format` |
| Build | `pnpm build` |
| Run the app | `pnpm dev` |

## Environment

Measured 2026-09-13 on this laptop.

| Tool | Required | Installed |
|---|---|---|
| Node | 24 (`package.json` engines) | v22.22.0 |
| pnpm | 12.0.0 (`packageManager`) | Missing: pnpm fails to switch to 12.0.0 |
| corepack | Any | 0.34.0 |

## Databases

No command reaches an external database.

- **Tests** use in-memory SQLite and a fresh temporary user-data directory per test file, `$TMPDIR/orca-vitest-userdata-*`, removed on teardown (`config/scripts/vitest-host-ports-setup.ts`). Parallel runs share no state.
- **The app** keeps its state in `orca-data.json`, with a sidecar `orca-github-cache.json`, inside Electron's user-data directory (`src/main/persistence/loading-store/user-data-path.ts`). Development and production resolve separate directories. Electron derives the directory from the app name, so the Phase 7 rename gives girra a fresh one.

## Measurements

Taken 2026-09-13 at Orca `403b62a8d`, by a Python walk over non-test `.ts` and `.tsx` files.

- **Deletion scope:** 197,983 lines across 27 directories. `mobile/` holds 137,454; the four `codex*` directories hold 35,233.
- **Inbound references from outside each module:** star-nag 3, speech 10, updater 13, orca-profiles 27, crash-reporting 39, telemetry 45, codex 125.
- **Orca in locale files:** 4,559 case-insensitive matches across six files in `src/renderer/src/i18n/locales/`.
- **`onorca.dev` references:** 15 non-test files. Fourteen belong to dropped features; the sidebar help menu is the one kept.

## Decisions Made

All 2026-09-13 unless dated otherwise.

- 2026-09-12: reset the survey clone to `upstream/main`, discarding a half-finished merge of 221 commits and 3,392 staged files.
- Fork and delete rather than rebuild.
- Fork from `403b62a8d`, the commit every measurement used. Pull newer upstream commits later as a sync.
- Move the repository to the `koinonau` organisation; it already sat at `~/Development/koinonau/girra` locally, beside the other Koinon repositories.
- This directory is the repository, and `upstream` stays fetchable so upstream patches remain pullable by cherry-pick.
- Squash history older than 14 days, keeping 1,307 commits, and replace the already-pushed full history with `git push --force-with-lease`.
- Disable GitHub Actions until the workflows are pruned.
- Keep Claude, OpenCode, Pi and MiniMax credentials. Drop Codex and 13 minor agent CLIs.
- Drop the mobile companion, Orca cloud profiles, telemetry, crash submission, the updater, voice input, marketing pages, product tours and onboarding.
- Drop artifacts and skill sharing, which publish to `share.onorca.dev`. Skill install stays.
- Keep the Android emulator, all remaining desktop features, and remote SSH.
- Change every string a person reads. Leave the 359 internal `orca*` identifiers.

## Open Decisions

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
| 2026-09-13 | The delete guard rejects shell loops it cannot parse, even with no delete in them | Two failed commands | Put multi-step measurement in a script file |
| 2026-09-13 | About half the Orca mentions under `src/` sit in `.test.` files | Counts that never reach zero | Filter out `.test.` files |
| 2026-09-13 | Orca's `CLAUDE.md` imports `AGENTS.md`, so both load in every session here | None yet | Follow its code conventions; `prompt.md` governs girra's process |
| 2026-09-13 | Enabling Actions starts Orca's hourly macOS build on a private repository | Avoided by disabling Actions before the first push | Prune workflows before re-enabling |
| 2026-09-13 | A background `git push ... \| tail` prints nothing until it exits, so stopping it hid that the push had already landed | A force-push to replace full history with squashed | Check `git ls-remote origin` before assuming a stopped push did nothing |
| 2026-09-13 | `pgrep -f "git push"` matched another session's push to a different repository | None; it was not killed | Stop tasks by their task ID, never by process pattern |
| 2026-09-13 | GitHub reported the repository size as 0 KB straight after the force-push | None | Do not read `gh api repos/... --jq .size` as a measurement until GitHub recomputes it |
