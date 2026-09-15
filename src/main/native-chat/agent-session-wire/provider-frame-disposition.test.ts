import { describe, expect, it } from 'vitest'
import { CLAUDE_STREAM_JSON_FRAME_KINDS } from './claude-stream-json-frame-schema'
import {
  classifyProviderFrame,
  isDeltaShapedProviderFrameKind,
  PROVIDER_FRAME_CLASSIFICATIONS
} from './provider-frame-disposition'

describe('provider frame classification catalog', () => {
  it('classifies every pinned Claude stream-json frame kind', () => {
    expect(Object.keys(PROVIDER_FRAME_CLASSIFICATIONS.claude)).toEqual([
      ...CLAUDE_STREAM_JSON_FRAME_KINDS
    ])
  })

  it('classifies every pinned delta kind as stream-into-item', () => {
    const deltaKinds = Object.keys(PROVIDER_FRAME_CLASSIFICATIONS.claude).filter(
      isDeltaShapedProviderFrameKind
    )

    expect(deltaKinds.length).toBeGreaterThan(0)
    for (const kind of deltaKinds) {
      expect(classifyProviderFrame('claude', kind, {}), kind).toBe('stream-into-item')
    }
  })

  it('suppresses benign hook lifecycle frames', () => {
    expect(classifyProviderFrame('claude', 'message:system:hook_started', {})).toBe(
      'suppressed-benign'
    )
  })

  it('promotes payload failures over a benign catalog classification', () => {
    expect(
      classifyProviderFrame('claude', 'message:system:hook_response', {
        outcome: 'error',
        stderr: 'hook failed'
      })
    ).toBe('error-surface')
  })

  it('keeps command queue bookkeeping off the transcript without hiding a failed one', () => {
    expect(
      classifyProviderFrame('claude', 'message:command_lifecycle', {
        command_uuid: 'command-1',
        state: 'started'
      })
    ).toBe('status-chrome')
    expect(
      classifyProviderFrame('claude', 'message:command_lifecycle', {
        command_uuid: 'command-1',
        state: 'cancelled'
      })
    ).toBe('status-chrome')
    // Payload inspection outranks the catalogue, so suppressing the kind cannot
    // swallow a state the provider reports as a failure.
    expect(
      classifyProviderFrame('claude', 'message:command_lifecycle', {
        command_uuid: 'command-1',
        state: 'failed'
      })
    ).toBe('error-surface')
  })

  it('keeps unknown future frames on the substantive bounded fallback path', () => {
    expect(classifyProviderFrame('claude', 'message:future_event', {})).toBe('timeline-substantive')
  })

  it('structurally diverts unknown future delta kinds from generic rows', () => {
    expect(classifyProviderFrame('claude', 'message:future_delta', {})).toBe('stream-into-item')
  })
})
