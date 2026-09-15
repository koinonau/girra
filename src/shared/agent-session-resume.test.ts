import { describe, expect, it } from 'vitest'
import {
  agentProviderSessionsEqual,
  extractAgentProviderSession,
  getAgentResumeArgv,
  isResumableTuiAgent,
  normalizeAgentProviderSession
} from './agent-session-resume'

describe('agent session resume metadata', () => {
  it('keeps only the launch roster resumable', () => {
    expect(['claude', 'opencode', 'pi'].every(isResumableTuiAgent)).toBe(true)
    expect(['codex', 'omp', 'kimi', 'prime-agent'].some(isResumableTuiAgent)).toBe(false)
  })

  it.each([
    ['claude', { session_id: 'claude-session' }, { key: 'session_id', id: 'claude-session' }],
    ['opencode', { sessionID: 'opencode-session' }, { key: 'session_id', id: 'opencode-session' }],
    [
      'pi',
      { session_id: 'pi-session', session_file: '/tmp/pi-session.jsonl' },
      { key: 'session_id', id: 'pi-session', transcriptPath: '/tmp/pi-session.jsonl' }
    ]
  ] as const)('extracts %s provider session ids', (source, payload, expected) => {
    expect(extractAgentProviderSession(source, payload)).toEqual(expected)
  })

  it.each([
    ['claude', { key: 'session_id', id: 's1' }, ['claude', '--resume', 's1']],
    ['opencode', { key: 'session_id', id: 's1' }, ['opencode', '--session', 's1']],
    [
      'pi',
      { key: 'session_id', id: 's1', transcriptPath: '/tmp/pi-session.jsonl' },
      ['pi', '--session', '/tmp/pi-session.jsonl']
    ]
  ] as const)('builds %s resume argv', (agent, providerSession, expected) => {
    expect(getAgentResumeArgv(agent, providerSession)).toEqual(expected)
  })

  it('rejects unsafe ids', () => {
    expect(normalizeAgentProviderSession({ key: 'session_id', id: 'bad\nid' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: '--last' })).toBeNull()
    expect(extractAgentProviderSession('claude', { session_id: '--last' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: 'ok' })).toEqual({
      key: 'session_id',
      id: 'ok'
    })
  })

  it('does not capture ephemeral Pi sessions without a session file', () => {
    expect(extractAgentProviderSession('pi', { session_id: 'pi-session' })).toBeNull()
    expect(
      extractAgentProviderSession('pi', { session_id: 'pi-session', session_file: '' })
    ).toBeNull()
    expect(extractAgentProviderSession('pi', { session_file: '/tmp/pi-session.jsonl' })).toBeNull()
    expect(getAgentResumeArgv('pi', { key: 'session_id', id: 'pi-session' })).toBeNull()
  })

  it('compares the actual provider resume locator for each agent', () => {
    const first = { key: 'session_id' as const, id: 'session-1', transcriptPath: '/tmp/first' }
    const second = { key: 'session_id' as const, id: 'session-1', transcriptPath: '/tmp/second' }

    expect(agentProviderSessionsEqual('pi', first, second)).toBe(false)
    expect(agentProviderSessionsEqual('claude', first, second)).toBe(true)
  })

  it('rejects opencode resume when provider session key is not session_id', () => {
    expect(getAgentResumeArgv('opencode', { key: 'conversation_id', id: 'x' })).toBeNull()
  })

  it('captures the hook transcript_path for claude', () => {
    expect(
      extractAgentProviderSession('claude', {
        session_id: 'cs',
        transcript_path: '/home/u/.claude/projects/slug/real.jsonl'
      })
    ).toEqual({
      key: 'session_id',
      id: 'cs',
      transcriptPath: '/home/u/.claude/projects/slug/real.jsonl'
    })
    expect(
      extractAgentProviderSession('claude', { session_id: 'xs', transcriptPath: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'xs', transcriptPath: '/x/r.jsonl' })
  })

  it('does not attach transcript_path for non-native-chat agents', () => {
    expect(
      extractAgentProviderSession('opencode', { sessionID: 'os', transcript_path: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'os' })
  })

  it('round-trips transcriptPath through normalizeAgentProviderSession', () => {
    expect(
      normalizeAgentProviderSession({ key: 'session_id', id: 'ok', transcriptPath: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'ok', transcriptPath: '/x/r.jsonl' })
    expect(
      normalizeAgentProviderSession({
        key: 'session_id',
        id: 'ok',
        transcriptPath: '/tmp/bad\npath.jsonl'
      })
    ).toEqual({ key: 'session_id', id: 'ok' })
  })
})
