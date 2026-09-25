import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('packaged Windows CLI launcher asset', () => {
  it('keeps the batch compatibility shim behind the newline-safe native launcher', () => {
    const launcherPath = join(process.cwd(), 'resources', 'win32', 'bin', 'girra.cmd')
    const launcher = readFileSync(launcherPath, 'utf8')

    expect(launcher).toContain('set "LAUNCHER=%SCRIPT_DIR%girra.exe"')
    expect(launcher).toContain('%~n0.cmd cannot safely forward orchestration message bodies')
    expect(launcher).not.toContain('"%ELECTRON%" "%CLI%" %*')
  })

  it('marks the packaged child and propagates its exact exit status', () => {
    const sourcePath = join(process.cwd(), 'native', 'windows-cli-launcher', 'OrcaCliLauncher.cs')
    const source = readFileSync(sourcePath, 'utf8')

    // Why: the marker and command name must ride the launcher's own environment, never
    // ProcessStartInfo's case-insensitive copy of a PATH/Path block (stablyai/orca#12046).
    expect(source).toContain(
      'Environment.SetEnvironmentVariable("GIRRA_WINDOWS_PACKAGED_CLI_LAUNCHER", "1");'
    )
    expect(source).toContain(
      'string requestedCliCommand = Environment.GetEnvironmentVariable("GIRRA_CLI_COMMAND");'
    )
    // Why `girra` is the fallback, not the match: nothing sets GIRRA_CLI_COMMAND on the normal
    // packaged path, so making the old name the default would hide the new one from every
    // invocation. Only an explicit alias passes through. Whitespace is normalized because the
    // C# expression wraps across lines.
    expect(source.replaceAll(/\s+/gu, ' ')).toContain(
      'requestedCliCommand == "orca-ide" || requestedCliCommand == "orca" ? requestedCliCommand : "girra"'
    )
    expect(source).toContain('child.WaitForExit();')
    expect(source).toContain('return child.ExitCode;')
  })
})
