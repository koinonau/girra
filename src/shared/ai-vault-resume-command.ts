// Resume-command construction for Agent Session History rows: turns a scanned
// session into the shell line that re-enters it, quoted for the target platform
// and (when known) the live tab's shell.
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import {
  commandSeparator,
  isPosixStartupShell,
  quoteStartupArg,
  type AgentStartupShell
} from './tui-agent-startup-shell'
import type { AiVaultAgent } from './ai-vault-types'

export function buildAiVaultResumeCommand(args: {
  agent: AiVaultAgent
  sessionId: string
  cwd: string | null
  platform: NodeJS.Platform
  commandOverride?: string | null
  shell?: AgentStartupShell
}): string {
  const { agent, sessionId, cwd, platform, commandOverride, shell } = args
  const baseCommand = commandOverride?.trim() || TUI_AGENT_CONFIG[agent].detectCmd
  const sessionArg =
    shell === 'cmd'
      ? quoteWindowsCmdArg(sessionId)
      : shell
        ? quoteStartupArg(sessionId, shell)
        : quoteShellArg(sessionId, platform)
  const resumeFlag = agent === 'claude' ? '--resume' : '--session'
  const resumeCommand = `${baseCommand} ${resumeFlag} ${sessionArg}`

  return buildAiVaultResumeShellCommand({
    resumeCommand,
    cwd,
    platform,
    shell
  })
}

export function buildAiVaultResumeShellCommand(args: {
  resumeCommand: string
  cwd: string | null
  platform: NodeJS.Platform
  // Why: the QUEUED resume command is typed into the live tab shell, so its
  // cd prefix must match that shell. Shell-less persisted commands keep the
  // legacy self-contained `cmd /d /s /c` wrapper.
  shell?: AgentStartupShell
}): string {
  const { cwd, platform, shell, resumeCommand } = args

  // Why: shell-aware commands are parsed by a known running shell, while
  // shell-less persisted commands keep the legacy self-contained cmd wrapper.
  // PowerShell routes here whatever the platform: it is the shell, not the
  // host, that decides which grammar the line has to be written in.
  if (shell === 'powershell' || (platform === 'win32' && shell && shell !== 'cmd')) {
    return buildResumeShellCommandForShell({ resumeCommand, cwd, shell })
  }

  if (platform === 'win32' && shell === 'cmd') {
    // Why: an interactive cmd splits the doubled quotes required by a nested
    // `cmd /s /c` wrapper, so queued commands must use direct cmd syntax.
    return cwd ? `cd /d ${quoteWindowsCmdArg(cwd)} && ${resumeCommand}` : resumeCommand
  }
  if (!cwd) {
    return resumeCommand
  }

  if (platform === 'win32') {
    const inner = `cd /d ${quoteWindowsCmdArg(cwd)} && ${resumeCommand}`
    return `cmd /d /s /c ${quoteWindowsCmdArg(inner)}`
  }

  return `cd ${quoteResumeArg(cwd, platform, shell)} && ${resumeCommand}`
}

function buildResumeShellCommandForShell(args: {
  resumeCommand: string
  cwd: string | null
  shell: Exclude<AgentStartupShell, 'cmd'>
}): string {
  const { cwd, shell, resumeCommand } = args
  if (isPosixStartupShell(shell)) {
    // Why: git-bash on a Windows host runs a POSIX shell, so reuse the same
    // `cd '<cwd>'` prefix as the non-Windows path.
    return cwd ? `cd ${quoteStartupArg(cwd, shell)} && ${resumeCommand}` : resumeCommand
  }
  return cwd
    ? `Set-Location -LiteralPath ${quoteStartupArg(cwd, shell)}${commandSeparator(shell)}${resumeCommand}`
    : resumeCommand
}

/** Quotes for the live shell when one is known, else for the platform's default. */
function quoteResumeArg(
  value: string,
  platform: NodeJS.Platform,
  shell?: AgentStartupShell
): string {
  return shell ? quoteStartupArg(value, shell) : quoteShellArg(value, platform)
}

/** Why not the sh `'\''` idiom here: this is the same resume command the shell
 *  branch above builds, and fish reads that idiom differently — it would halve
 *  backslashes in a path and reject a trailing one. Deferring to
 *  `quoteStartupArg` keeps one spelling regardless of whether a caller happened
 *  to pass a shell. */
function quoteShellArg(value: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? quoteWindowsCmdArg(value) : quoteStartupArg(value, 'posix')
}

function quoteWindowsCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}
