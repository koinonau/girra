import { describe, expect, it } from 'vitest'
import {
  AGENT_SESSION_JOURNAL_SCHEMA_VERSION,
  journalRowSchemaVersion,
  type AgentJournalTurnLifecycle
} from './agent-session-journal-types'
import {
  agentJournalTurnBody,
  isRunningAgentJournalTurn,
  legacyAgentJournalTurnStatusBody,
  readAgentJournalTurn
} from './agent-session-turn-record'

const turn: AgentJournalTurnLifecycle = {
  turnId: 't1',
  state: 'completed',
  userItemId: 'claude:thread:t1:0',
  startedAt: 1_000,
  completedAt: 8_200,
  durationMs: 7_172
}

describe('readAgentJournalTurn', () => {
  it('reads the typed item and the legacy status form alike', () => {
    expect(readAgentJournalTurn(agentJournalTurnBody(turn))).toEqual(turn)
    expect(readAgentJournalTurn({ kind: 'status', text: 'x', turnLifecycle: turn })).toEqual(turn)
  })

  it('reads nothing off other bodies', () => {
    expect(readAgentJournalTurn({ kind: 'status', text: 'Conversation compacted.' })).toBeNull()
    expect(
      readAgentJournalTurn({
        kind: 'message',
        role: 'user',
        blocks: [{ type: 'text', text: 'hi' }]
      })
    ).toBeNull()
    expect(readAgentJournalTurn(undefined)).toBeNull()
  })

  it('answers the running check for either form', () => {
    expect(isRunningAgentJournalTurn(agentJournalTurnBody({ ...turn, state: 'running' }))).toBe(
      true
    )
    expect(isRunningAgentJournalTurn({ kind: 'status', text: 'x', turnLifecycle: turn })).toBe(
      false
    )
  })
})

describe('legacyAgentJournalTurnStatusBody', () => {
  it('never calls an unobserved end completed', () => {
    expect(legacyAgentJournalTurnStatusBody(turn)).toEqual({
      kind: 'status',
      text: 'Claude turn completed',
      turnLifecycle: turn
    })
    expect(
      legacyAgentJournalTurnStatusBody({ turnId: 't2', state: 'unverifiable', startedAt: 1 }).text
    ).toBe('Claude turn outcome unverifiable')
  })
})

describe('journalRowSchemaVersion', () => {
  it('stamps only rows that carry a turn item with the current version', () => {
    expect(AGENT_SESSION_JOURNAL_SCHEMA_VERSION).toBe(3)
    expect(journalRowSchemaVersion([agentJournalTurnBody(turn)])).toBe(3)
    expect(journalRowSchemaVersion([{ kind: 'message' }, { kind: 'status' }])).toBe(2)
    expect(journalRowSchemaVersion([])).toBe(2)
  })
})
