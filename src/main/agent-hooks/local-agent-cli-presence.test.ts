import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ManagedAgentHookTarget } from '../../shared/managed-agent-hook-targets'
import { detectLocalManagedAgentCliPresence } from './local-agent-cli-presence'

const claudeTarget: ManagedAgentHookTarget = {
  agent: 'claude',
  tuiAgent: 'claude',
  executableCandidates: ['claude']
}

describe('detectLocalManagedAgentCliPresence', () => {
  let tmpDir: string | null = null

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true })
      tmpDir = null
    }
  })

  it('scans a deduped PATH once for all agent candidates', async () => {
    const probe = vi.fn(async (filePath: string) => filePath.endsWith('/bin/claude-code'))
    const result = await detectLocalManagedAgentCliPresence(
      [{ ...claudeTarget, executableCandidates: ['claude', 'claude-code'] }],
      { agentCmdOverrides: {} },
      {
        pathEnv: ['/bin', '/bin', '/usr/bin'].join(':'),
        pathDelimiter: ':',
        fileProbe: { isExecutableFile: probe },
        platform: 'linux'
      }
    )

    expect(result.claude?.state).toBe('found')
    expect(probe.mock.calls.map(([filePath]) => filePath)).toEqual([
      '/bin/claude',
      '/usr/bin/claude',
      '/bin/claude-code'
    ])
  })

  it('uses executable override paths as positive evidence', async () => {
    const probe = vi.fn(async (filePath: string) => filePath === '/custom/bin/claude')
    const result = await detectLocalManagedAgentCliPresence(
      [claudeTarget],
      { agentCmdOverrides: { claude: '/custom/bin/claude --profile work' } },
      {
        pathEnv: '',
        pathDelimiter: ':',
        fileProbe: { isExecutableFile: probe },
        platform: 'linux'
      }
    )

    expect(result.claude?.state).toBe('found')
    expect(probe).toHaveBeenCalledWith('/custom/bin/claude')
  })

  it('preserves Windows override separators', async () => {
    const overridePath = 'C:\\My Tools\\claude.cmd'
    const probe = vi.fn(async (filePath: string) => filePath === overridePath)
    const result = await detectLocalManagedAgentCliPresence(
      [claudeTarget],
      { agentCmdOverrides: { claude: `"${overridePath}" --flag` } },
      {
        pathEnv: '',
        pathDelimiter: ';',
        fileProbe: { isExecutableFile: probe },
        platform: 'win32'
      }
    )

    expect(result.claude?.state).toBe('found')
    expect(probe).toHaveBeenCalledWith(overridePath)
  })

  it('expands Windows home-relative override paths with Windows separators', async () => {
    const overridePath = 'C:\\Users\\orca\\bin\\claude.cmd'
    const probe = vi.fn(async (filePath: string) => filePath === overridePath)
    const result = await detectLocalManagedAgentCliPresence(
      [claudeTarget],
      { agentCmdOverrides: { claude: '~\\bin\\claude.cmd --flag' } },
      {
        pathEnv: '',
        fileProbe: { isExecutableFile: probe },
        platform: 'win32',
        homeDir: 'C:\\Users\\orca'
      }
    )

    expect(result.claude?.state).toBe('found')
    expect(probe).toHaveBeenCalledWith(overridePath)
  })

  it('expands home-relative override paths', async () => {
    const probe = vi.fn(async (filePath: string) => filePath === '/home/orca/bin/claude')
    const result = await detectLocalManagedAgentCliPresence(
      [claudeTarget],
      { agentCmdOverrides: { claude: '~/bin/claude --profile work' } },
      {
        pathEnv: '',
        pathDelimiter: ':',
        fileProbe: { isExecutableFile: probe },
        platform: 'linux',
        homeDir: '/home/orca'
      }
    )

    expect(result.claude?.state).toBe('found')
    expect(probe).toHaveBeenCalledWith('/home/orca/bin/claude')
  })

  it('reports relative override paths as unknown', async () => {
    const probe = vi.fn(async () => true)
    const result = await detectLocalManagedAgentCliPresence(
      [claudeTarget],
      { agentCmdOverrides: { claude: 'bin/claude --profile work' } },
      {
        pathEnv: '',
        pathDelimiter: ':',
        fileProbe: { isExecutableFile: probe },
        platform: 'linux'
      }
    )

    expect(result.claude).toEqual({ state: 'unknown' })
    expect(probe).not.toHaveBeenCalled()
  })

  it('honors PATHEXT for Windows PATH candidates', async () => {
    const probe = vi.fn(async (filePath: string) => filePath === 'C:\\Tools\\claude.CMD')
    const result = await detectLocalManagedAgentCliPresence(
      [claudeTarget],
      { agentCmdOverrides: {} },
      {
        pathEnv: 'C:\\Other;C:\\Tools',
        pathExt: '.EXE;.CMD',
        fileProbe: { isExecutableFile: probe },
        platform: 'win32'
      }
    )

    expect(result.claude?.state).toBe('found')
    expect(probe.mock.calls.map(([filePath]) => filePath)).toEqual([
      'C:\\Other\\claude.EXE',
      'C:\\Other\\claude.CMD',
      'C:\\Tools\\claude.EXE',
      'C:\\Tools\\claude.CMD'
    ])
  })

  it('warns and uses the inherited PATH when shell hydration throws', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await detectLocalManagedAgentCliPresence(
        [claudeTarget],
        { agentCmdOverrides: {} },
        {
          pathEnv: '',
          pathDelimiter: ':',
          fileProbe: { isExecutableFile: vi.fn(async () => false) },
          platform: 'linux',
          shouldHydrateShellPath: true,
          hydratePath: vi.fn(async () => {
            throw new Error('shell unavailable')
          })
        }
      )

      expect(result.claude?.state).toBe('missing')
      expect(warning).toHaveBeenCalledWith(
        '[agent-hooks] Shell PATH hydration failed; using inherited PATH:',
        expect.objectContaining({ message: 'shell unavailable' })
      )
    } finally {
      warning.mockRestore()
    }
  })

  it.runIf(process.platform !== 'win32')(
    'accepts executable symlinks and rejects broken symlinks',
    async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'orca-cli-presence-'))
      const binDir = join(tmpDir, 'bin')
      mkdirSync(binDir)
      const targetPath = join(tmpDir, 'claude-real')
      writeFileSync(targetPath, '#!/bin/sh\n')
      chmodSync(targetPath, 0o755)
      symlinkSync(targetPath, join(binDir, 'claude'))
      symlinkSync(join(tmpDir, 'missing'), join(binDir, 'claude-broken'))
      const detect = (executableCandidates: string[]) =>
        detectLocalManagedAgentCliPresence(
          [{ ...claudeTarget, executableCandidates }],
          { agentCmdOverrides: {} },
          { pathEnv: binDir, pathDelimiter: ':', platform: process.platform }
        )

      expect((await detect(['claude'])).claude?.state).toBe('found')
      expect((await detect(['claude-broken'])).claude?.state).toBe('missing')
    }
  )
})
