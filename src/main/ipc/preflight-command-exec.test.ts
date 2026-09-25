import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPosixCommandPathLookupScript } from '../../shared/posix-command-path-lookup'

const { runPreflightCommandInWslMock } = vi.hoisted(() => ({
  runPreflightCommandInWslMock: vi.fn()
}))

vi.mock('./preflight-wsl-command', () => ({
  runPreflightCommandInWsl: runPreflightCommandInWslMock
}))

import { isCommandOnPath } from './preflight-command-exec'

describe('isCommandOnPath', () => {
  const sentinel = '__GIRRA_PREFLIGHT_COMMAND_PATH__'

  beforeEach(() => {
    runPreflightCommandInWslMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the shared literal lookup and accepts a sentinel-prefixed POSIX path', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    runPreflightCommandInWslMock.mockResolvedValue({
      stdout: `shell startup chatter\n${sentinel}/home/user/.local/bin/opencode\n`,
      stderr: ''
    })

    const found = await isCommandOnPath('opencode', { distro: 'Ubuntu' })

    expect(found).toBe(true)
    expect(runPreflightCommandInWslMock).toHaveBeenCalledOnce()
    const [, command] = runPreflightCommandInWslMock.mock.calls[0] as [{ distro: string }, string]
    expect(command).toContain(
      buildPosixCommandPathLookupScript(
        { kind: 'literal', value: 'opencode' },
        // The WSL branch skips Windows mounts, so detection and this check
        // cannot disagree about the same distro.
        { skipWindowsMountDirs: true }
      )
    )
    expect(command).toContain(
      ['if [ -n "$resolved" ]; then', `printf '${sentinel}%s\\n' "$resolved"`, 'fi'].join('\n')
    )
  })

  it.each([
    ['/absolute/startup/chatter', false],
    [`${sentinel}relative/path`, false],
    ['opencode', false],
    ["alias opencode='opencode --wrapped'", false]
  ])('parses WSL lookup output %s as available: %s', async (stdout, expected) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    runPreflightCommandInWslMock.mockResolvedValue({ stdout: `${stdout}\n`, stderr: '' })

    await expect(isCommandOnPath('opencode', { distro: 'Ubuntu' })).resolves.toBe(expected)
  })
})
