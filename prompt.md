# Girra Instructions

Girra is a personal fork of Orca with 103 features deleted and the Orca identity stripped. Read `handover.md` first; it holds every fact this file relies on.

## Start Here

Measured 2026-09-15. No tracker exists, so these come from the build plan's phases. Phases 0 to 4, 5a, 6, 7a and the ADRs are merged.

1. **Phase 5b onward, the rest of Codex and the launch roster.** Unblocked: the user dropped Codex and every agent except Claude Code, OpenCode and Pi (2026-09-15). Map both with read-only subagents, then split into pull requests.
2. **Phase 7b, Girra identity.** Unblocked once the roster removal lands: rename the app to Girra and the CLI binary to `girra`, then sweep displayed text. `.orca/`, `ORCA_*`, `orca://`, the Help menu, Support section and share card stay. The build plan's Phase 7 records the measured scope and the traps.
3. **Web renderer and pairing.** Resolve the feature-tree conflict recorded in `handover.md`. Needs the user.
4. **Workflows.** Choose which of the 36 remaining workflows survive before GitHub Actions is re-enabled. Needs the user.
5. **Remote skill install.** Delete the orphaned host-side install RPC, or keep it for a local package source. Needs the user.

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

Actions is disabled, so no CI runs. The local checks in the loop stand in for CI until workflows are pruned and Actions is re-enabled.

Standing permission from the user, 2026-09-14: work through the phases without waiting for approval, and merge each pull request and clean up its branch once step 5 passes. Merge with a merge commit so `git branch -d` recognises the branch, then run the cleanup from the global instructions.

## Orca's Agent Instructions

`CLAUDE.md` imports `AGENTS.md`, Orca's own contributor guide, and both load in every session here. Follow its code conventions: design system, style, max-lines, cross-platform, SSH and git compatibility. Where it and this file differ on process, this file wins. Its sections on the mobile companion and cloud features describe code girra is deleting.

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
