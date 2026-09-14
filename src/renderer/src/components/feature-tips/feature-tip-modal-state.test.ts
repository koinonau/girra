import { describe, expect, it } from 'vitest'
import { getFeatureTipForModal } from './feature-tip-modal-state'

describe('feature tip modal state', () => {
  it('keeps rendering the opened tip after app open has marked it seen', () => {
    const tip = getFeatureTipForModal({
      cliInstalled: false,
      modalData: { tipId: 'orca-cli' },
      seenTipIds: ['orca-cli'],
      featureInteractions: {}
    })

    expect(tip?.id).toBe('orca-cli')
  })

  it('falls back to the CLI tip first when no modal tip id is pinned', () => {
    const tip = getFeatureTipForModal({
      cliInstalled: false,
      modalData: {},
      seenTipIds: [],
      featureInteractions: {}
    })

    expect(tip?.id).toBe('orca-cli')
  })

  it('falls back to the command palette tip after the CLI tip is handled', () => {
    const tip = getFeatureTipForModal({
      cliInstalled: true,
      modalData: {},
      seenTipIds: ['orca-cli'],
      featureInteractions: {}
    })

    expect(tip?.id).toBe('cmd-j-palette')
  })

  it('returns no tip when every tip is already seen and no modal tip id is pinned', () => {
    const tip = getFeatureTipForModal({
      cliInstalled: false,
      modalData: {},
      seenTipIds: ['orca-cli', 'cmd-j-palette'],
      featureInteractions: {}
    })

    expect(tip).toBeNull()
  })

  it('returns no CLI tip when the CLI is already installed', () => {
    const tip = getFeatureTipForModal({
      cliInstalled: true,
      modalData: {},
      seenTipIds: ['cmd-j-palette'],
      featureInteractions: {}
    })

    expect(tip).toBeNull()
  })

  it('does not complete a tip from an unrelated feature interaction', () => {
    const tip = getFeatureTipForModal({
      cliInstalled: true,
      modalData: {},
      seenTipIds: [],
      featureInteractions: {
        'cmd-j': { firstInteractedAt: 100, interactionCount: 1 }
      }
    })

    expect(tip?.id).toBe('cmd-j-palette')
  })
})
