import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WslRunningPathFilterModule from '../wsl-running-path-filter'
import type * as WslTranscriptFsGateModule from './wsl-transcript-fs-gate'

const WSL_PROJECTS_DIR = '\\\\wsl.localhost\\Ubuntu\\home\\ada\\.claude\\projects'
const DEBIAN_PROJECTS_DIR = '\\\\wsl.localhost\\Debian\\home\\ada\\.claude\\projects'
const LOCAL_PROJECTS_DIR = 'C:\\Users\\ada\\.claude\\projects'

const mocks = vi.hoisted(() => ({
  filterPathsToRunningWslDistrosAsync: vi.fn(async (paths: readonly string[]) => [...paths]),
  gate: vi.fn(async (_options: { path: string }) => []),
  walk: vi.fn(
    async (
      dir: string,
      _agent: string,
      _issues: unknown[],
      options: { readDirectory?: (dirPath: string) => Promise<unknown[]> }
    ) => {
      await options.readDirectory?.(dir)
      return [] as string[]
    }
  )
}))

vi.mock('./wsl-transcript-fs-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof WslTranscriptFsGateModule>()),
  runWslTranscriptFsTask: mocks.gate
}))
vi.mock('../ai-vault/session-scanner-discovery', () => ({
  walkSessionFiles: mocks.walk
}))
vi.mock('../wsl', () => ({
  getWslHomeAsync: vi.fn(async () => '\\\\wsl.localhost\\Ubuntu\\home\\ada'),
  listRunningWslDistrosAsync: vi.fn(async () => ['Ubuntu']),
  listRunningWslHomeDirsAsync: vi.fn(async () => ['\\\\wsl.localhost\\Ubuntu\\home\\ada'])
}))
vi.mock('../wsl-running-path-filter', async (importOriginal) => ({
  ...(await importOriginal<typeof WslRunningPathFilterModule>()),
  filterPathsToRunningWslDistrosAsync: mocks.filterPathsToRunningWslDistrosAsync
}))

import { resolveSessionFilePath } from './session-file-resolver'
import { WslTranscriptFsError } from './wsl-transcript-fs-gate'

const realPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

beforeEach(() => {
  setPlatform('win32')
  mocks.filterPathsToRunningWslDistrosAsync.mockClear()
  mocks.gate.mockClear()
  mocks.walk.mockClear()
})

afterEach(() => setPlatform(realPlatform))

describe('WSL hook path gate', () => {
  it('does not scan by id after an authoritative WSL hook path is refused', async () => {
    const refusal = new WslTranscriptFsError('timeout', 'slow share')
    mocks.gate.mockImplementation(async (options: { operation?: string; path: string }) => {
      if (options.operation === 'access') {
        throw refusal
      }
      return []
    })

    await expect(
      resolveSessionFilePath('claude', 'session-id', {
        transcriptPath: `${WSL_PROJECTS_DIR}\\-home-ada-app\\session-id.jsonl`,
        claudeProjectsDir: DEBIAN_PROJECTS_DIR,
        wslDistro: 'Ubuntu'
      })
    ).rejects.toBe(refusal)
    expect(mocks.walk).not.toHaveBeenCalled()
  })

  it('surfaces the hook-path refusal when the id search also misses', async () => {
    const refusal = new WslTranscriptFsError('unavailable', 'stuck permits')
    mocks.gate.mockImplementation(async (options: { operation?: string; path: string }) => {
      if (options.operation === 'access') {
        throw refusal
      }
      return []
    })
    mocks.walk.mockImplementation(async (dir, _agent, _issues, options) => {
      await options.readDirectory?.(dir)
      return []
    })

    await expect(
      resolveSessionFilePath('claude', 'session-id', {
        transcriptPath: `${WSL_PROJECTS_DIR}\\-home-ada-app\\session-id.jsonl`,
        claudeProjectsDir: LOCAL_PROJECTS_DIR
      })
    ).rejects.toBe(refusal)
  })

  it('reports the abort, not a refusal, when the hook-path probe races a caller abort', async () => {
    const controller = new AbortController()
    const abortReason = new Error('caller went away')
    mocks.gate.mockImplementation(async (options: { operation?: string; path: string }) => {
      if (options.operation === 'access') {
        controller.abort(abortReason)
        throw new WslTranscriptFsError('timeout', 'slow share')
      }
      return []
    })

    await expect(
      resolveSessionFilePath(
        'claude',
        'session-id',
        {
          transcriptPath: `${WSL_PROJECTS_DIR}\\-home-ada-app\\session-id.jsonl`,
          claudeProjectsDir: LOCAL_PROJECTS_DIR
        },
        controller.signal
      )
    ).rejects.toBe(abortReason)
  })
})
