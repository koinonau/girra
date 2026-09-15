import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NodeFsPromisesModule from 'node:fs/promises'

const UBUNTU_HOME = '\\\\wsl.localhost\\Ubuntu\\home\\ada'
const TRANSCRIPT_LINUX = '/home/ada/.claude/projects/-home-ada-app/wsl-sess.jsonl'
const TRANSCRIPT_UNC =
  '\\\\wsl.localhost\\Ubuntu\\home\\ada\\.claude\\projects\\-home-ada-app\\wsl-sess.jsonl'
const DEBIAN_TRANSCRIPT_UNC = TRANSCRIPT_UNC.replace('Ubuntu', 'Debian')

vi.mock('../wsl', () => ({
  listWslDistrosAsync: vi.fn(async () => ['Ubuntu', 'Debian']),
  listRunningWslDistrosAsync: vi.fn(async () => ['Ubuntu', 'Debian']),
  listRunningWslHomeDirsAsync: vi.fn(async () => [
    UBUNTU_HOME,
    UBUNTU_HOME.replace('Ubuntu', 'Debian')
  ]),
  getWslHomeAsync: vi.fn(async (distro: string) => UBUNTU_HOME.replace('Ubuntu', distro))
}))

// Only these UNC fixtures are readable. Every other `\\wsl.localhost\` path —
// wrong distro, missing file — must reject, or the mock would mask a misresolve.
// Non-WSL paths hit the real fs, so the guest Linux path stays unreadable as on a
// real Windows host, where it would misresolve against the current drive.
const READABLE_WSL_UNC_PATHS = new Set([TRANSCRIPT_UNC])

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFsPromisesModule>()
  return {
    ...actual,
    access: async (path: string) => {
      if (!path.startsWith('\\\\wsl.localhost\\')) {
        await actual.access(path)
        return
      }
      if (!READABLE_WSL_UNC_PATHS.has(path)) {
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
      }
    }
  }
})

const scanned = vi.hoisted(() => ({ dirs: [] as string[], hostRootHasTranscript: false }))
vi.mock('../ai-vault/session-scanner-discovery', () => ({
  walkSessionFiles: async (dir: string) => {
    scanned.dirs.push(dir)
    const isWslRoot = dir.startsWith('\\\\wsl.localhost\\')
    return scanned.hostRootHasTranscript && !isWslRoot
      ? ['C:\\host\\projects\\-app\\wsl-sess.jsonl']
      : []
  }
}))

import { resetHostReadableTranscriptPathCacheForTests } from './host-readable-transcript-path'
import { resolveSessionFilePath } from './session-file-resolver'
import { getWslHomeAsync, listWslDistrosAsync } from '../wsl'

const realPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

beforeEach(() => {
  resetHostReadableTranscriptPathCacheForTests()
  vi.mocked(getWslHomeAsync).mockClear()
  vi.mocked(listWslDistrosAsync).mockClear()
  scanned.dirs = []
  scanned.hostRootHasTranscript = false
  READABLE_WSL_UNC_PATHS.clear()
  READABLE_WSL_UNC_PATHS.add(TRANSCRIPT_UNC)
  setPlatform('win32')
})

afterEach(() => {
  setPlatform(realPlatform)
})

describe('resolveSessionFilePath on a Windows host with WSL', () => {
  it('translates a WSL hook transcript path to its host-readable UNC twin (#10326)', async () => {
    const resolved = await resolveSessionFilePath('claude', 'wsl-sess', {
      transcriptPath: TRANSCRIPT_LINUX
    })
    expect(resolved).toBe(TRANSCRIPT_UNC)
  })

  it('keeps an attested distro when another guest has the same transcript path', async () => {
    READABLE_WSL_UNC_PATHS.add(DEBIAN_TRANSCRIPT_UNC)

    const resolved = await resolveSessionFilePath('claude', 'wsl-sess', {
      transcriptPath: TRANSCRIPT_LINUX,
      wslDistro: 'Ubuntu'
    })

    expect(resolved).toBe(TRANSCRIPT_UNC)
    expect(vi.mocked(listWslDistrosAsync)).not.toHaveBeenCalled()
    expect(vi.mocked(getWslHomeAsync)).not.toHaveBeenCalled()
  })

  it('does not fall through to another guest when the attested path is missing', async () => {
    READABLE_WSL_UNC_PATHS.delete(TRANSCRIPT_UNC)
    READABLE_WSL_UNC_PATHS.add(DEBIAN_TRANSCRIPT_UNC)

    await expect(
      resolveSessionFilePath('claude', 'wsl-sess', {
        transcriptPath: TRANSCRIPT_LINUX,
        wslDistro: 'Ubuntu'
      })
    ).resolves.toBeNull()
  })

  it('does not return a UNC twin that no distro actually has', async () => {
    const resolved = await resolveSessionFilePath('claude', 'wsl-sess', {
      transcriptPath: '/home/ada/.claude/projects/-home-ada-app/gone.jsonl'
    })
    expect(resolved).toBeNull()
  })

  it('does not fall back by id from an unattested guest hook path', async () => {
    READABLE_WSL_UNC_PATHS.delete(TRANSCRIPT_UNC)
    scanned.hostRootHasTranscript = true

    await expect(
      resolveSessionFilePath('claude', 'wsl-sess', {
        transcriptPath: TRANSCRIPT_LINUX,
        claudeProjectsDir: 'C:\\host\\projects'
      })
    ).resolves.toBeNull()
    expect(scanned.dirs).toEqual([])
  })

  it('does not fall back to a host id match for an unattested guest hook path', async () => {
    scanned.hostRootHasTranscript = true

    const resolved = await resolveSessionFilePath('claude', 'wsl-sess', {
      transcriptPath: '/home/ada/.claude/projects/-home-ada-other/wsl-sess.jsonl',
      claudeProjectsDir: 'C:\\host\\projects'
    })

    expect(resolved).toBeNull()
    expect(scanned.dirs).toEqual([])
  })

  it('leaves the guest path alone on non-Windows hosts', async () => {
    setPlatform('darwin')
    const resolved = await resolveSessionFilePath('claude', 'wsl-sess', {
      transcriptPath: TRANSCRIPT_LINUX
    })
    expect(resolved).toBeNull()
  })
})
