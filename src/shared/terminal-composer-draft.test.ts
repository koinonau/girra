import { describe, expect, it } from 'vitest'
import {
  detectTerminalComposerDraft,
  hasTerminalComposerPlaceholder
} from './terminal-composer-draft'

describe('detectTerminalComposerDraft', () => {
  it('separates a cursor-right suggestion from the composer line', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ proceed with the release'],
        typedRows: ['────────', '❯'],
        rowsBelow: [],
        typedRowsBelow: [],
        beforeCursor: '❯ ',
        afterCursor: '',
        rawAfterCursor: 'proceed with the release',
        cursorHidden: false,
        cursorViewportRow: 8
      })
    ).toEqual({
      text: 'proceed with the release',
      promptRow: 8,
      cursorRow: 8,
      endRow: 8,
      promptGlyph: '❯'
    })
  })

  it('keeps stock dim placeholders out of draft metadata', () => {
    const context = {
      rows: ['────────', '❯ Try "refactor the parser"'],
      typedRows: ['────────', '❯'],
      rowsBelow: [],
      typedRowsBelow: [],
      beforeCursor: '❯ ',
      afterCursor: '',
      rawAfterCursor: 'Try "refactor the parser"',
      cursorHidden: false,
      cursorViewportRow: 4
    }

    expect(detectTerminalComposerDraft(context)).toBeNull()
    expect(hasTerminalComposerPlaceholder(context)).toBe(true)
  })

  it('keeps a typed draft whose stock placeholder is still rendered to its right', () => {
    // The placeholder normally clears the moment you type, but a repaint can land the two on the
    // row together. Classifying that as a placeholder would mask the row the user's text is on.
    const context = {
      rows: ['────────', '❯ \uc548\ub155Try "refactor the parser"'],
      typedRows: ['────────', '❯ \uc548\ub155'],
      rowsBelow: [],
      typedRowsBelow: [],
      beforeCursor: '❯ \uc548\ub155',
      afterCursor: '',
      rawAfterCursor: 'Try "refactor the parser"',
      cursorHidden: false,
      cursorViewportRow: 4
    }

    expect(detectTerminalComposerDraft(context)).toEqual({
      text: '\uc548\ub155',
      promptRow: 4,
      cursorRow: 4,
      endRow: 4,
      promptGlyph: '❯'
    })
    expect(hasTerminalComposerPlaceholder(context)).toBe(false)
  })

  it('does not duplicate real typed text left of the cursor', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ review the change'],
        typedRows: ['────────', '❯ review the change'],
        rowsBelow: [],
        typedRowsBelow: [],
        beforeCursor: '❯ review the change',
        afterCursor: '',
        rawAfterCursor: '',
        cursorHidden: false,
        cursorViewportRow: 2
      })?.text
    ).toBe('review the change')
  })

  it('preserves a shell prompt that happens to use the Claude glyph', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['last command output', '❯ git status'],
        typedRows: ['last command output', '❯ git status'],
        rowsBelow: [],
        typedRowsBelow: [],
        beforeCursor: '❯ git status',
        afterCursor: '',
        rawAfterCursor: '',
        cursorHidden: false,
        cursorViewportRow: 7
      })
    ).toBeNull()
  })

  it('rejects a hidden-cursor dialog even when its selected row uses a composer glyph', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ 1. Yes, continue', '  Press enter to continue'],
        typedRows: ['────────', '❯ 1. Yes, continue', '  Press enter to continue'],
        rowsBelow: [],
        typedRowsBelow: [],
        beforeCursor: '  Press enter to continue',
        afterCursor: '',
        rawAfterCursor: '',
        cursorHidden: true,
        cursorViewportRow: 5
      })
    ).toBeNull()
  })

  it('separates dimmed suggestion rows below the restored cursor', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ proceed with the release'],
        typedRows: ['────────', '❯'],
        rowsBelow: ['  and close the pull request', '────────'],
        typedRowsBelow: ['', '────────'],
        beforeCursor: '❯ ',
        afterCursor: '',
        rawAfterCursor: 'proceed with the release',
        cursorHidden: false,
        cursorViewportRow: 8
      })
    ).toEqual({
      text: 'proceed with the release\nand close the pull request',
      promptRow: 8,
      cursorRow: 8,
      endRow: 9,
      promptGlyph: '❯'
    })
  })

  it('preserves an ordinary shell prompt that starts with a chevron glyph', () => {
    const context = {
      rows: ['last command output', '› git status'],
      typedRows: ['last command output', '› git status'],
      rowsBelow: [],
      typedRowsBelow: [],
      beforeCursor: '› git status',
      afterCursor: '',
      rawAfterCursor: '',
      cursorHidden: false,
      cursorViewportRow: 7
    }

    expect(detectTerminalComposerDraft(context)).toBeNull()
    expect(hasTerminalComposerPlaceholder(context)).toBe(false)
  })

  it('keeps the side-thread placeholder out of draft metadata', () => {
    const context = {
      rows: ['────────', '❯ Ask a follow-up question'],
      typedRows: ['────────', '❯'],
      rowsBelow: [],
      typedRowsBelow: [],
      beforeCursor: '❯ ',
      afterCursor: '',
      rawAfterCursor: 'Ask a follow-up question',
      cursorHidden: false,
      cursorViewportRow: 4
    }

    expect(detectTerminalComposerDraft(context)).toBeNull()
    expect(hasTerminalComposerPlaceholder(context)).toBe(true)
  })

  it('keeps a wrapped stock placeholder out of draft metadata', () => {
    const context = {
      rows: ['────────', '❯ Try "refactor the'],
      typedRows: ['────────', '❯'],
      rowsBelow: ['  parser"'],
      typedRowsBelow: [''],
      beforeCursor: '❯ ',
      afterCursor: '',
      rawAfterCursor: 'Try "refactor the',
      cursorHidden: false,
      cursorViewportRow: 4
    }

    expect(detectTerminalComposerDraft(context)).toBeNull()
    expect(hasTerminalComposerPlaceholder(context)).toBe(true)
  })

  it('joins soft-wrapped continuation rows without inserting a newline', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ proceed with the'],
        typedRows: ['────────', '❯'],
        rowsWrapped: [false, false],
        rowsBelow: ['release'],
        typedRowsBelow: [''],
        rowsBelowWrapped: [true],
        beforeCursor: '❯ ',
        afterCursor: '',
        rawAfterCursor: 'proceed with the ',
        cursorHidden: false,
        cursorViewportRow: 8
      })?.text
    ).toBe('proceed with the release')
  })

  it('keeps a draft continuation containing a middle dot', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ proceed '],
        typedRows: ['────────', '❯'],
        rowsWrapped: [false, false],
        rowsBelow: ['deploy · verify', '────────'],
        typedRowsBelow: ['', '────────'],
        rowsBelowWrapped: [true, false],
        beforeCursor: '❯ ',
        afterCursor: 'proceed ',
        rawAfterCursor: 'proceed ',
        cursorHidden: false,
        cursorViewportRow: 8
      })?.text
    ).toBe('proceed deploy · verify')
  })

  it('keeps typed soft-wrapped rows below a restored cursor in the draft', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ proceed with the '],
        typedRows: ['────────', '❯ proceed with the '],
        rowsWrapped: [false, false],
        rowsBelow: ['release'],
        typedRowsBelow: ['release'],
        rowsBelowWrapped: [true],
        beforeCursor: '❯ proceed',
        afterCursor: ' with the ',
        rawAfterCursor: ' with the ',
        cursorHidden: false,
        cursorViewportRow: 8
      })?.text
    ).toBe('proceed with the release')
  })

  it('keeps typed hard-newline rows below a restored cursor in the draft', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ first line'],
        typedRows: ['────────', '❯ first line'],
        rowsWrapped: [false, false],
        rowsBelow: ['  second line', '────────'],
        typedRowsBelow: ['  second line', '────────'],
        rowsBelowWrapped: [false, false],
        beforeCursor: '❯ first',
        afterCursor: ' line',
        rawAfterCursor: ' line',
        cursorHidden: false,
        cursorViewportRow: 8
      })?.text
    ).toBe('first line\nsecond line')
  })

  it('keeps typed continuation rows after an intentional blank draft line', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ first line'],
        typedRows: ['────────', '❯ first line'],
        rowsWrapped: [false, false],
        rowsBelow: ['', '  second line', '────────'],
        typedRowsBelow: ['', '  second line', '────────'],
        rowsBelowWrapped: [false, false, false],
        beforeCursor: '❯ first',
        afterCursor: ' line',
        rawAfterCursor: ' line',
        cursorHidden: false,
        cursorViewportRow: 8
      })
    ).toMatchObject({ text: 'first line\n\nsecond line', endRow: 10 })
  })

  it('stops before a blank row that only precedes the composer frame', () => {
    expect(
      detectTerminalComposerDraft({
        rows: ['────────', '❯ first line'],
        typedRows: ['────────', '❯ first line'],
        rowsBelow: ['', '────────'],
        typedRowsBelow: ['', '────────'],
        beforeCursor: '❯ first line',
        afterCursor: '',
        rawAfterCursor: '',
        cursorHidden: false,
        cursorViewportRow: 8
      })
    ).toMatchObject({ text: 'first line', endRow: 8 })
  })
})
