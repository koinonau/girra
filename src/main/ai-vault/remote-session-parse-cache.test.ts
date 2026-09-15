import { beforeEach, describe, expect, it } from 'vitest'
import type { FileReadResult } from '../providers/types'
import { getRemoteHostPlatform } from '../ssh/ssh-remote-platform'
import { resetRemoteSessionParseCacheForTests } from './remote-session-parse-cache'
import { scanRemoteAiVaultSessions } from './remote-session-scanner'
import { MemoryRemoteProvider, jsonLines } from './remote-session-scanner-test-fixtures'

/** Counts whole-transcript reads, which is the cost #13753 is about. */
class CountingRemoteProvider extends MemoryRemoteProvider {
  readonly readFilePaths: string[] = []

  override async readFile(filePath: string): Promise<FileReadResult> {
    if (filePath.includes('/sessions/')) {
      this.readFilePaths.push(filePath)
    }
    return await super.readFile(filePath)
  }
}

function transcript(sessionId: string, title: string, timestamp: string): string {
  return jsonLines([
    { type: 'session', id: sessionId, cwd: '/home/ada/repo', timestamp },
    {
      type: 'message',
      timestamp,
      message: { role: 'user', content: [{ type: 'text', text: title }] }
    }
  ])
}

function scan(provider: CountingRemoteProvider): ReturnType<typeof scanRemoteAiVaultSessions> {
  return scanRemoteAiVaultSessions({
    provider,
    executionHostId: 'ssh:dev-box',
    remoteHome: '/home/ada',
    hostPlatform: getRemoteHostPlatform('linux-x64')
  })
}

describe('remote AI Vault transcript re-reads', () => {
  beforeEach(() => {
    resetRemoteSessionParseCacheForTests()
  })

  it('does not re-read an unchanged corpus on the next scan', async () => {
    const provider = new CountingRemoteProvider()
    for (const day of ['07/07', '07/25', '08/10']) {
      provider.addFile(
        `/home/ada/.pi/agent/sessions/${day.replace('/', '-')}/session-${day.replace('/', '')}.jsonl`,
        transcript(
          `session-${day.replace('/', '')}`,
          `Work from ${day}`,
          '2026-07-07T01:00:00.000Z'
        ),
        1_000
      )
    }

    const first = await scan(provider)
    expect(first.sessions).toHaveLength(3)
    expect(provider.readFilePaths).toHaveLength(3)

    provider.readFilePaths.length = 0
    const second = await scan(provider)

    // Historical transcripts are immutable; a second pass must cost zero reads.
    expect(provider.readFilePaths).toEqual([])
    expect(second.sessions.map((session) => session.title)).toEqual(
      first.sessions.map((session) => session.title)
    )
  })

  it('re-reads a transcript that actually changed', async () => {
    const provider = new CountingRemoteProvider()
    const path = '/home/ada/.pi/agent/sessions/08-31/session-live.jsonl'
    provider.addFile(
      path,
      transcript('live-session', 'First prompt', '2026-08-31T01:00:00.000Z'),
      1_000
    )

    await scan(provider)
    provider.readFilePaths.length = 0

    provider.addFile(
      path,
      transcript('live-session', 'Second prompt', '2026-08-31T02:00:00.000Z'),
      2_000
    )
    const result = await scan(provider)

    expect(provider.readFilePaths).toEqual([path])
    expect(result.sessions[0]?.title).toBe('Second prompt')
  })

  it('re-reads when only the size changed under an unchanged mtime', async () => {
    const provider = new CountingRemoteProvider()
    const path = '/home/ada/.pi/agent/sessions/08-31/session-grown.jsonl'
    provider.addFile(path, transcript('grown-session', 'Short', '2026-08-31T01:00:00.000Z'), 1_000)

    await scan(provider)
    provider.readFilePaths.length = 0

    provider.addFile(
      path,
      transcript(
        'grown-session',
        'A much longer first prompt than before',
        '2026-08-31T01:00:00.000Z'
      ),
      1_000
    )
    const result = await scan(provider)

    expect(provider.readFilePaths).toEqual([path])
    expect(result.sessions[0]?.title).toBe('A much longer first prompt than before')
  })

  it('does not serve a cached parse to a different execution host', async () => {
    const provider = new CountingRemoteProvider()
    const path = '/home/ada/.pi/agent/sessions/08-31/session-host.jsonl'
    provider.addFile(
      path,
      transcript('host-session', 'Host scoped', '2026-08-31T01:00:00.000Z'),
      1_000
    )

    await scan(provider)
    provider.readFilePaths.length = 0

    const other = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:other-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(provider.readFilePaths).toEqual([path])
    expect(other.sessions[0]?.executionHostId).toBe('ssh:other-box')
  })

  it('does not cache a read that failed', async () => {
    const provider = new CountingRemoteProvider()
    const path = '/home/ada/.pi/agent/sessions/08-31/session-flaky.jsonl'
    provider.addFile(
      path,
      transcript('flaky-session', 'Recovered', '2026-08-31T01:00:00.000Z'),
      1_000
    )

    let failNextRead = true
    const originalReadFile = provider.readFile.bind(provider)
    provider.readFile = async (filePath: string): Promise<FileReadResult> => {
      if (failNextRead && filePath === path) {
        failNextRead = false
        provider.readFilePaths.push(filePath)
        throw new Error('EIO: transient relay read failure')
      }
      return await originalReadFile(filePath)
    }

    const failed = await scan(provider)
    expect(failed.sessions).toEqual([])
    expect(failed.issues).toHaveLength(1)

    provider.readFilePaths.length = 0
    const recovered = await scan(provider)

    expect(provider.readFilePaths).toEqual([path])
    expect(recovered.sessions[0]?.title).toBe('Recovered')
  })
})
