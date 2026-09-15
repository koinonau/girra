// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { installTerminalImeCandidateAnchor } from './terminal-ime-candidate-anchor'

const COLS = 80
const ROWS = 24
const CELL_WIDTH = 8
const CELL_HEIGHT = 17

type AnchorHarness = {
  terminal: Terminal
  element: HTMLElement
  style: { top: string; left: string; width: string }
  counts: { rectReads: number; styleWrites: number }
  setCursor: (cursorX: number, cursorY: number) => void
}

function createHarness(): AnchorHarness {
  const counts = { rectReads: 0, styleWrites: 0 }
  const element = document.createElement('div')
  const screen = document.createElement('div')
  screen.className = 'xterm-screen'
  element.appendChild(screen)
  document.body.appendChild(element)

  screen.getBoundingClientRect = (): DOMRect => {
    counts.rectReads++
    return { width: COLS * CELL_WIDTH, height: ROWS * CELL_HEIGHT } as DOMRect
  }

  // `width` is xterm's, not ours: it sizes the textarea to the preedit just before this
  // listener runs, and the clamp reads it back to keep that box inside the screen.
  const style = { top: '', left: '', width: '' }
  const textarea = {
    isConnected: true,
    style: new Proxy(style, {
      set(target, key: string, value: string) {
        counts.styleWrites++
        target[key as 'top' | 'left' | 'width'] = value
        return true
      }
    })
  } as unknown as HTMLTextAreaElement

  const buffer = { cursorX: 0, cursorY: 0 }

  const terminal = {
    element,
    textarea,
    cols: COLS,
    rows: ROWS,
    buffer: { active: buffer }
  } as unknown as Terminal

  return {
    terminal,
    element,
    style,
    counts,
    setCursor: (cursorX: number, cursorY: number) => {
      Object.assign(buffer, { cursorX, cursorY })
    }
  }
}

function fire(element: HTMLElement, type: string): void {
  element.dispatchEvent(new Event(type))
}

/** One Hangul syllable: xterm sees compositionstart then one update per jamo. */
function typeHangulSyllable(
  harness: AnchorHarness,
  cursorX: number,
  updates = 3,
  cursorY = 0
): void {
  harness.setCursor(cursorX, cursorY)
  fire(harness.element, 'compositionstart')
  for (let update = 0; update < updates; update++) {
    fire(harness.element, 'compositionupdate')
  }
}

describe('installTerminalImeCandidateAnchor', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null before the terminal has opened its DOM', () => {
    expect(installTerminalImeCandidateAnchor({ element: null } as unknown as Terminal)).toBeNull()
  })

  it('keeps forced layout at one read per composition across a Hangul burst', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)

    for (let syllable = 0; syllable < 30; syllable++) {
      typeHangulSyllable(harness, syllable)
    }

    // 30 compositions x 4 events: reads collapse to one per composition, and the
    // 90 updates re-write nothing because the anchor is already on the textarea.
    expect(harness.counts.rectReads).toBe(30)
    expect(harness.counts.styleWrites).toBe(31)
    expect(harness.style.left).toBe(`${29 * CELL_WIDTH}px`)
  })

  it('pulls an over-wide preedit anchor back inside the terminal at the last column', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)
    // xterm sized the textarea to a two-cell preedit that starts in the final column.
    harness.style.width = `${2 * CELL_WIDTH}px`

    typeHangulSyllable(harness, COLS - 1)

    // Without the clamp this is 79 cells, putting the OS candidate window one cell past the
    // right edge while xterm end-aligns the visible preedit back inside.
    expect(harness.style.left).toBe(`${(COLS - 2) * CELL_WIDTH}px`)
  })

  it('never anchors left of the terminal when the preedit outgrows the whole row', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)
    // A long pinyin phrase in a narrow pane: the preedit is wider than every column together.
    harness.style.width = `${(COLS + 12) * CELL_WIDTH}px`

    typeHangulSyllable(harness, COLS - 1)

    expect(harness.style.left).toBe('0px')
  })

  it('leaves the anchor on the cursor cell while the preedit still fits', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)
    harness.style.width = `${2 * CELL_WIDTH}px`

    typeHangulSyllable(harness, 40)

    expect(harness.style.left).toBe(`${40 * CELL_WIDTH}px`)
  })

  it('does no work for Latin input, which fires no composition events', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)

    fire(harness.element, 'keydown')
    fire(harness.element, 'input')

    expect(harness.counts).toEqual({ rectReads: 0, styleWrites: 0 })
  })

  it('re-corrects the anchor mid-composition after xterm rewrites the textarea', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)
    harness.setCursor(4, 2)
    fire(harness.element, 'compositionstart')

    // xterm's own compositionupdate handler repositions from its uncorrected
    // cursor; long CJK compositions depend on us winning that back.
    harness.style.top = '0px'
    harness.setCursor(6, 2)
    fire(harness.element, 'compositionupdate')

    expect(harness.style).toEqual({
      top: `${2 * CELL_HEIGHT}px`,
      left: `${6 * CELL_WIDTH}px`,
      width: ''
    })
  })

  it('re-measures mid-composition when the terminal is refit to new dimensions', () => {
    const harness = createHarness()
    installTerminalImeCandidateAnchor(harness.terminal)
    fire(harness.element, 'compositionstart')
    expect(harness.counts.rectReads).toBe(1)

    Object.assign(harness.terminal, { cols: 40 })
    fire(harness.element, 'compositionupdate')

    expect(harness.counts.rectReads).toBe(2)
  })
})
