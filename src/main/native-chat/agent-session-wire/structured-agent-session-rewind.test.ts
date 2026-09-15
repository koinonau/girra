import { AgentSessionJournal } from '../agent-session-journal/journal-store'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agentJournalItemKey,
  agentJournalSubmissionKey
} from '../../../shared/agent-session-journal-item-key'
import { computeAgentSessionPayloadFingerprint } from '../../../shared/agent-session-mutation-envelope'
import { AgentSessionRecordStore } from '../../runtime/agent-session-record-store'
import { AgentSessionRewindRefusal } from './structured-agent-session-adapter'
import { StructuredAgentSessionHost } from './structured-agent-session-host'
import type {
  StructuredAgentSessionAdapter,
  StructuredAgentSessionAcquireInput,
  AgentSessionDispatchOutcome
} from './structured-agent-session-adapter'
import type { StructuredAgentSessionEventSink } from './structured-agent-session-event-sink'
import {
  HOST_TEST_NOW,
  HOST_TEST_SESSION,
  hostTestAttachParams,
  hostTestMessage,
  hostTestOperationId,
  resetHostTestOperationIds
} from './structured-agent-session-host-test-data'

const caller = { callerKey: 'desktop' }
let directory: string
let store: AgentSessionRecordStore
let host: StructuredAgentSessionHost
let sink: StructuredAgentSessionEventSink
let adapter: StructuredAgentSessionAdapter
let acquires: StructuredAgentSessionAcquireInput[]
let failClaude = false

const rewindAcquires = () => acquires.filter((input) => input.rewind)

beforeEach(async () => {
  resetHostTestOperationIds()
  failClaude = false
  acquires = []
  directory = await mkdtemp(join(tmpdir(), 'orca-rewind-'))
  store = await AgentSessionRecordStore.open({
    directory: join(directory, 'store'),
    hostId: 'local'
  })
  adapter = {
    supportsCreate: (_location, agent) => agent === 'claude',
    supportsLocation: () => true,
    acquire: async (input) => {
      acquires.push(input)
      if (input.rewind && failClaude) {
        throw new AgentSessionRewindRefusal('provider-refused')
      }
      if (input.rewind) {
        await input.rewind.onProved?.(input.rewind.targetUuid)
      }
      await input.rewindRecovery?.onProved()
      sink = input.events!
      const handle = input.identity.providerHandle
      return {
        process: {
          hostId: 'local',
          pid: 4000 + acquires.length,
          processStartTimeMs: HOST_TEST_NOW,
          spawnToken: input.spawnToken
        },
        acquisitionGeneration: `generation-${acquires.length}`,
        link: {
          linkId: `link-${acquires.length}`,
          mintedAtFence: input.fence,
          observedAt: HOST_TEST_NOW,
          origin: acquires.length === 1 ? 'created' : 'resumed',
          handle: {
            provider: 'claude',
            sessionId: handle.kind === 'claude' ? handle.sessionId : 'claude-session',
            leafUuid: input.rewind?.targetUuid ?? 'tip'
          }
        }
      }
    },
    dispatch: vi.fn(async (): Promise<AgentSessionDispatchOutcome> => ({
      state: 'unknown',
      reason: 'test'
    })),
    cancelTurn: async () => ({ cancelled: false }),
    answerPrompt: async () => {},
    setOption: async () => {},
    rewindSupport: () => ({ supported: true }),
    releaseAcquisition: async () => true,
    closeSession: async () => true
  }
  host = new StructuredAgentSessionHost({
    store,
    adapter,
    journalRoot: directory,
    claimKeyId: 'key',
    now: () => HOST_TEST_NOW,
    probeOwner: async () => ({ outcome: 'exit-observed' })
  })
})
afterEach(async () => {
  await host.flushAllStreamedEvents()
  await rm(directory, { recursive: true, force: true })
})

function claudeAttachParams(expectedRuntimeFence: number | null) {
  return hostTestAttachParams(expectedRuntimeFence, {
    accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/claude' },
    providerHandle: { kind: 'claude', sessionId: 'claude-session', leafUuid: 'tip' }
  })
}

async function seed(acceptedSubmissions = false) {
  expect(await host.attach(caller, claudeAttachParams(null))).toMatchObject({ ok: true })
  const keys = ['kept', 'drop', 'tip'].map((uuid) => ({
    provider: 'claude' as const,
    sessionId: 'claude-session',
    uuid
  }))
  let selectedItemId = agentJournalItemKey(keys[1]!)
  for (const [i, identity] of keys.entries()) {
    const body = {
      ...hostTestMessage(String(i)),
      role: i === 2 ? ('assistant' as const) : ('user' as const)
    }
    if (acceptedSubmissions && i !== 2) {
      const clientOperationId = hostTestOperationId()
      vi.mocked(adapter.dispatch).mockResolvedValueOnce({
        state: 'accepted',
        providerIdentity: identity
      })
      expect(
        await host.send(caller, {
          body,
          envelope: {
            sessionId: HOST_TEST_SESSION,
            clientOperationId,
            expectedRuntimeFence: store.getRecord(HOST_TEST_SESSION)!.lease.runtimeFence,
            payloadFingerprint: computeAgentSessionPayloadFingerprint({
              method: 'agentSession.send',
              sessionId: HOST_TEST_SESSION,
              fields: { body }
            })
          }
        })
      ).toMatchObject({ ok: true })
      if (i === 1) {
        selectedItemId = agentJournalSubmissionKey(clientOperationId)
      }
    } else {
      sink.appendItem(identity, body)
    }
  }
  await host.flushStreamedEvents(HOST_TEST_SESSION)
  return selectedItemId
}
function params(
  itemId: string,
  expectedEpoch = host.journalSnapshot(HOST_TEST_SESSION).cursor.epoch
) {
  return {
    itemId,
    expectedEpoch,
    envelope: {
      sessionId: HOST_TEST_SESSION,
      clientOperationId: hostTestOperationId(),
      expectedRuntimeFence: store.getRecord(HOST_TEST_SESSION)!.lease.runtimeFence,
      payloadFingerprint: computeAgentSessionPayloadFingerprint({
        method: 'agentSession.rewind',
        sessionId: HOST_TEST_SESSION,
        fields: { itemId, expectedEpoch }
      })
    }
  }
}

describe('host rewind', () => {
  it('resolves accepted user submissions to provider targets', async () => {
    const target = await seed(true)
    expect(target.startsWith('orca:')).toBe(true)
    expect(await host.rewind(caller, params(target))).toMatchObject({ ok: true })
    expect(host.journalSnapshot(HOST_TEST_SESSION).items).toHaveLength(1)
    expect(acquires[1]?.rewind).toMatchObject({ targetUuid: 'kept', dropsTurn: 'drop' })
  })

  it('retains the preceding accepted Claude prompt when rewinding its assistant response', async () => {
    await seed(true)
    const target = agentJournalItemKey({
      provider: 'claude',
      sessionId: 'claude-session',
      uuid: 'tip'
    })
    expect(await host.rewind(caller, params(target))).toMatchObject({ ok: true })
    expect(acquires[1]?.rewind).toMatchObject({ targetUuid: 'drop' })
    expect(host.journalSnapshot(HOST_TEST_SESSION).items).toHaveLength(2)
  })
  it('finishes a durable provider success on reattach without repeating the provider mutation', async () => {
    const target = await seed()
    const request = params(target)
    const replace = vi
      .spyOn(AgentSessionJournal.prototype, 'replaceEpochItems')
      .mockRejectedValueOnce(new Error('disk failed'))
    await expect(host.rewind(caller, request)).rejects.toThrow('disk failed')
    expect(store.getRecord(HOST_TEST_SESSION)?.rewind?.phase).toBe('provider-succeeded')
    replace.mockRestore()
    const fence = store.getRecord(HOST_TEST_SESSION)!.lease.runtimeFence
    expect(await host.attach(caller, claudeAttachParams(fence))).toMatchObject({ ok: true })
    expect(host.journalSnapshot(HOST_TEST_SESSION).items).toHaveLength(1)
    expect(store.getRecord(HOST_TEST_SESSION)?.rewind?.phase).toBe('completed')
    expect(await host.rewind(caller, request)).toMatchObject({ ok: true, replayed: true })
    expect(rewindAcquires()).toHaveLength(1)
  })

  it('replaces the epoch with the retained prefix and replays without another provider call', async () => {
    const target = await seed()
    const request = params(target)
    const result = await host.rewind(caller, request)
    expect(result).toMatchObject({ ok: true })
    expect(host.journalSnapshot(HOST_TEST_SESSION).items).toHaveLength(1)
    expect(host.journalSnapshot(HOST_TEST_SESSION).cursor.epoch).not.toBe(request.expectedEpoch)
    expect(await host.rewind(caller, request)).toMatchObject({ ok: true, replayed: true })
    expect(rewindAcquires()).toHaveLength(1)
  })
  it('reacquires Claude at the retained cursor with the same session and a new lease fence', async () => {
    const target = await seed()
    const before = store.getRecord(HOST_TEST_SESSION)!.lease.runtimeFence
    expect(await host.rewind(caller, params(target))).toMatchObject({ ok: true })
    const emit = vi.fn()
    const unsubscribe = host.subscribe({ id: 'after-rewind', sessionId: HOST_TEST_SESSION, emit })
    emit.mockClear()
    sink.appendItem(
      { provider: 'claude', sessionId: 'claude-session', uuid: 'next' },
      hostTestMessage('next')
    )
    sink.publish()
    await host.flushStreamedEvents(HOST_TEST_SESSION)
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'batch' }))
    unsubscribe()
    expect(acquires[1]?.rewind).toMatchObject({
      targetUuid: 'kept',
      previousLeafUuid: 'tip',
      dropsTurn: 'drop'
    })
    expect(store.getRecord(HOST_TEST_SESSION)!.lease.runtimeFence).toBeGreaterThan(before)
    expect(store.getRecord(HOST_TEST_SESSION)!.lease.ownerProcess?.pid).toBe(4002)
    expect(host.journalSnapshot(HOST_TEST_SESSION).items).toHaveLength(2)
  })
  it('recovers a Claude refusal with one plain resume and preserves the journal', async () => {
    const target = await seed()
    failClaude = true
    const before = host.journalSnapshot(HOST_TEST_SESSION)
    expect(await host.rewind(caller, params(target))).toMatchObject({
      ok: false,
      refusal: { rewindReason: 'provider-refused' }
    })
    expect(acquires).toHaveLength(3)
    expect(acquires[2]?.rewind).toBeUndefined()
    expect(host.journalSnapshot(HOST_TEST_SESSION)).toEqual(before)
    expect(store.getRecord(HOST_TEST_SESSION)!.lease.claimStatus).toBe('live')
  })
  it('refuses a rewind racing an active turn before provider execution', async () => {
    const target = await seed()
    sink.appendItem(
      { provider: 'orca', clientMessageId: 'active' },
      { kind: 'status', text: 'working', turnLifecycle: { turnId: 'active', state: 'running' } }
    )
    expect(await host.rewind(caller, params(target))).toMatchObject({
      ok: false,
      refusal: { rewindReason: 'busy' }
    })
    expect(rewindAcquires()).toHaveLength(0)
  })
  it('fences a stale owner before provider execution', async () => {
    const target = await seed()
    const stale = params(target)
    stale.envelope.expectedRuntimeFence++
    expect(await host.rewind(caller, stale)).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_checkpoint_stale' }
    })
    expect(rewindAcquires()).toHaveLength(0)
  })
  it('refuses stale epochs and targets from another provider', async () => {
    const target = await seed()
    expect(await host.rewind(caller, params(target, 'old-epoch'))).toMatchObject({
      ok: false,
      refusal: { rewindReason: 'stale-epoch' }
    })
    expect(await host.rewind(caller, params('claude:foreign'))).toMatchObject({
      ok: false,
      refusal: { rewindReason: 'invalid-target' }
    })
    expect(rewindAcquires()).toHaveLength(0)
  })
  it('settles the existing epoch after a crash between journal commit and record completion', async () => {
    const target = await seed()
    const request = params(target)
    const transition = store.transitionHandoff.bind(store)
    const checkpoint = vi
      .spyOn(store, 'transitionHandoff')
      .mockImplementation((sessionId, update) =>
        transition(sessionId, (record) => {
          const next = update(record)
          if (next.rewind?.phase === 'completed') {
            throw new Error('completion write failed')
          }
          return next
        })
      )
    await expect(host.rewind(caller, request)).rejects.toThrow('completion write failed')
    const committed = host.journalSnapshot(HOST_TEST_SESSION)
    expect(committed.cursor.epoch).not.toBe(request.expectedEpoch)
    checkpoint.mockRestore()
    const replace = vi.spyOn(AgentSessionJournal.prototype, 'replaceEpochItems')
    expect(
      await host.attach(
        caller,
        claudeAttachParams(store.getRecord(HOST_TEST_SESSION)!.lease.runtimeFence)
      )
    ).toMatchObject({ ok: true })
    expect(host.journalSnapshot(HOST_TEST_SESSION)).toEqual(committed)
    expect(replace).not.toHaveBeenCalled()
    replace.mockRestore()
    expect(await host.rewind(caller, request)).toMatchObject({ ok: true, replayed: true })
  })
})
