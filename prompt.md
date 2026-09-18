# Girra Instructions

Girra is a personal fork of Orca with 103 features deleted and the Orca identity stripped. Read `handover.md` first; it holds every fact this file relies on.

## Start Here

Measured 2026-09-18. No tracker exists, so these come from the build plan's phases. Every phase through 7b is merged, with the workflow prune, the mobile client prune and the ADRs, and the three CLI-name stories are merged. **Nothing here is unblocked.** Each item names what unblocks it; read `handover.md`'s "Open Decisions" before starting one.

1. **The desktop take-back path is inert.** Parked on the decision of the same name, which measures deleting the path against rewiring it to `remoteDesktopFloor`, and recommends deleting. Needs the user.
2. **The 39 runtime strings that name a command.** Parked on the decision of the same name, which recommends installing `girra` on SSH hosts as well. Needs the user. Do not sweep them blind: `orca` is the correct name on an SSH host and `girra` is correct locally. See "CLI Names" in `handover.md`.
3. **Send `girra` on the orchestration wire.** The host enum already accepts it. Drop the normalisation in `resolveCompatibilityCliCommand` and `resolvePackagedWindowsCompatibilityCommand` (`src/cli/handlers/orchestration/runtime-compatibility.ts`) once no supported host predates that widening, which needs a release to have shipped first.
4. **Re-enable Actions.** Ask the user first, and only once `gh api repos/koinonau/girra/actions/secrets` lists `MAC_CERTS`, `MAC_CERTS_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. The kept set is `pr.yml`, `unit-tests.yml`, `e2e.yml` and `mac-build.yml`, the last two dispatch only.

Items 1 and 2 also each have a second story behind them: the dead locale keys `pairingCommand` and `960e901ae4`, which no code references, and the release links in `docs/site/content/docs/install.mdx`, which still point at Orca's assets. Both wait on the same answers.

## Backlog

[GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) is the backlog. Each phase is one story, taken in order. Phases 2 and 3 name their modules in ascending coupling; keep that order.

When a tracker exists, record its project, ready status, and transition IDs here.

## Loop

1. Read the phase in the build plan and every file it names.
2. Find every caller of anything you will delete: `grep -rl` over `src`, excluding `.test.` files.
3. Delete, then fix the callers. Then list files that nothing imports, in HEAD's tree and in yours, and delete what yours adds; see the trap in `handover.md`.
4. While fixing, run `pnpm tc`, `pnpm lint`, `pnpm build` when a deleted module was a build entry, and only the tests that touch what changed: the callers found in step 2, plus `config/scripts` when workflows or lint config change. The full suite takes 13 to 22 minutes, so run it once, when the phase is otherwise done. Run everything through `mise exec --`, with `ORCA_BACKGROUND_LAUNCH=1` for tests, as `handover.md` lists. Read the pass and fail counts from the output, not the exit code of a pipeline. Rerun any newly failing test file alone before calling it a regression.
5. Run the full `pnpm tc`, `pnpm test`, `pnpm lint` and `pnpm build`, and compare against the baseline in `handover.md`. A phase is done when typecheck, lint and build pass and only the baseline's known tests fail. Deleting a feature may remove known failures; record the new baseline when it does.
6. Update `handover.md` and this file's "Start Here" in the same commit.

When you split a phase across subagents, give each one disjoint file ownership, tell it to send its report to `main` with SendMessage, and tell it to format only the files it changed. Rerun `pnpm tc` yourself before committing its work.

Deleting a file that spawns processes trips the ratchets in `src/shared/child-process/`: remove it from both `__fixtures__` allowlists and lower `DIRECT_IMPORTER_PIN` or `UNHIDDEN_SPAWNER_PIN` to the count the test prints.

## Commits

One pull request per story. Cut the branch from `origin/main`, stage files by name, push, and open the pull request against `main` on `koinonau/girra`.

When a story must build on an unmerged one, stack it: branch from the earlier story's branch and target that branch. After the earlier pull request merges, retarget the stacked one to `main` with `gh pr edit --base main` before deleting the merged branch. Deleting it first closes the stacked pull request.

Actions is disabled, so no CI runs. The workflows are pruned and the signed macOS build is written, so the local checks in the loop stand in for CI only until the user adds the Apple secrets and turns Actions on.

Standing permission from the user, 2026-09-14: work through the phases without waiting for approval, and merge each pull request and clean up its branch once step 5 passes. Merge with a merge commit so `git branch -d` recognises the branch, then run the cleanup from the global instructions.

## Orca's Agent Instructions

`CLAUDE.md` imports `AGENTS.md`, the contributor guide inherited from Orca, and both load in every session here. Follow its code conventions: design system, style, max-lines, cross-platform, SSH and git compatibility. Where it and this file differ on process, this file wins. It still names the mobile companion in one place, which girra has deleted.

## Decisions

Raise a decision with the question, each option with its cost and what it buys, a recommendation with its reason, and what happens once answered. Measure before recommending wherever a number exists. The open decisions live in `handover.md`.

## Not Alone

Ask the user first:

- Re-enabling GitHub Actions on `koinonau/girra`.
- Pushing to `main` directly, or force-pushing any branch. Merging a pull request through GitHub is permitted; see "Commits".
- Pushing tags, or anything against `stablyai/orca`. Its push URL is `DISABLED`; keep it so. Orca's tags point into unsquashed history.
- Cherry-picking upstream commits into `main`. A merge from upstream fails; `main` shares no ancestry with it.
- Deleting the local `orca-full-history` branch. It is the only copy of Orca's full history in this clone.
- Choosing any open decision in `handover.md`.
- Ticking or unticking features in `GIRRA-FEATURE-TREE.md`.
- Installing a global Node version, or running any build step with `sudo`. `mise.toml` pins Node for this repository.

## Skills

- `writing-clearly-and-concisely` before writing any file, commit message or pull request.
- `verification-before-completion` before calling a phase done.
- `architecture-decisions` before carrying a hard-to-reverse, surprising trade-off into code. Records live in `docs/adr/`.
- `autonomous` for handover upkeep and commits.
