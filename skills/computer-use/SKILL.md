---
name: computer-use
description: >-
  OS/window-level inspection and input in visible local app windows through `girra computer`:
  native apps, external browser windows (Chrome, Edge, Safari), and app webviews. Not for
  Girra's embedded browser (use `orca-cli`) or page-only automation (use Playwright or CDP).
---

# Computer Use

This discovery stub loads the version-matched guide from the Girra executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ORCA_CLI_COMMAND` environment variable is set, use its value. Girra exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `ORCA_DEV_REPO_ROOT`, use `girra-dev`.
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
ORCA skills get computer-use
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Girra is not running, start it with `ORCA open --json`
and retry. If `skills get` is unknown, explain that updating Girra restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.
