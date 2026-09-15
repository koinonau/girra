// Legacy import runs the existing per-agent transcript decoders and keys the
// results by identity read off the same raw lines. Fixtures are shaped like the
// files the providers actually write.

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentJournalItemKey } from '../../../shared/agent-session-journal-item-key'
import type { AgentSessionJournalIdentity } from '../../../shared/agent-session-journal-types'
import { createLegacyIdentityTracker } from './journal-legacy-identity'
import {
  appendLegacyTranscriptMessages,
  importLegacyTranscriptIntoJournal
} from './journal-legacy-import'
import { DEFAULT_JOURNAL_PAYLOAD_LIMITS } from './journal-payload-bounds'
import { openAgentSessionJournal } from './journal-store-factory'
import type { AgentSessionJournal } from './journal-store'

const CLAUDE_SESSION = '29eb22a4-6a5f-4f21-9b0c-1d7f3a2e5c88'

let root: string
let clock = 1_000

function tick(): number {
  clock += 1
  return clock
}

function identity(sessionId: string): AgentSessionJournalIdentity {
  return {
    sessionId,
    workspaceId: 'ws-1',
    hostId: 'host-1',
    agent: 'claude',
    providerHandle: { kind: 'claude', sessionId, leafUuid: null }
  }
}

async function open(
  sessionId: string,
  overrides: Partial<Parameters<typeof openAgentSessionJournal>[0]> = {}
): Promise<AgentSessionJournal> {
  return openAgentSessionJournal({
    identity: identity(sessionId),
    journalDir: root,
    now: tick,
    mintEpoch: () => `epoch-${clock}`,
    ...overrides
  })
}

function legacyKey(recordId: string): string {
  return agentJournalItemKey({
    provider: 'legacy',
    agent: 'claude',
    sessionId: CLAUDE_SESSION,
    recordId
  })
}

async function writeFixture(name: string, lines: unknown[]): Promise<string> {
  const path = join(root, name)
  await writeFile(path, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf-8')
  return path
}

const CLAUDE_LINES = [
  { type: 'file-history-snapshot', messageId: 'boot', snapshot: {} },
  {
    parentUuid: null,
    isSidechain: false,
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text: 'add a retry' }] },
    uuid: 'c1a5f0de-2b44-4a11-9f0e-7c2d31b6aa04',
    timestamp: '2026-08-05T10:00:00.000Z',
    cwd: '/Users/dev/project',
    sessionId: CLAUDE_SESSION,
    version: '2.1.220',
    gitBranch: 'main'
  },
  {
    parentUuid: 'c1a5f0de-2b44-4a11-9f0e-7c2d31b6aa04',
    isSidechain: false,
    type: 'assistant',
    requestId: 'req_01',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'On it.' }],
      id: 'msg_ignored_in_favour_of_uuid'
    },
    uuid: 'b7c9e1f2-8a30-4d55-91ab-6f0e2c4d8b11',
    timestamp: '2026-08-05T10:00:04.000Z',
    sessionId: CLAUDE_SESSION,
    version: '2.1.220'
  },
  {
    parentUuid: 'b7c9e1f2-8a30-4d55-91ab-6f0e2c4d8b11',
    isSidechain: false,
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'toolu_01', name: 'Edit', input: { file_path: 'a.ts' } }]
    },
    uuid: 'd2f4a6b8-1c02-4e77-83bd-5a9c7e1f3d20',
    timestamp: '2026-08-05T10:00:07.000Z',
    sessionId: CLAUDE_SESSION
  },
  {
    parentUuid: 'd2f4a6b8-1c02-4e77-83bd-5a9c7e1f3d20',
    isSidechain: false,
    isMeta: true,
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: 'edited 1 file' }]
    },
    uuid: 'e3a5b7c9-2d13-4f88-94ce-6b0d8f2a4e31',
    timestamp: '2026-08-05T10:00:08.000Z',
    sessionId: CLAUDE_SESSION
  },
  { type: 'last-prompt', leafUuid: 'e3a5b7c9-2d13-4f88-94ce-6b0d8f2a4e31' }
]

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-journal-import-'))
  clock = 1_000
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('claude import', () => {
  it('keys items by (session id, uuid) from the raw record', async () => {
    const filePath = await writeFixture('claude.jsonl', CLAUDE_LINES)
    const journal = await open(CLAUDE_SESSION)
    const result = await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath }
    })

    expect(result.ok).toBe(true)
    expect(journal.snapshot().items.map((entry) => entry.itemId)).toEqual([
      agentJournalItemKey({
        provider: 'claude',
        sessionId: CLAUDE_SESSION,
        uuid: 'c1a5f0de-2b44-4a11-9f0e-7c2d31b6aa04'
      }),
      agentJournalItemKey({
        provider: 'claude',
        sessionId: CLAUDE_SESSION,
        uuid: 'b7c9e1f2-8a30-4d55-91ab-6f0e2c4d8b11'
      }),
      agentJournalItemKey({
        provider: 'claude',
        sessionId: CLAUDE_SESSION,
        uuid: 'd2f4a6b8-1c02-4e77-83bd-5a9c7e1f3d20'
      }),
      agentJournalItemKey({
        provider: 'claude',
        sessionId: CLAUDE_SESSION,
        uuid: 'e3a5b7c9-2d13-4f88-94ce-6b0d8f2a4e31'
      })
    ])
  })

  it('stays aligned when the decoder drops lines the tracker still walks', async () => {
    const filePath = await writeFixture('claude.jsonl', CLAUDE_LINES)
    const journal = await open(CLAUDE_SESSION)
    await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath }
    })
    const items = journal.snapshot().items
    // The first record is a file-history snapshot the decoder discards; if the
    // anchors were misaligned, the first bubble would carry its identity.
    expect(items[0]?.body).toEqual({
      kind: 'message',
      role: 'user',
      blocks: [{ type: 'text', text: 'add a retry' }]
    })
    expect(items[2]?.body).toMatchObject({ kind: 'tool-call', name: 'Edit' })
  })

  it('is idempotent: a second import reproduces the same timeline in a new epoch', async () => {
    const filePath = await writeFixture('claude.jsonl', CLAUDE_LINES)
    const journal = await open(CLAUDE_SESSION)
    const options = { filePath }
    await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options
    })
    const first = journal.snapshot()
    const firstEpoch = journal.epoch

    await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options
    })
    const second = journal.snapshot()

    expect(journal.epoch).not.toBe(firstEpoch)
    expect(second.items.map((entry) => entry.itemId)).toEqual(
      first.items.map((entry) => entry.itemId)
    )
    expect(second.items.map((entry) => entry.body)).toEqual(first.items.map((entry) => entry.body))
  })

  it('reconciles a forked transcript onto the parent uuids rather than duplicating them', () => {
    const tracker = createLegacyIdentityTracker({
      agent: 'claude',
      // The fork's own session id, which is NOT what the copied records carry.
      sessionId: '7b1e5d33-0f28-42ac-8d59-9a4c6e2b1f70'
    })
    const copied = JSON.stringify(CLAUDE_LINES[1])
    expect(tracker.identify(copied, 0)).toEqual({
      provider: 'claude',
      sessionId: CLAUDE_SESSION,
      uuid: 'c1a5f0de-2b44-4a11-9f0e-7c2d31b6aa04'
    })
  })

  it('upserts live transcript messages without rolling the structured epoch', async () => {
    const journal = await open(CLAUDE_SESSION)
    const epoch = journal.epoch
    const message = {
      id: 'live-tui-message',
      role: 'assistant' as const,
      blocks: [{ type: 'text' as const, text: 'first version' }],
      timestamp: 1_800_000_000_000,
      source: 'transcript' as const
    }

    await appendLegacyTranscriptMessages({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 2,
      messages: [message]
    })
    await appendLegacyTranscriptMessages({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 2,
      messages: [{ ...message, blocks: [{ type: 'text', text: 'final version' }] }]
    })

    expect(journal.epoch).toBe(epoch)
    expect(journal.snapshot().items).toMatchObject([
      {
        itemId: legacyKey('live-tui-message'),
        revision: 2,
        body: {
          kind: 'message',
          role: 'assistant',
          blocks: [{ type: 'text', text: 'final version' }]
        }
      }
    ])
  })

  it('falls back to line position only when a record carries no uuid', () => {
    const tracker = createLegacyIdentityTracker({ agent: 'claude', sessionId: CLAUDE_SESSION })
    expect(tracker.identify(JSON.stringify(CLAUDE_LINES[0]), 3)).toEqual({
      provider: 'legacy',
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      recordId: '#3'
    })
  })
})

describe('payload bounds on import', () => {
  it('marks a clipped tool result and discards the remainder', async () => {
    const output = 'y'.repeat(64 * 1024)
    const filePath = await writeFixture('claude-big.jsonl', [
      {
        parentUuid: null,
        isSidechain: false,
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_9', content: output }]
        },
        uuid: 'aa11bb22-cc33-4d44-8e55-6f7788990011',
        timestamp: '2026-08-05T10:00:09.000Z',
        sessionId: CLAUDE_SESSION
      }
    ])
    const journal = await open(CLAUDE_SESSION)
    await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath, limits: { ...DEFAULT_JOURNAL_PAYLOAD_LIMITS, inlineHeadBytes: 1_024 } }
    })

    const item = journal.snapshot().items[0]
    expect(item?.body).toMatchObject({ kind: 'tool-call', state: 'completed' })
    const body = item?.body
    if (body?.kind !== 'tool-call' || !body.output) {
      throw new Error('expected a bounded tool-call output')
    }
    expect(body.output.truncated).toBe(true)
    expect(body.output.byteLength).toBe(64 * 1024)
    expect(body.output.head).toHaveLength(1_024)
  })

  it('bounds an imported subagent roster by entry count, label and id', async () => {
    // The import reads an untrusted file: nothing upstream bounded either string.
    const oversized = 'z'.repeat(20 * 1024)
    const journal = await open(CLAUDE_SESSION)
    await appendLegacyTranscriptMessages({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      messages: [
        {
          id: 'legacy-roster',
          role: 'assistant',
          timestamp: null,
          source: 'transcript',
          blocks: [
            {
              type: 'subagent-group',
              groupId: 'group-1',
              agents: Array.from({ length: 80 }, (_, index) => ({
                id: index === 0 ? oversized : `task-${index}`,
                label: index === 0 ? oversized : `label-${index}`,
                state: 'working' as const
              }))
            }
          ]
        }
      ]
    })

    const body = journal.snapshot().items[0]?.body
    const block = body?.kind === 'message' ? body.blocks[0] : undefined
    if (block?.type !== 'subagent-group') {
      throw new Error('expected a subagent-group block')
    }
    expect(block.agents).toHaveLength(64)
    expect(block.agents[0]?.label.length).toBeLessThan(oversized.length)
    expect(block.agents[0]?.id.length).toBeLessThan(oversized.length)
    expect(block.agents[0]?.id.startsWith('z')).toBe(true)
  })

  it('bounds a roster id in the shared format, keeping a shared prefix distinct', async () => {
    // The id is the roster key: it takes the same bounded-id format the wires
    // use, so a later wire bound is a no-op instead of a second, merging clip.
    const head = 'y'.repeat(512)
    const journal = await open(CLAUDE_SESSION)
    await appendLegacyTranscriptMessages({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      messages: [
        {
          id: 'legacy-roster-collision',
          role: 'assistant',
          timestamp: null,
          source: 'transcript',
          blocks: [
            {
              type: 'subagent-group',
              groupId: 'group-1',
              agents: [
                { id: `${head}-one`, label: 'Audit', state: 'working' as const },
                { id: `${head}-two`, label: 'Audit', state: 'working' as const }
              ]
            }
          ]
        }
      ]
    })

    const body = journal.snapshot().items[0]?.body
    const block = body?.kind === 'message' ? body.blocks[0] : undefined
    if (block?.type !== 'subagent-group') {
      throw new Error('expected a subagent-group block')
    }
    expect(block.agents[0]?.id).not.toBe(block.agents[1]?.id)
    expect(block.agents[0]?.id).toHaveLength(512)
  })
})

describe('import failures', () => {
  it('rejects a legacy source above the fixed 16 MiB import cap before decoding', async () => {
    const journalDir = join(root, 'oversized-source-journal')
    const journal = await open(CLAUDE_SESSION, { journalDir })
    const filePath = join(root, 'oversized-source.jsonl')
    await writeFile(filePath, 'x'.repeat(16 * 1024 * 1024 + 1), 'utf8')
    const epoch = journal.epoch

    await expect(
      importLegacyTranscriptIntoJournal({
        journal,
        agent: 'claude',
        sessionId: CLAUDE_SESSION,
        fence: 1,
        options: { filePath }
      })
    ).resolves.toMatchObject({
      ok: false,
      error: `Legacy transcript exceeds the ${16 * 1024 * 1024}-byte import bound`
    })
    expect(journal.epoch).toBe(epoch)
    expect(journal.snapshot().items).toEqual([])
  })

  it('bounds oversized legacy tool-call input before journal publication', async () => {
    const journalDir = join(root, 'bounded-tool-input-journal')
    const limits = { ...DEFAULT_JOURNAL_PAYLOAD_LIMITS, inlineHeadBytes: 64 }
    const journal = await open(CLAUDE_SESSION, { journalDir })
    const filePath = await writeFixture('oversized-tool-input.jsonl', [
      {
        parentUuid: null,
        isSidechain: false,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_large_input',
              name: 'Edit',
              input: { file_path: 'a.ts', patch: 'x'.repeat(10_000) }
            }
          ]
        },
        uuid: 'cc11ad00-1111-4222-8333-444455556666',
        timestamp: '2026-08-05T10:00:09.000Z',
        sessionId: CLAUDE_SESSION
      }
    ])

    const result = await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath, limits }
    })
    expect(result.ok).toBe(true)
    const imported = journal.snapshot().items[0]
    expect(imported?.body).toMatchObject({
      kind: 'tool-call',
      input: {
        truncated: true,
        byteLength: expect.any(Number),
        digest: expect.stringMatching(/^[0-9a-f]{64}$/),
        head: expect.any(String)
      }
    })
    expect(JSON.stringify(imported?.body)).not.toContain('x'.repeat(1_000))
  })

  it('reports a missing transcript without touching the journal', async () => {
    const journal = await open(CLAUDE_SESSION)
    const before = journal.epoch
    const result = await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath: join(root, 'missing.jsonl') }
    })
    expect(result).toMatchObject({ ok: false })
    expect(journal.epoch).toBe(before)
  })

  // A transcript with no decodable messages recovers nothing. Publishing an
  // empty replacement would roll the epoch and drop whatever the journal held —
  // including a repair's own anchor and disclosure.
  it('leaves the epoch untouched when the transcript decodes to no messages', async () => {
    const journal = await open(CLAUDE_SESSION)
    await journal.appendItem(
      { provider: 'claude', sessionId: CLAUDE_SESSION, uuid: 'kept-1' },
      { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'kept' }] },
      { fence: 1 }
    )
    const before = journal.epoch
    const metadataOnly = await writeFixture('metadata-only.jsonl', [
      CLAUDE_LINES[0],
      CLAUDE_LINES.at(-1)
    ])

    const result = await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath: metadataOnly }
    })

    expect(result).toMatchObject({ ok: true, imported: 0, replaced: false })
    expect(journal.epoch).toBe(before)
    expect(journal.snapshot().items).toHaveLength(1)
    await journal.close()
  })

  it('rejects an agent with no transcript decoder', async () => {
    const journal = await open(CLAUDE_SESSION)
    const result = await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'gemini',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath: join(root, 'claude.jsonl') }
    })
    expect(result).toMatchObject({ ok: false })
  })
})

// A tool call is only the SOLE block of its message when the provider wrote it
// that way. Claude interleaves it with narration, so the multi-block path carries
// untrusted tool input too.
describe('multi-block legacy messages', () => {
  const limits = { ...DEFAULT_JOURNAL_PAYLOAD_LIMITS, inlineHeadBytes: 64 }
  const oversized = 'x'.repeat(10_000)

  /** The tool-call block of the first imported multi-block message. */
  function importedToolCallBlock(journal: AgentSessionJournal): unknown {
    for (const entry of journal.snapshot().items) {
      if (entry.body.kind !== 'message') {
        continue
      }
      const block = entry.body.blocks.find((candidate) => candidate.type === 'tool-call')
      if (block) {
        return block.input
      }
    }
    return null
  }

  it('bounds a Claude tool call that shares its message with narration', async () => {
    const journal = await open(CLAUDE_SESSION, {
      journalDir: join(root, 'claude-mixed-journal')
    })
    const filePath = await writeFixture('claude-mixed.jsonl', [
      {
        parentUuid: null,
        isSidechain: false,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Editing the file.' },
            {
              type: 'tool_use',
              id: 'toolu_mixed',
              name: 'Edit',
              input: { file_path: 'a.ts', patch: oversized }
            }
          ]
        },
        uuid: 'dd22be00-1111-4222-8333-444455556666',
        timestamp: '2026-08-05T10:00:09.000Z',
        sessionId: CLAUDE_SESSION
      }
    ])

    const result = await importLegacyTranscriptIntoJournal({
      journal,
      agent: 'claude',
      sessionId: CLAUDE_SESSION,
      fence: 1,
      options: { filePath, limits }
    })

    expect(result.ok).toBe(true)
    expect(importedToolCallBlock(journal)).toMatchObject({
      truncated: true,
      byteLength: expect.any(Number),
      digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      head: expect.any(String)
    })
    expect(JSON.stringify(journal.snapshot().items)).not.toContain('x'.repeat(1_000))
    await journal.close()
  })
})
