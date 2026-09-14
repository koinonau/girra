import { describe, expect, it } from 'vitest'
import { shouldRecoverRendererAfterProcessGone } from './process-gone-classification'

describe('shouldRecoverRendererAfterProcessGone', () => {
  it('recovers unexpected killed renderers', () => {
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'killed',
        expectedTeardown: 'none'
      })
    ).toBe(true)
  })

  it('does not recover expected renderer reload teardown', () => {
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'killed',
        expectedTeardown: 'renderer-reload'
      })
    ).toBe(false)
  })

  it('recovers real renderer crashes during renderer reload windows', () => {
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'oom',
        expectedTeardown: 'renderer-reload'
      })
    ).toBe(true)
  })

  it('does not recover during app shutdown', () => {
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'crashed',
        expectedTeardown: 'app-shutdown'
      })
    ).toBe(false)
  })

  it('recovers transient renderer launch failures', () => {
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'launch-failed',
        expectedTeardown: 'none'
      })
    ).toBe(true)
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'launch-failed',
        expectedTeardown: 'renderer-reload'
      })
    ).toBe(true)
  })

  it('does not recover renderer integrity failures', () => {
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'integrity-failure',
        expectedTeardown: 'none'
      })
    ).toBe(false)
  })
})
