import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import * as localPtyUtils from '../providers/local-pty-utils'
import {
  createMockSubprocess,
  startDaemonAdapterHarness,
  waitFor,
  type DaemonAdapterHarness,
  type SpawnSubprocess
} from './daemon-pty-adapter-test-harness'

const itOnPosix = process.platform === 'win32' ? it.skip : it

describe('DaemonPtyAdapter startup delivery', () => {
  let harness: DaemonAdapterHarness
  let adapter: DaemonAdapterHarness['adapter']
  let dir: string
  let lastSubprocess: ReturnType<typeof createMockSubprocess>
  let lastSpawnOpts: Parameters<SpawnSubprocess>[0] | null

  beforeEach(async () => {
    lastSpawnOpts = null
    harness = await startDaemonAdapterHarness((opts) => {
      lastSpawnOpts = opts
      lastSubprocess = createMockSubprocess()
      return lastSubprocess
    })
    adapter = harness.adapter
    dir = harness.dir
  })

  afterEach(async () => {
    adapter.dispose()
    await harness.server.shutdown()
    rmSync(dir, { recursive: true, force: true })
  })

  itOnPosix.for(['environment', 'override'] as const)(
    'waits for the fallback shell when the %s shell is missing',
    async (source, context) => {
      const missingShell = join(dir, 'missing-fish')
      const fallbackName = basename(localPtyUtils.resolveUnixShellPath(missingShell))
      context.skip(!['bash', 'zsh'].includes(fallbackName), 'Requires a Bash/zsh fallback')
      await adapter.spawn({
        cols: 80,
        rows: 24,
        command: 'claude',
        env: { SHELL: source === 'environment' ? missingShell : '/bin/sh' },
        ...(source === 'override' ? { shellOverride: missingShell } : {})
      })
      await new Promise((resolve) => setTimeout(resolve, 350))
      expect(lastSubprocess.write).not.toHaveBeenCalled()
      expect(lastSpawnOpts).toEqual(
        expect.objectContaining({ startupCommandDelivery: 'shell-ready' })
      )
      lastSubprocess._simulateData('\x1b]777;orca-shell-ready\x07\r\nuser@host $ ')
      await waitFor(() => vi.mocked(lastSubprocess.write).mock.calls.length > 0)
      expect(lastSubprocess.write).toHaveBeenCalledExactlyOnceWith('claude\n')
    }
  )

  itOnPosix.each([
    { command: 'claude' },
    { command: 'claude', startupCommandDelivery: 'fast' as const },
    { command: "claude 'linked issue context'", startupCommandDelivery: 'shell-ready' as const }
  ])('waits and submits once after readiness: %j', async (startup) => {
    await adapter.spawn({ cols: 80, rows: 24, ...startup, env: { SHELL: '/bin/zsh' } })

    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(lastSubprocess.write).not.toHaveBeenCalled()
    expect(lastSpawnOpts).toEqual(
      expect.objectContaining({ startupCommandDelivery: 'shell-ready' })
    )
    lastSubprocess._simulateData('\x1b]777;orca-shell-ready\x07')
    lastSubprocess._simulateData('\r\nuser@host $ ')

    await waitFor(() => vi.mocked(lastSubprocess.write).mock.calls.length > 0)
    expect(lastSubprocess.write).toHaveBeenCalledExactlyOnceWith(`${startup.command}\n`)
  })
})
