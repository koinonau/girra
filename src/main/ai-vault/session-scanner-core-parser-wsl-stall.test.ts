import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NodeFsPromisesModule from 'node:fs/promises'
import type * as NodePathModule from 'node:path'
import type { SessionFileCandidate } from './session-scanner-types'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn()
}))

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof NodeFsPromisesModule>()),
  open: mocks.open,
  readFile: mocks.readFile,
  readdir: mocks.readdir,
  stat: mocks.stat
}))

// Derived sibling paths must retain Windows separators in this cross-platform test.
vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof NodePathModule>()
  return { ...actual.win32, default: actual.win32 }
})

import {
  parseAgentSessionFileCached,
  resetSessionParseCacheForTests
} from './session-scanner-parse-cache'
import {
  resetWslTranscriptFsGateForTests,
  WSL_TRANSCRIPT_FS_ROUTE_QUARANTINE_BASE_MS,
  WSL_TRANSCRIPT_FS_SCAN_TIMEOUT_MS,
  WslTranscriptFsError
} from '../native-chat/wsl-transcript-fs-gate'

function uncPath(distro: string, ...segments: string[]): string {
  return `\\\\wsl.localhost\\${distro}\\home\\ada\\${segments.join('\\')}`
}

const OPENCODE_ROOT = ['.local', 'share', 'opencode', 'storage']

const OPENCODE_SESSION = JSON.stringify({
  id: 'ses-1',
  title: 'OpenCode session',
  directory: '/repo/app',
  time: { created: 1780000000000 }
})

const OPENCODE_MESSAGE = JSON.stringify({
  role: 'user',
  content: [{ type: 'text', text: 'ship it' }],
  time: { created: 1780000000000 }
})

let releaseStall: (() => void) | undefined

function stalls<T>(): Promise<T> {
  return new Promise<T>((resolve) => {
    releaseStall = () => resolve({ bytesRead: 0, buffer: Buffer.alloc(0) } as T)
  })
}

function missing(): Error {
  return Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
}

// Complete: UNC readdir results pass through the child dispatcher's dirent
// serializer, which reads every kind flag.
function dirent(name: string) {
  return {
    name,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => false,
    isFIFO: () => false,
    isFile: () => true,
    isSocket: () => false,
    isSymbolicLink: () => false
  }
}

function candidate(agent: SessionFileCandidate['agent'], path: string): SessionFileCandidate {
  return {
    agent,
    file: {
      path,
      mtimeMs: 1,
      modifiedAt: '2026-06-01T10:05:00.000Z',
      sizeBytes: 128
    }
  }
}

async function expectRefusal(target: SessionFileCandidate): Promise<void> {
  const refusal = expect(parseAgentSessionFileCached(target, 'linux')).rejects.toBeInstanceOf(
    WslTranscriptFsError
  )
  await vi.advanceTimersByTimeAsync(WSL_TRANSCRIPT_FS_SCAN_TIMEOUT_MS + 1)
  await refusal
}

// A result that lands past the deadline never lifts the route quarantine, so
// recovery waits out the back-off window the same way production does.
async function releaseAndSettle(): Promise<void> {
  releaseStall?.()
  releaseStall = undefined
  await vi.advanceTimersByTimeAsync(WSL_TRANSCRIPT_FS_ROUTE_QUARANTINE_BASE_MS)
}

beforeEach(() => {
  // blockedRoutes is persistent gate state: a prior stall must not quarantine
  // this test's route.
  resetWslTranscriptFsGateForTests()
  resetSessionParseCacheForTests()
  mocks.open.mockReset()
  mocks.readFile.mockReset()
  mocks.readdir.mockReset()
  mocks.stat.mockReset()
  releaseStall = undefined
  mocks.stat.mockRejectedValue(missing())
  // performance.now drives the route quarantine clock, so it must be faked too.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
})

afterEach(async () => {
  await releaseAndSettle()
  vi.useRealTimers()
})

describe('OpenCode session parse against a stalled WSL transcript', () => {
  function sessionPath(distro: string): string {
    return uncPath(distro, ...OPENCODE_ROOT, 'session', 'prj', 'ses-1.json')
  }

  it('refuses a stalled message-directory listing instead of an empty transcript', async () => {
    mocks.readFile.mockResolvedValue(OPENCODE_SESSION)
    mocks.readdir.mockImplementation(stalls<unknown[]>)

    await expectRefusal(candidate('opencode', sessionPath('OpenCodeDir')))
  })

  it('refuses a stalled per-message read instead of a partial transcript', async () => {
    const file = sessionPath('OpenCodeMessage')
    mocks.readdir.mockResolvedValue([dirent('msg-1.json')])
    mocks.readFile.mockImplementation((path: string) =>
      path === file ? Promise.resolve(OPENCODE_SESSION) : stalls<string>()
    )

    await expectRefusal(candidate('opencode', file))
    await releaseAndSettle()

    mocks.readFile.mockImplementation((path: string) =>
      Promise.resolve(path === file ? OPENCODE_SESSION : OPENCODE_MESSAGE)
    )
    const recovered = await parseAgentSessionFileCached(candidate('opencode', file), 'linux')

    expect(recovered?.messageCount).toBe(1)
  })

  // A live process mid-write must stay a parseable session, not a refusal.
  it('still returns the session when a live process left a half-written message', async () => {
    const file = sessionPath('OpenCodeHalfWritten')
    mocks.readdir.mockResolvedValue([dirent('msg-1.json')])
    mocks.readFile.mockImplementation((path: string) =>
      Promise.resolve(path === file ? OPENCODE_SESSION : '{"role":"user",')
    )

    const session = await parseAgentSessionFileCached(candidate('opencode', file), 'linux')

    expect(session).toMatchObject({ agent: 'opencode', title: 'OpenCode session', messageCount: 0 })
  })
})
