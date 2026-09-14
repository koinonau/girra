import { afterEach, describe, expect, it } from 'vitest'
import { shouldRecoverRendererAfterProcessGone } from './process-gone-classification'
import {
  isSystemSessionEnding,
  markSystemSessionEnding,
  resetExpectedTeardownStateForTest,
  resolveExpectedTeardownScope
} from './expected-teardown-state'

afterEach(() => {
  resetExpectedTeardownStateForTest()
})

describe('expected teardown state', () => {
  it('latches session-end', () => {
    expect(isSystemSessionEnding()).toBe(false)
    markSystemSessionEnding()
    expect(isSystemSessionEnding()).toBe(true)
  })

  it('excludes session-end from recovery while preserving in-app quit suppression', () => {
    markSystemSessionEnding()
    const sessionEndScope = resolveExpectedTeardownScope({
      isQuitting: false,
      isExpectedRendererReload: false
    })
    const inAppQuitScope = resolveExpectedTeardownScope({
      isQuitting: true,
      isExpectedRendererReload: false
    })

    expect(sessionEndScope).toBe('none')
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'killed',
        expectedTeardown: sessionEndScope
      })
    ).toBe(true)
    expect(inAppQuitScope).toBe('app-shutdown')
    expect(
      shouldRecoverRendererAfterProcessGone({
        reason: 'killed',
        expectedTeardown: inAppQuitScope
      })
    ).toBe(false)
  })

  it('preserves the renderer-reload scope', () => {
    expect(
      resolveExpectedTeardownScope({
        isQuitting: false,
        isExpectedRendererReload: true
      })
    ).toBe('renderer-reload')
  })
})
