---
name: orchestration
description: >-
  Coordinate supervised Girra workers: threaded messages, blocking ask/reply,
  task dispatch, worker_done/escalation waits, task DAGs, decision gates,
  coordinator loops, and decomposing work across agents. Use `orca-cli` for full
  ownership handoffs — "hand off", "handoff", "handover", "give this to another
  agent", "another worktree" — unless asked to supervise, monitor, or coordinate
  a DAG, and for terminal control, lightweight terminal prompts, shell commands,
  Girra worktree management, and reading or waiting on terminals. Use Computer
  Use for external browser windows, webviews, Girra app UI, or desktop UI outside
  Girra's embedded browser only when the task requires OS/window-level control
  such as focus, menus, dialogs, coordinates, or screenshots. Use `orca-cli` for
  Girra's embedded pages and a page-automation tool such as Playwright or CDP for
  external pages.
---

# Girra Orchestration

This file is a discovery stub, not the usage guide. The full, version-matched Girra
orchestration reference is served by the `girra` binary itself — kept out of this file on
purpose so it can never drift from the binary that will actually run your commands.

Engage Girra orchestration whenever you need structured multi-agent coordination: threaded
messages, blocking ask/reply flows, task dispatch, worker_done/escalation waits, task DAGs,
decision gates, coordinator loops, or decomposing work across agents. Use the orca-cli skill
instead for full ownership handoffs ("hand off", "handoff", "handover", "give this to
another agent", "another worktree") when the user did not ask to supervise, monitor, wait
for results, or coordinate a DAG — and for ordinary terminal control, shell commands,
worktree management, and the built-in browser. Coordination requires real Girra runtime
state; never substitute a non-Girra subagent tool.

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
ORCA skills get orchestration
```

That prints the compact, version-matched guide for the exact binary that will handle your
next commands. It covers the normal local coordinator loop. For a conditional action gate
such as remote placement, uncertain release recovery, or expanded DAG work, load only the
reference that gate names with
`ORCA skills get orchestration --reference references/<file>.md`
(`--references` lists the names). If that binary rejects `--reference`, run
`ORCA skills get orchestration --full` and read the named bundled reference before acting.

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Girra is not running, start it with `ORCA open --json`
and retry. If `skills get` is unknown, explain that updating Girra restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.
