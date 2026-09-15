import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodePowerShellCommand } from './powershell-osc133-bootstrap'
import { resolveWindowsShellLaunchArgs } from './providers/windows-shell-args'

const WINDOWS_POWERSHELLS = ['powershell.exe', 'pwsh.exe'] as const
const PROFILE_CONFIG_DIR = 'C:\\Profile Custom\\opencode'
const MANAGED_CONFIG_DIR = 'C:\\Orca Managed\\opencode-config'

for (const shell of WINDOWS_POWERSHELLS) {
  describe.runIf(isAvailable(shell))(`${shell} managed home bootstrap`, () => {
    it.each(['FullLanguage', 'ConstrainedLanguage'] as const)(
      'restores OPENCODE_CONFIG_DIR and continues startup in %s mode',
      (languageMode) => {
        const cwd = mkdtempSync(join(tmpdir(), 'orca-powershell-clm-'))
        try {
          expect(runBootstrap(shell, languageMode, cwd)).toContain(
            `mode=${languageMode};configDir=${MANAGED_CONFIG_DIR};orcaConfigDir=${MANAGED_CONFIG_DIR};startupCount=2;cwd=${cwd}`
          )
        } finally {
          rmSync(cwd, { recursive: true, force: true })
        }
      }
    )
  })
}

function runBootstrap(
  shell: (typeof WINDOWS_POWERSHELLS)[number],
  languageMode: 'FullLanguage' | 'ConstrainedLanguage',
  cwd: string
): string {
  const launch = resolveWindowsShellLaunchArgs(
    shell,
    cwd,
    process.env.USERPROFILE ?? cwd,
    undefined,
    '$env:ORCA_TEST_STARTUP_COUNT = 1 + [int]$env:ORCA_TEST_STARTUP_COUNT'
  )
  expect(launch.startupCommandDeliveredInShellArgs).toBe(true)
  const encodedCommandIndex = launch.shellArgs.indexOf('-EncodedCommand')
  expect(encodedCommandIndex).toBeGreaterThanOrEqual(0)
  const encodedCommand = launch.shellArgs[encodedCommandIndex + 1]
  expect(encodedCommand).toBeTruthy()

  return execFileSync(
    shell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', harness],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENCODE_CONFIG_DIR: PROFILE_CONFIG_DIR,
        ORCA_OPENCODE_CONFIG_DIR: MANAGED_CONFIG_DIR,
        ORCA_TEST_BOOTSTRAP: encodedCommand,
        ORCA_TEST_LANGUAGE_MODE: languageMode
      },
      windowsHide: true
    }
  )
}

function isAvailable(shell: (typeof WINDOWS_POWERSHELLS)[number]): boolean {
  if (process.platform !== 'win32') {
    return false
  }
  try {
    execFileSync(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$null'], {
      stdio: 'ignore',
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}

const harness = encodePowerShellCommand(`
$initialState = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
$initialState.LanguageMode = $env:ORCA_TEST_LANGUAGE_MODE
$runspace = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace($initialState)
$runspace.Open()
$runner = [System.Management.Automation.PowerShell]::Create()
$runner.Runspace = $runspace
$bootstrap = [Text.Encoding]::Unicode.GetString(
  [Convert]::FromBase64String($env:ORCA_TEST_BOOTSTRAP)
)
$null = $runner.AddScript($bootstrap).Invoke()
$runner.Commands.Clear()
$null = $runner.AddScript($bootstrap).Invoke()
$runner.Commands.Clear()
$runner.AddScript(
  '"mode=$($ExecutionContext.SessionState.LanguageMode);configDir=$env:OPENCODE_CONFIG_DIR;orcaConfigDir=$env:ORCA_OPENCODE_CONFIG_DIR;startupCount=$env:ORCA_TEST_STARTUP_COUNT;cwd=$($PWD.Path)"'
).Invoke()
$runner.Dispose()
$runspace.Dispose()
`)
