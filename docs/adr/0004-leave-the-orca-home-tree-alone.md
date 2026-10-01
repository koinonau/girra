# Leave the Orca home tree alone

Upstream Orca stays installed and running beside Girra on the same machine,
indefinitely. The desktop therefore resolves `~/.girra` unconditionally and
never moves, reads or writes `~/.orca`. `getGirraHomeDirWithLegacyFallback`
keeps the legacy reading, and only the two processes that never ran a migration
call it: the relay on an SSH host and a headless `orcad`.

Girra cannot tell a user who upgraded from Orca apart from a user running both,
so it stops trying. From inside the process the two look identical: one tree
named `~/.orca`, holding state that either app may own. Every discriminator we
weighed reads something Girra does not own, and guessing wrong either strands
the upgrader's state or takes Orca's away while Orca is running.

Girra also registers its Claude hook under its own script name,
`claude-girra-hook`, because `createManagedCommandMatcher` keys on the script
file name alone. Under the shared `claude-hook` name each app's install swept
the other's entries out of `~/.claude/settings.json`, so the last app to launch
owned the hooks and the other app's sidebar went dark.

## Considered Options

1. **Keep migrating `~/.orca` to `~/.girra`** - the incumbent. It took the tree
   away from a running Orca, which is the bug this record exists to fix. Worse,
   it is silent and one-way: the first launch of Girra moved the tree and
   rewrote Orca's hook paths before the user could decline.
2. **An opt-in or opt-out environment variable or setting** - the damage lands
   on first launch, before the user knows a switch exists, so a default still
   has to be chosen and the variable only renames the problem.
3. **A marker file inside `~/.orca`** - Orca writes no marker, and Girra writing
   one is a write into the tree this decision exists to leave untouched.
4. **Detect an installed Orca and migrate only in its absence** - probes a path
   Girra does not own, needs a different probe per platform, and reads an
   abandoned install as a live one. Behaviour then changes when a user drags an
   app to the trash.
5. **Share `~/.orca` read-only, without the move** - two apps would write one
   credential store, one keybindings file and one hook-install lock, and Girra's
   hook-script refresh would overwrite Orca's script with Girra's generation.
6. **Scope `createManagedCommandMatcher` to `.girra` paths instead of renaming
   the script** - stops Girra sweeping Orca's entries, but Orca's matcher is
   unscoped and we cannot change it, so Orca keeps sweeping Girra's.

## Consequences

- A user upgrading from Orca starts from an empty `~/.girra`. Jira, Linear,
  Bitbucket and MiniMax credentials, and `keybindings.json`, are re-entered by
  hand, or copied across deliberately. This matches the profile directory, which
  ADR-0003 and `docs/reference/girra-and-orca-names.md` already leave in place.
- Two trees means two hook-install locks, so Girra and Orca no longer serialize
  their merges into `~/.claude/settings.json`. Each merge is read-modify-write
  with an atomic rename and touches only its own entries, so a simultaneous
  launch can drop one app's entries and the next install restores them.
- `statusLine` is a single settings slot, so only one app can own it. Neither app
  claims the other's, because neither recognises the other's script name, so the
  first app to find the slot empty keeps it. When Orca holds it, Girra falls back
  to the OAuth usage poll.
- The statusline install marker is renamed with the script, so a user who had
  deleted Girra's managed statusline gets it installed once more before the
  opt-out holds again.
- Both apps' hooks now fire on every Claude event, and each script posts to the
  server named by its own pane's environment. A pane therefore reports twice to
  the app that launched it.
- `migrateLegacyGirraHomeDir` and `rewriteLegacyManagedHookPaths` are gone, not
  disabled. Reinstating either would have to merge two live trees, which the
  deleted code already refused to do.
