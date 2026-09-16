import { describe, expect, it } from 'vitest'

import { clearWorkingIndicators, detectAgentStatusFromTitle } from './agent-detection'
import {
  clearPiStateWorkingMarker,
  getPiStateTitleStatus,
  PI_STATE_MARKERS
} from './pi-state-title-marker'

// Why: Pi-compatible TUIs use static markers instead of braille frames on WSL/ConPTY (#13890).
describe('Pi native state-title markers', () => {
  it.each([
    // bare marker titles
    ['π : my-project', 'working'],
    ['π > my-project', 'idle'],
    ['π ! my-project', 'permission'],
    // wrapper-prefixed titles — multiplexers own the head of the string
    ['zsh | π : my-project', 'working'],
    ['zsh | tmux | π > my-project', 'idle'],
    ['zsh | π ! my-project', 'permission'],
    ['tmux: π : my-project', 'working'],
    // the label is opaque: it legally carries the wrapper separator and more markers
    ['π > release | π : note | π ! note', 'idle'],
    ['zsh | π : release | π > note', 'working'],
    // ...and glyphs another agent uses for status
    ['π > session ✦ ⏲ ◇ ✋', 'idle'],
    ['π : session ✦ ⏲ ◇ ✋', 'working'],
    // no label at all
    ['π :', 'working'],
    ['π >', 'idle']
  ] as const)('classifies %j as %s', (title, expected) => {
    expect(getPiStateTitleStatus(title)).toBe(expected)
    expect(detectAgentStatusFromTitle(title)).toBe(expected)
  })

  it.each([
    // Why: the legacy no-space form is a disabled title, not a working marker; it stays idle.
    ['π: my-project', 'idle'],
    ['π - my-project', 'idle'],
    ['⠋ π - my-project', 'working']
  ] as const)('leaves the legacy title %j on its historical path (%s)', (title, expected) => {
    expect(getPiStateTitleStatus(title)).toBeNull()
    expect(detectAgentStatusFromTitle(title)).toBe(expected)
  })

  it.each(['πx : glued', 'not-a-marker', ''])(
    'claims no marker in %j so other detectors stay authoritative',
    (title) => {
      expect(getPiStateTitleStatus(title)).toBeNull()
    }
  )

  // Why: an unrecognized marker means a protocol Girra has not been taught yet. Claiming a
  // status from it would repeat this bug in the other direction, so the parser abstains
  // and the pre-existing Pi gates decide.
  it('abstains on a marker the table does not define', () => {
    expect(PI_STATE_MARKERS).not.toContain('~')
    expect(getPiStateTitleStatus('π ~ my-project')).toBeNull()
  })

  describe('stale working-title clear', () => {
    it.each([
      ['π : my-project', 'π > my-project'],
      ['zsh | π : release | π : note', 'zsh | π > release | π : note']
    ] as const)('rewrites %j to an idle marker', (title, expected) => {
      expect(clearPiStateWorkingMarker(title)).toBe(expected)
      // The 3s stale-title fallback re-detects what it wrote; it must not still be working.
      expect(clearWorkingIndicators(title)).toBe(expected)
      expect(detectAgentStatusFromTitle(clearWorkingIndicators(title))).toBe('idle')
    })

    it.each(['π > my-project', 'π ! my-project', '⠋ Pi'])(
      'leaves %j to the other strip passes',
      (title) => {
        expect(clearPiStateWorkingMarker(title)).toBeNull()
      }
    )
  })

  // Why: the table is the single source of truth. A new marker added there must reach
  // detection without editing this file, or the two drift the way they did in #13890.
  it('routes every table marker through title detection', () => {
    for (const marker of PI_STATE_MARKERS) {
      const status = getPiStateTitleStatus(`π ${marker} my-project`)
      expect(status).not.toBeNull()
      expect(detectAgentStatusFromTitle(`π ${marker} my-project`)).toBe(status)
      expect(detectAgentStatusFromTitle(`zsh | π ${marker} my-project`)).toBe(status)
    }
  })
})
