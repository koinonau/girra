import { describe, expect, it } from 'vitest'
import { claudeProviderFrameActivity } from './provider-frame-activity'

describe('provider frame activity', () => {
  it('leaves the Claude line on the generic fallback, since Claude never narrates its turn', () => {
    // Prose on these frames belongs to a spawned task, not to this turn.
    for (const [kind, payload] of [
      ['message:system:task_started', { description: 'Trace the activity channel' }],
      ['message:system:task_progress', { summary: 'Checking remote compatibility' }],
      ['message:system:task_updated', { patch: { description: 'Validating the renderer' } }],
      ['message:system:control_request_progress', { status: 'api_retry' }],
      ['message:tool_progress', { tool_name: 'ReadSecretFile' }]
    ] as const) {
      expect(claudeProviderFrameActivity(kind, payload)).toBeNull()
    }
    // `requesting` holds for nearly the whole turn and says no more than the fallback.
    expect(
      claudeProviderFrameActivity('message:system:status', { status: 'requesting' })
    ).toBeNull()
    expect(claudeProviderFrameActivity('message:system:status', { status: 'compacting' })).toBe(
      'Compacting the conversation'
    )
    // An unmodeled frame still declines to answer, so it cannot clear live copy.
    expect(claudeProviderFrameActivity('message:system:unknown_frame', {})).toBeUndefined()
  })
})
