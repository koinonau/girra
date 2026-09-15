import { describe, expect, it } from 'vitest'
import { resolvePaneDisplayTitle, resolvePaneTitleDecision } from './terminal-title-evidence'

describe('resolvePaneDisplayTitle', () => {
  it('passes an unowned title through unchanged', () => {
    expect(resolvePaneDisplayTitle('bash', undefined)).toBe('bash')
  })
})

describe('resolvePaneTitleDecision', () => {
  it('derives the display label and keeps the raw title and GPU gate', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: 'bash',
      rawTitle: 'bash',
      displayOwnerAgentType: undefined,
      userGpuMode: 'auto'
    })
    expect(decision).toEqual({
      displayTitle: 'bash',
      rawTitle: 'bash',
      rendererPolicy: { gpuEnabled: true, reason: 'capability' }
    })
  })
})
