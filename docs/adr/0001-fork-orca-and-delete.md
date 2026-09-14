# Fork Orca and delete, rather than rebuild

Girra keeps 432 of the 535 Orca features surveyed, so we forked Orca at `403b62a8d` and delete the 103 we rejected. A rebuild would re-implement the 265,344-line runtime behind the kept features, while the rejections are mostly whole directories: 226,348 lines, 165,819 of them in `mobile/` and `cloud/`, which nothing in `src/` imports.

## Considered Options

1. **Rebuild from scratch** - re-derives code already chosen to keep, plus Orca's test suite to match its confidence.
2. **Rebuild only the CLI over Orca's runtime** - the CLI is a thin RPC client, so this keeps the coupling it was meant to remove.

## Consequences

- Girra inherits Orca's code conventions from `AGENTS.md`, its CI gates, and 65 workflows. Deleting 12% of the source lines invalidates the max-lines, reliability-gate and ts-nocheck baselines, which Phase 8 regenerates.
- History before 2026-08-29 is squashed into one root commit, so `main` shares no ancestry with `stablyai/orca`. Upstream fixes arrive by cherry-pick; a merge fails.
