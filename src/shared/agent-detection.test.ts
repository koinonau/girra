import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  detectAgentStatusFromTitle,
  extractAllOscTitles,
  extractLastOscTitle,
  getAgentLabel,
  MAX_OSC_TITLE_CHARS,
  MAX_OSC_TITLES_PER_CHUNK,
  normalizeTerminalTitle
} from './agent-detection'
import {
  hasCompatibleAgentTitleIdentity,
  normalizeCompatibleAgentTitleForOwner,
  resolveCompatibleAgentTypeForOwner
} from './agent-title-owner'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OSC title extraction', () => {
  it('extracts the last OSC title from BEL-terminated PTY data', () => {
    expect(extractLastOscTitle('\x1b]0;First\x07noise\x1b]2;Second\x07')).toBe('Second')
  })

  it('extracts all OSC titles including ST-terminated titles', () => {
    expect(extractAllOscTitles('\x1b]0;First\x1b\\noise\x1b]2;Second\x07')).toEqual([
      'First',
      'Second'
    ])
  })

  it('ignores incomplete OSC titles until a later chunk supplies the terminator', () => {
    expect(extractAllOscTitles('\x1b]0;Incomplete title')).toEqual([])
    expect(extractLastOscTitle('\x1b]0;Incomplete title')).toBeNull()
  })

  it('recovers when an abandoned incomplete OSC title is followed by a fresh title', () => {
    const data = '\x1b]0;abandoned\x1b]0;Fresh title\x07'

    expect(extractLastOscTitle(data)).toBe('Fresh title')
    expect(extractAllOscTitles(data)).toEqual(['Fresh title'])
  })

  it('scans large PTY chunks without regex match iteration', () => {
    const matchAll = vi.spyOn(String.prototype, 'matchAll')
    const data = `${'pasted terminal noise \x1b]x;ignored\x07 '.repeat(10_000)}\x1b]0;Agent working\x07`

    expect(extractLastOscTitle(data)).toBe('Agent working')
    expect(extractAllOscTitles(data).at(-1)).toBe('Agent working')
    expect(matchAll).not.toHaveBeenCalled()
  })

  it('caps oversized OSC titles before downstream title processing', () => {
    const title = `${'a'.repeat(MAX_OSC_TITLE_CHARS)}${'b'.repeat(10_000)}`
    const data = `before\x1b]0;${title}\x07after`

    const extracted = extractLastOscTitle(data)

    expect(extracted).toHaveLength(MAX_OSC_TITLE_CHARS)
    expect(extracted?.startsWith('a'.repeat(MAX_OSC_TITLE_CHARS / 2))).toBe(true)
    expect(extracted?.endsWith('b'.repeat(MAX_OSC_TITLE_CHARS / 2))).toBe(true)
    expect(extractAllOscTitles(data)).toEqual([extracted])
  })

  it('retains only the newest titles when one chunk contains limit +1', () => {
    const data = Array.from(
      { length: MAX_OSC_TITLES_PER_CHUNK + 1 },
      (_, index) => `\x1b]0;title-${index}\x07`
    ).join('')

    const titles = extractAllOscTitles(data)

    expect(titles).toHaveLength(MAX_OSC_TITLES_PER_CHUNK)
    expect(titles[0]).toBe('title-1')
    expect(titles.at(-1)).toBe(`title-${MAX_OSC_TITLES_PER_CHUNK}`)
  })
})

describe('OpenCode native title detection', () => {
  // Why: `OC | …` names no agent token, so title-derived display and target surfaces
  // previously dropped OpenCode panes. Runtime sends corroborate the title separately.
  it.each(['OC | Implement the Kitty IME preview', 'tmux | OC | Implement the Kitty IME preview'])(
    'classifies the native session title %j as title-derived idle OpenCode',
    (title) => {
      expect(getAgentLabel(title)).toBe('OpenCode')
      expect(detectAgentStatusFromTitle(title)).toBe('idle')
    }
  )

  // Why: a spinner glyph is the one status decoration OpenCode adds to the marker, and
  // its gate runs before the marker's, so an animating frame still reads working (#8940).
  it('reads a spinner-decorated native frame as working', () => {
    const title = 'OC | ⠋ ask claude about this'
    expect(getAgentLabel(title)).toBe('OpenCode')
    expect(detectAgentStatusFromTitle(title)).toBe('working')
  })

  // Why: the text after the marker is OpenCode's generated session summary — subject
  // matter, not status. Routing it through the keyword gates would let an ordinary task
  // name ("stop the flaky test") park a live pane in working/permission forever, so the
  // marker asserts presence only. Do not "fix" these into keyword-derived statuses.
  it.each([
    'OC | ready to review',
    'OC | permission prompt keeps reappearing',
    'OC | waiting on the flaky test',
    'OC | stop the suite from running'
  ])('keeps the status word inside the session summary %j inert', (title) => {
    expect(getAgentLabel(title)).toBe('OpenCode')
    expect(detectAgentStatusFromTitle(title)).toBe('idle')
  })

  it.each(['OC |', 'OC|Build', 'oc | lowercase lookalike', 'OCTOPUS | build'])(
    'does not treat the lookalike title %j as an agent',
    (title) => {
      expect(detectAgentStatusFromTitle(title)).toBeNull()
    }
  )
})

describe('Pi-compatible title detection', () => {
  it.each([
    ['\u280b Pi', 'Pi', 'working'],
    ['Pi ready', 'Pi', 'idle'],
    // Why: titles stored by the old collapse are still bare "Pi"; re-detection
    // from stored lastOscTitle must still classify idle, not neutral.
    ['Pi', 'Pi', 'idle'],
    ['Pi - action required', 'Pi', 'permission']
  ] as const)('classifies synthesized %s', (title, expectedLabel, expectedStatus) => {
    expect(getAgentLabel(title)).toBe(expectedLabel)
    expect(detectAgentStatusFromTitle(title)).toBe(expectedStatus)
  })

  // Why: static state markers on WSL/ConPTY (#13890). The label after the marker is
  // cwd/session text, so glyphs another agent used for status must not win.
  it.each([
    ['π : my-project', 'working', 'π : my-project'],
    ['π > my-project', 'idle', 'π > my-project'],
    ['π ! my-project', 'permission', 'π ! my-project'],
    ['π > gemini ✦ ⏲ ◇ ✋', 'idle', 'π > gemini ✦ ⏲ ◇ ✋'],
    ['zsh | π : my-project', 'working', 'zsh | π : my-project'],
    ['zsh | π > gemini ✦ ⏲ ◇ ✋', 'idle', 'zsh | π > gemini ✦ ⏲ ◇ ✋']
  ] as const)(
    'classifies native state-marker title %j as %s',
    (title, expectedStatus, expectedDisplay) => {
      expect(detectAgentStatusFromTitle(title)).toBe(expectedStatus)
      expect(normalizeTerminalTitle(title)).toBe(expectedDisplay)
    }
  )

  it('re-detects status after display-title normalization for Pi idle frames', () => {
    // Normalization now preserves the session name and cwd (#16093).
    expect(normalizeTerminalTitle('π - my-project')).toBe('π - my-project')
    expect(detectAgentStatusFromTitle(normalizeTerminalTitle('π - my-project'))).toBe('idle')
    expect(detectAgentStatusFromTitle(normalizeTerminalTitle('\u280b π - my-project'))).toBe(
      'working'
    )
  })

  it('identifies titles whose compatible identity can be re-owned', () => {
    expect(hasCompatibleAgentTitleIdentity('Pi ready')).toBe(true)
    expect(hasCompatibleAgentTitleIdentity('π - tmp')).toBe(true)
    expect(hasCompatibleAgentTitleIdentity('Fix pi bugs')).toBe(false)
    expect(hasCompatibleAgentTitleIdentity('\u280b Codex')).toBe(false)
  })

  it('leaves an owner outside the compatible group untouched', () => {
    expect(normalizeCompatibleAgentTitleForOwner('\u280b Pi', 'codex')).toBe('\u280b Pi')
    expect(resolveCompatibleAgentTypeForOwner('codex', 'pi')).toBe('codex')
  })

  it.each(['~/pi/working', 'pi-scratch ready'])(
    'does not classify path or hyphen false positive %s',
    (title) => {
      expect(getAgentLabel(title)).toBeNull()
      expect(detectAgentStatusFromTitle(title)).toBeNull()
    }
  )
})
