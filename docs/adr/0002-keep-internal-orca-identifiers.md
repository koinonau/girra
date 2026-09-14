# Keep internal orca identifiers

Girra removes every Orca string a person reads, but keeps the 359 distinct `orca*` identifiers in code and the module paths under `src/main`. Renaming them would touch most of the 6,282 files under `src/` that mention Orca, break every upstream fix girra cherry-picks, and change nothing a user sees.

## Considered Options

1. **Rename everything** - the churn above, for no visible gain.
2. **Rename only the product name, icon and bundle identifier** - leaves Orca in 4,559 locale strings and the CLI help text, which users read.

## Consequences

- Code says `orca` where the product says girra: `orca-data.json`, runtime types, test fixtures. That is deliberate; do not finish the rename.
- The `.orca/` directory and `ORCA_*` environment variables are visible to anyone writing agent hooks, so they sit outside this decision and remain open in `handover.md`.
