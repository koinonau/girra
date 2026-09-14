# Girra Instructions

Girra is a personal fork of Orca with 103 features deleted and the Orca identity stripped. Read `handover.md` first; it holds every fact this file relies on.

## Start Here

Measured 2026-09-14. No tracker exists, so these come from the build plan's phases. Phase 0 is done; its pull request must merge before the stories below branch from `origin/main`, because they need `mise.toml` and the baseline.

1. **ADRs.** Write two records to `docs/adr/` with the `architecture-decisions` skill before Phase 1: fork-and-delete over rebuild, and keeping internal `orca*` identifiers. Both are hard to reverse, surprising without context, and chosen over real alternatives. Unblocked once Phase 0 merges.
2. **Phase 1, mobile and cloud.** Relocate `Clipboard copy of terminal selection` out of `src/renderer/src/web/` first, then delete `mobile/` (137,454 lines) and `cloud/` (28,365 lines). Neither is imported from `src/`. Removing `cloud/` also removes `tests/e2e/relay-region-correction.unit.test.ts` from the baseline failures. Unblocked once Phase 0 merges.
3. **Cross-version wire tests.** Decide whether to fetch Orca's release tags locally or delete `tests/e2e/cross-version-wire/`. Needs the user.
4. **Workflows.** Choose which of Orca's 65 workflows survive before GitHub Actions is re-enabled. Needs the user.

## Backlog

[GIRRA-BUILD-PLAN.md](GIRRA-BUILD-PLAN.md) is the backlog. Each phase is one story, taken in order. Phases 2 and 3 name their modules in ascending coupling; keep that order.

When a tracker exists, record its project, ready status, and transition IDs here.

## Loop

1. Read the phase in the build plan and every file it names.
2. Find every caller of anything you will delete: `grep -rl` over `src`, excluding `.test.` files.
3. Delete, then fix the callers.
4. Run `pnpm tc`, `pnpm test`, `pnpm lint` and `pnpm build` through `mise exec --`, with `ORCA_BACKGROUND_LAUNCH=1` for tests, as `handover.md` lists them. Read the pass and fail counts from the output, not the exit code of a pipeline. Rerun any newly failing test file alone before calling it a regression.
5. Compare against the baseline in `handover.md`. A phase is done when typecheck, lint and build pass and only the baseline's known tests fail. Deleting a feature may remove known failures; record the new baseline when it does.
6. Update `handover.md` and this file's "Start Here" in the same commit.

## Commits

One pull request per story. Cut the branch from `origin/main`, stage files by name, push, and open the pull request against `main` on `koinonau/girra`.

Actions is disabled, so no CI runs. The local checks in the loop stand in for CI until workflows are pruned and Actions is re-enabled.

## Orca's Agent Instructions

`CLAUDE.md` imports `AGENTS.md`, Orca's own contributor guide, and both load in every session here. Follow its code conventions: design system, style, max-lines, cross-platform, SSH and git compatibility. Where it and this file differ on process, this file wins. Its sections on the mobile companion and cloud features describe code girra is deleting.

## Decisions

Raise a decision with the question, each option with its cost and what it buys, a recommendation with its reason, and what happens once answered. Measure before recommending wherever a number exists. The open decisions live in `handover.md`.

## Not Alone

Ask the user first:

- Re-enabling GitHub Actions on `koinonau/girra`.
- Merging a pull request, pushing to `main`, or force-pushing any branch.
- Pushing tags, or anything against `stablyai/orca`. Its push URL is `DISABLED`; keep it so. Orca's tags point into unsquashed history.
- Cherry-picking upstream commits into `main`. A merge from upstream fails; `main` shares no ancestry with it.
- Deleting the local `orca-full-history` branch. It is the only copy of Orca's full history in this clone.
- Choosing any open decision in `handover.md`.
- Ticking or unticking features in `GIRRA-FEATURE-TREE.md`.
- Installing a global Node version, or running any build step with `sudo`. `mise.toml` pins Node for this repository.

## Skills

- `writing-clearly-and-concisely` before writing any file, commit message or pull request.
- `verification-before-completion` before calling a phase done.
- `architecture-decisions` for the ADRs in "Start Here".
- `autonomous` for handover upkeep and commits.
