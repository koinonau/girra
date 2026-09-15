import { describe, expect, it } from 'vitest'
import { getRemoteHostPlatform } from '../ssh/ssh-remote-platform'
import { scanRemoteAiVaultSessions } from './remote-session-scanner'
import { MemoryRemoteProvider, jsonLines } from './remote-session-scanner-test-fixtures'

describe('scanRemoteAiVaultSessions', () => {
  it('parses Claude transcripts through the remote scanner', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.claude/projects/repo/claude-session.jsonl',
      jsonLines([
        {
          sessionId: 'claude-session',
          timestamp: '2026-07-04T04:00:00.000Z',
          type: 'user',
          message: { content: [{ type: 'text', text: 'Summarize the remote branch' }] }
        },
        {
          sessionId: 'claude-session',
          timestamp: '2026-07-04T04:00:01.000Z',
          type: 'assistant',
          message: { model: 'claude-opus-4', content: 'Sure.' }
        }
      ]),
      40
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.issues).toEqual([])
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]).toMatchObject({
      executionHostId: 'ssh:dev-box',
      executionHostPlatform: 'linux',
      agent: 'claude',
      sessionId: 'claude-session',
      title: 'Summarize the remote branch',
      model: 'claude-opus-4',
      filePath: '/home/ada/.claude/projects/repo/claude-session.jsonl'
    })
  })

  it('discovers Pi transcripts under the remote home sessions root', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.pi/agent/sessions/pi-session.jsonl',
      piTranscript({
        sessionId: 'pi-session',
        title: 'Pi remote title',
        cwd: '/home/ada/repo',
        timestamp: '2026-07-04T04:00:00.000Z'
      }),
      40
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.issues).toEqual([])
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]).toMatchObject({
      executionHostId: 'ssh:dev-box',
      executionHostPlatform: 'linux',
      agent: 'pi',
      sessionId: 'pi-session',
      title: 'Pi remote title',
      codexHome: null,
      filePath: '/home/ada/.pi/agent/sessions/pi-session.jsonl'
    })
  })

  it('reports non-missing remote directory failures', async () => {
    const provider = new MemoryRemoteProvider()
    const piSessionsDir = '/home/ada/.pi/agent/sessions'
    const claudeProjectDir = '/home/ada/.claude/projects/repo'
    provider.addFile(`${claudeProjectDir}/session.jsonl`, 'unreadable', 1)
    provider.failReadDir(
      piSessionsDir,
      new Error(`EACCES: permission denied, scandir '${piSessionsDir}'`)
    )
    provider.failReadDir(
      claudeProjectDir,
      new Error(`ECONNRESET: connection lost while reading '${claudeProjectDir}'`)
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.sessions).toEqual([])
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent: 'pi',
          kind: 'host',
          path: piSessionsDir,
          message: expect.stringContaining('EACCES')
        }),
        expect.objectContaining({
          agent: 'claude',
          kind: 'host',
          path: claudeProjectDir,
          message: expect.stringContaining('ECONNRESET')
        })
      ])
    )
    expect(result.issues).toHaveLength(2)
  })

  it('keeps missing optional remote directories silent', async () => {
    const provider = new MemoryRemoteProvider()
    const piSessionsDir = '/home/ada/.pi/agent/sessions'
    provider.failReadDir(
      piSessionsDir,
      new Error(`ENOENT: no such directory, scandir '${piSessionsDir}'`)
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.sessions).toEqual([])
    expect(result.issues).toEqual([])
  })

  it('excludes Claude subagent transcripts from remote scans', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.claude/projects/repo/claude-session.jsonl',
      jsonLines([
        {
          sessionId: 'claude-session',
          timestamp: '2026-07-04T04:00:00.000Z',
          type: 'user',
          message: { content: [{ type: 'text', text: 'Spawn a Task' }] }
        }
      ]),
      40
    )
    provider.addFile(
      '/home/ada/.claude/projects/repo/claude-session/subagents/agent-abc123.jsonl',
      jsonLines([
        {
          sessionId: 'claude-session',
          isSidechain: true,
          agentId: 'abc123',
          timestamp: '2026-07-04T04:01:00.000Z',
          type: 'user',
          message: { content: [{ type: 'text', text: 'Subagent task prompt' }] }
        }
      ]),
      41
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.issues).toEqual([])
    // Only the parent session surfaces; the subagent transcript would carry
    // the parent's sessionId and list as a phantom top-level row.
    expect(result.sessions.map((session) => session.filePath)).toEqual([
      '/home/ada/.claude/projects/repo/claude-session.jsonl'
    ])
  })

  it('counts remote sibling subagent transcripts for zero-turn Claude sessions', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.claude/projects/repo/lost-session.jsonl',
      jsonLines([{ type: 'mode', mode: 'default', sessionId: 'lost-session' }]),
      50
    )
    provider.addFile(
      '/home/ada/.claude/projects/repo/lost-session/subagents/agent-a.jsonl',
      jsonLines([{ type: 'user', message: { role: 'user', content: 'Subtask A' } }]),
      51
    )
    provider.addFile(
      '/home/ada/.claude/projects/repo/lost-session/subagents/agent-b.jsonl',
      jsonLines([{ type: 'user', message: { role: 'user', content: 'Subtask B' } }]),
      52
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.issues).toEqual([])
    // Subagent transcripts must not surface as standalone sessions; they only
    // contribute recoverable signal to their zero-turn parent.
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]).toMatchObject({
      agent: 'claude',
      sessionId: 'lost-session',
      messageCount: 0,
      subagentTranscriptCount: 2,
      filePath: '/home/ada/.claude/projects/repo/lost-session.jsonl'
    })
  })

  it('counts remote subagent siblings for Claude sessions with real turns', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.claude/projects/repo/live-session.jsonl',
      jsonLines([
        {
          sessionId: 'live-session',
          type: 'user',
          message: { content: [{ type: 'text', text: 'Do the thing' }] }
        }
      ]),
      60
    )
    provider.addFile(
      '/home/ada/.claude/projects/repo/live-session/subagents/agent-a.jsonl',
      jsonLines([{ type: 'user', message: { role: 'user', content: 'Subtask' } }]),
      61
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64')
    })

    expect(result.issues).toEqual([])
    expect(result.sessions).toHaveLength(1)
    // The walk listing supplies the count for every session (the row badge),
    // not only zero-turn recoverable ones.
    expect(result.sessions[0]).toMatchObject({
      sessionId: 'live-session',
      messageCount: 1,
      subagentTranscriptCount: 1
    })
  })

  it('builds resume commands with the remote host platform', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      'C:/Users/Ada/.pi/agent/sessions/win.jsonl',
      piTranscript({
        sessionId: 'win-session',
        title: 'Windows remote title',
        cwd: 'C:/repo/app',
        timestamp: '2026-07-04T03:00:00.000Z'
      }),
      30
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:win-box',
      remoteHome: 'C:/Users/Ada',
      hostPlatform: getRemoteHostPlatform('win32-x64')
    })

    expect(result.issues).toEqual([])
    expect(result.sessions[0]?.executionHostPlatform).toBe('win32')
    expect(result.sessions[0]?.resumeCommand).toBe(
      'cmd /d /s /c "cd /d ""C:/repo/app"" && pi --session ""win-session"""'
    )
  })

  it('keeps scoped remote sessions even when they are older than the recency cap', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.pi/agent/sessions/other.jsonl',
      piTranscript({
        sessionId: 'other-session',
        title: 'Other workspace',
        cwd: '/home/ada/other',
        timestamp: '2026-07-04T05:00:00.000Z'
      }),
      50
    )
    provider.addFile(
      '/home/ada/.pi/agent/sessions/scoped.jsonl',
      piTranscript({
        sessionId: 'scoped-session',
        title: 'Scoped workspace',
        cwd: '/home/ada/repo/app',
        timestamp: '2026-07-04T01:00:00.000Z'
      }),
      10
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64'),
      limit: 1,
      scopePaths: ['/home/ada/repo']
    })

    expect(result.issues).toEqual([])
    expect(result.sessions.map((session) => session.sessionId)).toEqual([
      'other-session',
      'scoped-session'
    ])
  })

  it('keeps looking past newer out-of-scope candidates during scoped backfill', async () => {
    const provider = new MemoryRemoteProvider()
    for (const [sessionId, mtimeMs, hour] of [
      ['other-newest', 50, '05'],
      ['other-newer', 40, '04']
    ] as const) {
      provider.addFile(
        `/home/ada/.pi/agent/sessions/${sessionId}.jsonl`,
        piTranscript({
          sessionId,
          title: sessionId,
          cwd: '/home/ada/other',
          timestamp: `2026-07-04T${hour}:00:00.000Z`
        }),
        mtimeMs
      )
    }
    provider.addFile(
      '/home/ada/.pi/agent/sessions/scoped.jsonl',
      piTranscript({
        sessionId: 'scoped-session',
        title: 'Scoped workspace',
        cwd: '/home/ada/repo',
        timestamp: '2026-07-04T01:00:00.000Z'
      }),
      10
    )

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64'),
      limit: 1,
      scopePaths: ['/home/ada/repo']
    })

    expect(result.issues).toEqual([])
    expect(result.sessions.map((session) => session.sessionId)).toEqual([
      'other-newest',
      'scoped-session'
    ])
  })

  it('caps scoped backfill at the requested limit', async () => {
    const provider = new MemoryRemoteProvider()
    provider.addFile(
      '/home/ada/.pi/agent/sessions/other.jsonl',
      piTranscript({
        sessionId: 'other-session',
        title: 'Other workspace',
        cwd: '/home/ada/other',
        timestamp: '2026-07-04T05:00:00.000Z'
      }),
      50
    )
    for (const [sessionId, mtimeMs] of [
      ['newer-scoped', 30],
      ['older-scoped', 20]
    ] as const) {
      provider.addFile(
        `/home/ada/.pi/agent/sessions/${sessionId}.jsonl`,
        piTranscript({
          sessionId,
          title: sessionId,
          cwd: '/home/ada/repo',
          timestamp: `2026-07-04T0${mtimeMs / 10}:00:00.000Z`
        }),
        mtimeMs
      )
    }

    const result = await scanRemoteAiVaultSessions({
      provider,
      executionHostId: 'ssh:dev-box',
      remoteHome: '/home/ada',
      hostPlatform: getRemoteHostPlatform('linux-x64'),
      limit: 1,
      scopePaths: ['/home/ada/repo']
    })

    expect(result.sessions.map((session) => session.sessionId)).toEqual([
      'other-session',
      'newer-scoped'
    ])
  })
})

function piTranscript(args: {
  sessionId: string
  title: string
  cwd: string
  timestamp: string
}): string {
  return jsonLines([
    { type: 'session', id: args.sessionId, cwd: args.cwd, timestamp: args.timestamp },
    {
      type: 'message',
      timestamp: args.timestamp.replace(':00.000Z', ':01.000Z'),
      message: { role: 'user', content: [{ type: 'text', text: args.title }] }
    }
  ])
}
