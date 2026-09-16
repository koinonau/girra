---
name: orca-emulator-android
description: >-
  Android device and emulator control from inside Girra over adb, with the live
  device view in Girra's emulator pane. Use when driving an adb-connected emulator
  or phone on Windows, Linux, or macOS: booting AVDs, taps, swipes, typing,
  hardware buttons, rotation, app install and launch, runtime permissions, the
  accessibility tree, and logcat. For an iOS simulator use the iOS emulator
  skill; build the APK with Gradle first.
license: Apache-2.0
---

# Girra Emulator (Android)

This discovery stub loads the version-matched guide from the Girra executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ORCA_CLI_COMMAND` environment variable is set, use its value. Girra exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `ORCA_DEV_REPO_ROOT`, use `orca-dev`.
- Otherwise, on Linux outside a Girra-managed terminal, use `orca-ide`. Never run bare
  `orca` there — outside Girra's terminals it normally resolves to the
  GNOME Orca screen reader (`/usr/bin/orca`) and starts speech on the user's machine.
- Otherwise, use `orca`.

Below, `ORCA` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `ORCA` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Girra build.

## Load the version-matched guide before running Girra commands

```text
ORCA skills get orca-emulator-android
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Girra is not running, start it with `ORCA open --json`
and retry. If `skills get` is unknown, explain that updating Girra restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.
