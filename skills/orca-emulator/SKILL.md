---
name: orca-emulator
description: >-
  iOS Simulator control from inside Girra, with the live device view in Girra's
  emulator pane. Use when driving a booted Apple Simulator on macOS: taps,
  gestures, typing, hardware buttons, rotation, and the accessibility tree, or
  when an iOS change needs simulator evidence. For an Android device or emulator
  use the Android emulator skill; build and install the app with xcodebuild or
  simctl first.
license: Apache-2.0
---

# Girra Emulator

This discovery stub loads the version-matched guide from the Girra executable used for this session.

Prefer Girra over raw `serve-sim` or direct `simctl` for simulator control inside Girra; it
handles device scoping, helper lifecycle, and worktree context.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `GIRRA_CLI_COMMAND` environment variable is set, use its value, and if only the
  older `ORCA_CLI_COMMAND` is set, use that. Girra exports these for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `GIRRA_DEV_REPO_ROOT` or the older
  `ORCA_DEV_REPO_ROOT`, use `girra-dev`.
- Otherwise, use `girra`.

If `girra` is not found, the host predates the rename: fall back to `orca-dev` in a dev
checkout, to `orca-ide` on Linux, and to `orca` elsewhere. Never run bare `orca` on Linux
outside a Girra-managed terminal — there it normally resolves to the
GNOME Orca screen reader (`/usr/bin/orca`) and starts speech on the user's machine.

Below, `ORCA` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `ORCA` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Girra build.

## Load the version-matched guide before running Girra commands

```text
ORCA skills get orca-emulator
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Girra is not running, start it with `ORCA open --json`
and retry. If `skills get` is unknown, explain that updating Girra restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.
