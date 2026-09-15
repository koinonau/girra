import { describe, expect, it } from 'vitest'
import { projectStructuredItemToNativeChat } from '../../../shared/structured-agent-session-projection'
import { unhandledProviderFrameJournalItem } from './unhandled-provider-frame'

describe('unhandled provider frame journal fallback', () => {
  it('keeps a compact label and bounds the expandable payload without dropping it', () => {
    const item = unhandledProviderFrameJournalItem(
      'future-provider',
      'notification:new/event',
      { body: 'abcdefghij' },
      { inlineHeadBytes: 8 }
    )

    expect(item).not.toBeNull()
    if (!item) {
      throw new Error('expected substantive provider frame')
    }
    expect(item.body).toMatchObject({
      kind: 'status',
      text: 'future-provider · notification:new/event',
      providerFrame: {
        provider: 'future-provider',
        kind: 'notification:new/event',
        payload: { byteLength: 21, truncated: true }
      }
    })
    expect(
      Buffer.byteLength(item.body.providerFrame?.payload.head ?? '', 'utf8')
    ).toBeLessThanOrEqual(8)
  })

  it('turns an unserializable message-shaped payload into an explicit visible value', () => {
    const cyclic: { warning?: unknown } = {}
    cyclic.warning = cyclic

    const item = unhandledProviderFrameJournalItem('claude', 'frame', cyclic)

    expect(item?.body.text).toBe('claude · frame')
    expect(item?.body.providerFrame?.payload.head).toContain('unserializable payload')
  })

  it('routes provider lifecycle, startup, and status frames away from the timeline', () => {
    expect(unhandledProviderFrameJournalItem('claude', 'message:system:init', {})).toBeNull()
    expect(
      unhandledProviderFrameJournalItem('claude', 'message:result', {
        subtype: 'success',
        is_error: false
      })
    ).toBeNull()
  })

  it('never creates generic rows for delta-shaped frames that report no failure', () => {
    expect(
      unhandledProviderFrameJournalItem('future-provider', 'notification:item/future/outputDelta', {
        itemId: 'future-1',
        delta: 'y'
      })
    ).toBeNull()
  })

  it('surfaces an unknown delta-shaped frame whose payload reports an error', () => {
    const row = unhandledProviderFrameJournalItem(
      'future-provider',
      'notification:item/future/outputDelta',
      { error: 'stream broke mid-item' }
    )

    expect(row).not.toBeNull()
    expect(row?.classification).toBe('error-surface')
    expect(row?.body.providerFrame).toMatchObject({
      provider: 'future-provider',
      kind: 'notification:item/future/outputDelta'
    })
  })

  it('renders systemError and Claude error result variants', () => {
    const system = unhandledProviderFrameJournalItem('future-provider', 'notification:status', {
      status: { type: 'systemError' }
    })
    const claude = unhandledProviderFrameJournalItem('claude', 'message:result', {
      subtype: 'error_during_execution',
      is_error: true,
      result: 'Provider request failed'
    })

    expect(system?.classification).toBe('error-surface')
    expect(claude?.body.providerFrame).toMatchObject({
      provider: 'claude',
      kind: 'message:result'
    })
    expect(
      claude
        ? projectStructuredItemToNativeChat({
            itemId: 'claude-error',
            revision: 1,
            sequence: 1,
            observedAt: 1,
            body: claude.body
          })
        : null
    ).toMatchObject({
      role: 'system',
      blocks: [
        expect.objectContaining({
          providerFrame: expect.objectContaining({ kind: 'message:result' })
        })
      ]
    })
  })

  it('keeps unknown substantive frames visible', () => {
    expect(unhandledProviderFrameJournalItem('claude', 'message:future/event', {})).not.toBeNull()
  })

  it('leads with the provider sentence instead of naming the opcode', () => {
    const row = unhandledProviderFrameJournalItem('future-provider', 'notification:warning', {
      message: 'Your plan limit resets in 2 hours.'
    })
    expect(row?.body.text).toBe('Your plan limit resets in 2 hours.')
    // The raw frame stays available behind the row's disclosure.
    expect(row?.body.providerFrame?.kind).toBe('notification:warning')
  })

  it('bounds a provider sentence inline', () => {
    const message = 'abcdefghij'
    const row = unhandledProviderFrameJournalItem(
      'future-provider',
      'notification:warning',
      { message },
      { inlineHeadBytes: 8 }
    )

    expect(row?.body.text).toContain('abcdefgh')
    expect(row?.body.text).toContain('[Orca: output truncated')
  })

  it('unwraps a nested sentence and falls back to the opcode when there is none', () => {
    expect(
      unhandledProviderFrameJournalItem('future-provider', 'notification:warning', {
        warning: { text: 'Sandbox is degraded.' }
      })?.body.text
    ).toBe('Sandbox is degraded.')
    expect(
      unhandledProviderFrameJournalItem('future-provider', 'notification:future/event', {
        count: 3
      })?.body.text
    ).toBe('future-provider \u00b7 notification:future/event')
  })
})

describe('a failed provider dependency', () => {
  it('leads with the failure the provider reported, not the method name', () => {
    const item = unhandledProviderFrameJournalItem(
      'future-provider',
      'notification:mcpServer/startupStatus/updated',
      {
        name: 'filesystem',
        status: 'failed',
        error: 'MCP client for `filesystem` failed to start: authentication token invalidated',
        failureReason: 'reauthenticationRequired'
      }
    )
    expect(item?.classification).toBe('error-surface')
    expect(item?.body.text).toContain('failed to start')
    expect(item?.body.text).not.toContain('notification:mcpServer')
  })
})

describe('typed notice metadata', () => {
  it('assigns the error tone and readable text to a failed frame', () => {
    expect(
      unhandledProviderFrameJournalItem('future-provider', 'notification:error', {
        error: { message: 'Connection failed' }
      })
    ).toMatchObject({
      classification: 'error-surface',
      body: { kind: 'status', text: 'Connection failed', tone: 'error' }
    })
  })
})
