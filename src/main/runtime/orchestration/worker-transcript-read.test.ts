import { appendFile, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readWorkerTranscript } from './worker-transcript-read'

function claudeMessage(id: string, text: string): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: id,
    timestamp: '2026-07-24T12:00:00.000Z',
    message: { role: 'assistant', content: [{ type: 'text', text }] }
  })
}

describe('worker transcript reads', () => {
  let directory: string
  let transcriptPath: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'orca-worker-transcript-'))
    transcriptPath = join(directory, 'session.jsonl')
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('returns a bounded tail followed by new messages from the exact file', async () => {
    await writeFile(
      transcriptPath,
      [
        claudeMessage('one', 'first'),
        claudeMessage('two', 'second'),
        claudeMessage('three', 'third')
      ]
        .join('\n')
        .concat('\n')
    )

    const initial = await readWorkerTranscript({
      agent: 'claude',
      sessionId: 'session-exact',
      transcriptPath,
      limit: 2
    })
    expect(initial).toMatchObject({
      ok: true,
      messages: [
        { id: 'two', blocks: [{ type: 'text', text: 'second' }] },
        { id: 'three', blocks: [{ type: 'text', text: 'third' }] }
      ],
      limited: true
    })
    if (!initial.ok) {
      throw new Error('Expected the initial transcript page')
    }

    await appendFile(transcriptPath, `{malformed}\n${claudeMessage('four', 'fourth')}\n`)
    const appended = await readWorkerTranscript({
      agent: 'claude',
      sessionId: 'session-exact',
      transcriptPath,
      offset: initial.nextOffset,
      expectedSourceFingerprint: initial.sourceFingerprint,
      expectedBoundaryCheckpoint: initial.boundaryCheckpoint,
      limit: 2
    })

    expect(appended).toMatchObject({
      ok: true,
      messages: [{ id: 'four', blocks: [{ type: 'text', text: 'fourth' }] }],
      limited: false,
      warnings: ['1 malformed transcript record(s) were skipped.']
    })
  })

  it.each([
    ['equal-size', 0],
    ['larger', 64]
  ])('rejects a same-inode truncate/regrow at %s', async (_label, extraBytes) => {
    await writeFile(
      transcriptPath,
      `${claudeMessage('one', 'original transcript with enough padding for equal-size rewrite')}\n`
    )
    const initial = await readWorkerTranscript({
      agent: 'claude',
      sessionId: 'session-exact',
      transcriptPath,
      limit: 10
    })
    if (!initial.ok) {
      throw new Error('Expected the original transcript page')
    }
    const before = await stat(transcriptPath, { bigint: true })
    const replacementLine = `${claudeMessage('other', 'unrelated rewrite')}\n`
    const replacement = replacementLine.padEnd(initial.nextOffset + extraBytes, ' ')

    await writeFile(transcriptPath, replacement)

    const after = await stat(transcriptPath, { bigint: true })
    expect(after.ino).toBe(before.ino)
    expect(after.dev).toBe(before.dev)
    expect(Number(after.size)).toBeGreaterThanOrEqual(initial.nextOffset)
    await expect(
      readWorkerTranscript({
        agent: 'claude',
        sessionId: 'session-exact',
        transcriptPath,
        offset: initial.nextOffset,
        expectedSourceFingerprint: initial.sourceFingerprint,
        expectedBoundaryCheckpoint: initial.boundaryCheckpoint,
        limit: 10
      })
    ).resolves.toEqual({ ok: false, reason: 'source_changed', warnings: [] })
  })

  it('reports source changes and unsupported providers without guessing', async () => {
    await writeFile(transcriptPath, `${claudeMessage('one', 'first')}\n`)

    await expect(
      readWorkerTranscript({
        agent: 'claude',
        sessionId: 'session-exact',
        transcriptPath,
        offset: 10_000,
        limit: 2
      })
    ).resolves.toMatchObject({ ok: false, reason: 'source_changed' })

    await expect(
      readWorkerTranscript({
        agent: 'gemini',
        sessionId: 'session-other',
        transcriptPath,
        limit: 2
      })
    ).resolves.toEqual({ ok: false, reason: 'provider_unsupported', warnings: [] })
  })

  it('makes file-position fallback IDs opaque', async () => {
    await writeFile(
      transcriptPath,
      `${JSON.stringify({
        type: 'assistant',
        timestamp: '2026-07-24T12:00:00.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'no provider id' }] }
      })}\n`
    )

    const result = await readWorkerTranscript({
      agent: 'claude',
      sessionId: 'session-exact',
      transcriptPath,
      limit: 2
    })

    expect(result).toMatchObject({
      ok: true,
      messages: [{ id: expect.stringMatching(/^worker-message-/) }],
      warnings: ['Transcript-backed message identifiers were made opaque.']
    })
    expect(result.ok && JSON.stringify(result.messages)).not.toContain(transcriptPath)
  })

  it('advances past a record larger than the forward scan window', async () => {
    await writeFile(transcriptPath, 'x'.repeat(8 * 1024 * 1024 + 10))

    const oversized = await readWorkerTranscript({
      agent: 'claude',
      sessionId: 'session-exact',
      transcriptPath,
      offset: 0,
      limit: 2
    })
    expect(oversized).toMatchObject({
      ok: true,
      messages: [],
      limited: true,
      warnings: expect.arrayContaining([
        '1 oversized transcript record(s) were skipped.',
        'Transcript scanning stopped at the bounded byte limit; continue with the cursor.'
      ])
    })
    if (!oversized.ok) {
      throw new Error('Expected the oversized transcript page')
    }
    expect(oversized.nextOffset).toBe(8 * 1024 * 1024)

    await appendFile(transcriptPath, `\n${claudeMessage('after', 'after oversized')}\n`)
    const continued = await readWorkerTranscript({
      agent: 'claude',
      sessionId: 'session-exact',
      transcriptPath,
      offset: oversized.nextOffset,
      expectedSourceFingerprint: oversized.sourceFingerprint,
      expectedBoundaryCheckpoint: oversized.boundaryCheckpoint,
      limit: 2
    })

    expect(continued).toMatchObject({
      ok: true,
      messages: [{ id: 'after', blocks: [{ type: 'text', text: 'after oversized' }] }],
      limited: false
    })
  })
})
