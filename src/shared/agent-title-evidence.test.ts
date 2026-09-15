import { describe, expect, it } from 'vitest'
import { collectAgentTitleEvidence } from './agent-title-evidence'

const agentFor = (title: string) => collectAgentTitleEvidence(title).agent
const reasonFor = (title: string) => collectAgentTitleEvidence(title).reason

describe('collectAgentTitleEvidence', () => {
  describe('an anchored name outranks a name in task text', () => {
    // Minimized from real recorded titles that resolve to the wrong agent on the ordered chain:
    // the pane owner is named by Orca's `- <agent>` suffix, the competitor only by task text.
    it.each([
      'Switch Claude and Codex off the load balancer… - opencode',
      'Codex structured chat revalidation… - opencode',
      '⠸ - Thinking - Codex native-chat work… - opencode',
      'Electron QA: check the Claude label… - opencode'
    ])('resolves %j to the suffix owner', (title) => {
      expect(agentFor(title)).toBe('opencode')
    })

    it('does not read a hyphenated worktree name as an owner suffix', () => {
      // `review-14600-codex` is a directory, not an owner declaration. The suffix grammar
      // requires whitespace before the dash precisely to keep these apart.
      expect(agentFor('review-14600-codex')).toBeNull()
      expect(agentFor('codex-split-core')).toBeNull()
    })

    it.each(['pi', 'claude-agent-teams'] as const)(
      'recognizes the reserved owner id %s',
      (agent) => {
        expect(agentFor(`Review another agent… - ${agent}`)).toBe(agent)
      }
    )
  })

  describe('order independence', () => {
    // The defect this replaces is that chain position decides between two names. Swapping the
    // two names in a title must not change the answer.
    it.each([
      ['codex', 'opencode'],
      ['claude', 'codex'],
      ['claude', 'opencode']
    ])('gives %s + %s the same answer in both orders', (a, b) => {
      const forward = collectAgentTitleEvidence(`${a} and ${b}`)
      const reverse = collectAgentTitleEvidence(`${b} and ${a}`)
      expect(forward.agent).toBe(reverse.agent)
      expect(forward.agent).toBeNull()
      expect([...forward.freeTextNames].sort()).toEqual([a, b].sort())
      expect([...reverse.freeTextNames].sort()).toEqual([a, b].sort())
    })
  })

  it.each([
    ['claude', 'claude'],
    ['codex', 'codex'],
    ['opencode', 'opencode']
  ] as const)('collects the free-text token %s without claiming identity', (token, agent) => {
    expect(collectAgentTitleEvidence(`review the ${token} integration`)).toMatchObject({
      agent: null,
      reason: 'free-text-only',
      freeTextNames: [agent]
    })
  })

  describe('a vendor marker is evidence the agent emitted, not text a human typed', () => {
    it('keeps a Claude pane Claude when its task text names another agent', () => {
      // 13 recorded titles have this shape. The sigil is emitted by Claude; the name is typed.
      expect(agentFor('✳ Fix Codex false attention notifications on Windows')).toBe('claude')
      expect(reasonFor('✳ Consolidate Codex subagent sidebar rows')).toBe('vendor-marker')
    })

    it('lets an anchored name outrank a foreign vendor marker', () => {
      expect(agentFor('✳ opencode')).toBe('claude')
      expect(reasonFor('✳ opencode')).toBe('vendor-marker')
      expect(agentFor('✳ codex')).toBe('claude')
      expect(reasonFor('✳ codex')).toBe('vendor-marker')
    })

    it('keeps an OpenCode envelope OpenCode when its session text names another agent', () => {
      expect(agentFor('OC | QA PR #14582 Claude sidecar SSH arms')).toBe('opencode')
    })
  })

  describe('a name in free text alone is never identity', () => {
    it.each([
      '◐ DaemonConnectionLostError with 70 Codex agents',
      'Fix the opencode hook',
      'opencode',
      '⠋ opencode',
      '⠋ codex'
    ])('declines %j', (title) => {
      expect(agentFor(title)).toBeNull()
      expect(reasonFor(title)).toBe('free-text-only')
    })
  })

  it.each([
    ['Claude Code', 'claude'],
    ['Claude Agent Teams', 'claude-agent-teams'],
    ['Agent Teams', 'claude-agent-teams']
  ] as const)('recognizes the emitted whole-title alias %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it.each(['Teams', 'Agents'])(
    'does not treat the partial display label %s as identity',
    (title) => {
      expect(agentFor(title)).toBeNull()
      expect(reasonFor(title)).toBe('no-evidence')
    }
  )

  it.each([
    '~/codex',
    '/opencode',
    '.\\claude',
    'C:\\codex',
    'C:/codex',
    '~/Codex ready',
    '.\\Codex ready'
  ])('does not treat the cwd path %s as identity', (title) => {
    expect(agentFor(title)).toBeNull()
  })

  it('does not duplicate an anchored token as free text', () => {
    expect(collectAgentTitleEvidence('codex.exe').freeTextNames).toEqual([])
    expect(collectAgentTitleEvidence('Claude Agent Teams').freeTextNames).toEqual([])
  })

  it.each([
    ['Codex ready', 'codex'],
    ['Codex - action required', 'codex'],
    ['Pi ready', 'pi']
  ] as const)('recognizes Orca-controlled synthetic title %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it.each([
    'Claude Code ready',
    'Claude thinking',
    '. Claude Code working',
    'zsh | ⠋ Claude Code - action required'
  ])('recognizes the explicit Claude identity frame %s', (title) => {
    expect(agentFor(title)).toBe('claude')
    expect(reasonFor(title)).toBe('anchored')
  })

  it('does not promote Claude status words in task text', () => {
    expect(agentFor('Fix the Claude Code ready-state parser')).toBeNull()
    expect(agentFor('Fix Claude Code ready behavior… - opencode')).toBe('opencode')
  })

  it.each(['. Review the parser', '* Waiting for input'])(
    'recognizes the established Claude status prefix in %s',
    (title) => {
      expect(agentFor(title)).toBe('claude')
      expect(reasonFor(title)).toBe('vendor-marker')
    }
  )

  it.each([['⠋ Pi idle', 'pi']] as const)(
    'recognizes the decorated identity frame %s',
    (title, agent) => {
      expect(agentFor(title)).toBe(agent)
      expect(reasonFor(title)).toBe('anchored')
    }
  )

  it('does not invent synthetic titles for an opted-out profile', () => {
    expect(agentFor('OpenCode ready')).toBeNull()
    expect(agentFor('⠋ OpenCode')).toBeNull()
    expect(reasonFor('OpenCode ready')).toBe('free-text-only')
  })

  it('reads identity from the innermost wrapper segment', () => {
    expect(agentFor('zsh | ⠋ Claude Code')).toBe('claude')
    expect(agentFor('ssh | tmux | Claude Code')).toBe('claude')
    expect(agentFor('ssh | tmux | OC | review the parser')).toBe('opencode')
    expect(agentFor('zsh | Fix the Codex parser')).toBeNull()
  })

  it('bounds wrapper inspection while preserving innermost identity', () => {
    const wrappers = Array.from({ length: 200 }, (_, index) => `wrapper-${index}`).join(' | ')
    expect(agentFor(`${wrappers} | ⠋ Claude Code`)).toBe('claude')
    expect(agentFor(`${wrappers} | OC | review the parser`)).toBe('opencode')
    expect(agentFor(`outer-a | outer-b | OC | ${wrappers} | Claude Code`)).toBe('claude')
  })

  it.each([
    ['codex.exe', 'codex'],
    ['claude.cmd', 'claude'],
    ['opencode.ps1', 'opencode'],
    ['CODEX.EXE', 'codex'],
    ['OPENCODE.CMD', 'opencode']
  ] as const)('recognizes the bare Windows launcher %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it('produces no name evidence for an agent outside the token set', () => {
    // The token set is deliberately narrower than the agent union: short names like `pi` would
    // classify ordinary shell text. Such a title yields no evidence at all rather than a guess.
    expect(reasonFor('Review PR for Pi transcript rendering')).toBe('no-evidence')
  })

  describe('activity is not identity', () => {
    it.each(['◐ Rebase PR #14624 onto main', '⠂ Fix SSH fallback', '⠋ Thinking'])(
      'declines the spinner-only title %j',
      (title) => {
        // Braille and quarter-circle spinners are emitted by many agents, so they prove the pane
        // is busy and nothing about who it is. Callers that want busy-ness use activity parsing.
        expect(agentFor(title)).toBeNull()
        expect(reasonFor(title)).toBe('no-evidence')
      }
    )
  })

  it('does not treat an embedded Claude sigil as a vendor marker', () => {
    expect(collectAgentTitleEvidence('task text ✳ decoration')).toEqual({
      vendorMarkers: [],
      anchoredNames: [],
      freeTextNames: [],
      agent: null,
      reason: 'no-evidence'
    })
  })

  it('recognizes a bare Claude sigil as a vendor marker', () => {
    expect(collectAgentTitleEvidence('✳')).toEqual({
      vendorMarkers: ['claude'],
      anchoredNames: [],
      freeTextNames: [],
      agent: 'claude',
      reason: 'vendor-marker'
    })
  })

  describe('conflicting evidence of the same class resolves to nothing', () => {
    it('declines two anchored names', () => {
      const evidence = collectAgentTitleEvidence('OC | something… - pi')
      expect(evidence.agent).toBeNull()
      expect(evidence.reason).toBe('conflicting-anchored-names')
      expect([...evidence.anchoredNames].sort()).toEqual(['opencode', 'pi'])
    })

    it('keeps an anchored conflict ahead of a vendor marker', () => {
      const evidence = collectAgentTitleEvidence('✳ | OC | something… - pi')
      expect(evidence.agent).toBeNull()
      expect(evidence.reason).toBe('conflicting-anchored-names')
      expect([...evidence.anchoredNames].sort()).toEqual(['opencode', 'pi'])
      expect(evidence.vendorMarkers).toEqual(['claude'])
    })
  })

  it('declines a Claude management screen', () => {
    expect(collectAgentTitleEvidence('claude agents')).toEqual({
      vendorMarkers: [],
      anchoredNames: [],
      freeTextNames: [],
      agent: null,
      reason: 'no-evidence'
    })
  })

  it('requires whitespace before the owner suffix dash', () => {
    expect(agentFor('task- codex')).toBeNull()
    expect(reasonFor('task- codex')).toBe('free-text-only')
  })

  it('terminates when a wrapper title starts with a separator', () => {
    expect(agentFor(' | ')).toBeNull()
  })
})
