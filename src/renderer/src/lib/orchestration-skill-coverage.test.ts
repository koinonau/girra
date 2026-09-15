import { describe, expect, it } from 'vitest'
import type { DiscoveredSkill, SkillDiscoverySource } from '../../../shared/skills'
import type { TuiAgent } from '../../../shared/tui-agent'
import {
  agentHasOrchestrationSkill,
  getOrchestrationSkillAgentStatuses
} from './orchestration-skill-coverage'

function skill(overrides: Partial<DiscoveredSkill>): DiscoveredSkill {
  return {
    id: 'skill-1',
    name: 'orchestration',
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/Users/test/.agents/skills',
    directoryPath: '/Users/test/.agents/skills/orchestration',
    skillFilePath: '/Users/test/.agents/skills/orchestration/SKILL.md',
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

function source(
  path: string,
  owner: SkillDiscoverySource['owner'],
  sourceKind: SkillDiscoverySource['sourceKind'] = 'home'
): SkillDiscoverySource {
  return {
    id: path,
    label: path,
    path,
    sourceKind,
    providers: ['agent-skills'],
    owner,
    exists: true
  }
}

describe('orchestration skill agent coverage', () => {
  it('marks shared-path agents from the global ~/.agents/skills install', () => {
    const skills = [
      skill({
        providers: ['agent-skills'],
        sourceKind: 'home',
        rootPath: '/Users/test/.agents/skills',
        directoryPath: '/Users/test/.agents/skills/orchestration'
      })
    ]

    expect(
      getOrchestrationSkillAgentStatuses(
        skills,
        ['opencode', 'pi'],
        [source('/Users/test/.agents/skills', null)]
      )
    ).toEqual([
      { agent: 'opencode', label: 'OpenCode', installed: true },
      { agent: 'pi', label: 'Pi', installed: true }
    ])
  })

  it('marks Claude from ~/.claude/skills without covering provider-home agents', () => {
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/orchestration'
      })
    ]

    const sources = [source('/Users/test/.claude/skills', 'claude')]
    expect(agentHasOrchestrationSkill('claude', skills, sources)).toBe(true)
    expect(agentHasOrchestrationSkill('opencode', skills, sources)).toBe(false)
    expect(agentHasOrchestrationSkill('pi', skills, sources)).toBe(false)
  })

  it('marks Claude from an enabled plugin install', () => {
    // Why: Claude Code loads skills from enabled plugins, so an owned plugin root counts like a home root.
    expect(
      agentHasOrchestrationSkill(
        'claude',
        [
          skill({
            providers: ['claude', 'agent-skills'],
            sourceKind: 'plugin',
            sourceLabel: 'Claude plugin',
            rootPath: '/Users/test/.claude/plugins/repos/vendor/pack/skills',
            directoryPath: '/Users/test/.claude/plugins/repos/vendor/pack/skills/orchestration'
          })
        ],
        [source('/Users/test/.claude/plugins/repos/vendor/pack/skills', 'claude', 'plugin')]
      )
    ).toBe(true)
  })

  it('ignores repo-scoped orchestration installs', () => {
    expect(
      agentHasOrchestrationSkill(
        'pi',
        [
          skill({
            providers: ['agent-skills'],
            sourceKind: 'repo',
            rootPath: '/workspace/.agents/skills',
            directoryPath: '/workspace/.agents/skills/orchestration'
          })
        ],
        [source('/workspace/.agents/skills', null, 'repo')]
      )
    ).toBe(false)
  })

  it('matches orchestration by directory name when frontmatter uses a display name', () => {
    expect(
      agentHasOrchestrationSkill(
        'claude',
        [
          skill({
            name: 'Orca Orchestration',
            providers: ['claude'],
            sourceKind: 'home',
            rootPath: '/Users/test/.claude/skills',
            directoryPath: '/Users/test/.claude/skills/orchestration'
          })
        ],
        [source('/Users/test/.claude/skills', 'claude')]
      )
    ).toBe(true)
  })

  it('marks each provider-home agent from its own global skills location', () => {
    const cases: { agent: TuiAgent; rootPath: string; directoryPath: string }[] = [
      {
        agent: 'opencode',
        rootPath: '/Users/test/.config/opencode/skills',
        directoryPath: '/Users/test/.config/opencode/skills/orchestration'
      },
      {
        agent: 'pi',
        rootPath: '/Users/test/.pi/agent/skills',
        directoryPath: '/Users/test/.pi/agent/skills/orchestration'
      }
    ]
    for (const { agent, rootPath, directoryPath } of cases) {
      const skills = [
        skill({ providers: ['agent-skills'], sourceKind: 'home', rootPath, directoryPath })
      ]
      const sources = [source(rootPath, agent)]
      expect(agentHasOrchestrationSkill(agent, skills, sources)).toBe(true)
      // Why: a provider-home install must not leak coverage to unrelated agents.
      expect(agentHasOrchestrationSkill('claude', skills, sources)).toBe(false)
    }
  })

  it('marks every provider root retained after symlink deduplication', () => {
    const roots = [
      source('/Users/test/.claude/skills', 'claude'),
      source('/Users/test/.config/opencode/skills', 'opencode'),
      source('/Users/test/.pi/agent/skills', 'pi')
    ]
    const skills = [
      skill({
        providers: ['claude', 'agent-skills'],
        rootPath: roots[0].path,
        rootPaths: roots.map((root) => root.path),
        directoryPath: '/Users/test/.claude/skills/orchestration'
      })
    ]

    expect(
      getOrchestrationSkillAgentStatuses(
        skills,
        ['claude', 'claude-agent-teams', 'opencode', 'pi'],
        roots
      ).every((status) => status.installed)
    ).toBe(true)
  })

  it('does not treat a repository shared root as a global install after deduplication', () => {
    const piRoot = source('/Users/test/.pi/agent/skills', 'pi')
    const repoRoot = source('/workspace/.agents/skills', null, 'repo')
    const skills = [
      skill({
        providers: ['agent-skills'],
        rootPath: piRoot.path,
        rootPaths: [piRoot.path, repoRoot.path],
        directoryPath: '/Users/test/.pi/agent/skills/orchestration'
      })
    ]

    expect(agentHasOrchestrationSkill('pi', skills, [piRoot, repoRoot])).toBe(true)
    expect(agentHasOrchestrationSkill('opencode', skills, [piRoot, repoRoot])).toBe(false)
  })

  it('keeps the owning home root when a repo root duplicates its path', () => {
    // Why: a workspace whose cwd is the home dir scans ~/.claude/skills as both a
    // home and a repo root, and the repo duplicate sorts last by label.
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/orchestration'
      })
    ]

    expect(
      agentHasOrchestrationSkill('claude', skills, [
        source('/Users/test/.claude/skills', 'claude'),
        source('/Users/test/.claude/skills', 'claude', 'repo')
      ])
    ).toBe(true)
  })

  it('leaves an agent uncovered when no source claims the skill root', () => {
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/orchestration'
      })
    ]

    expect(agentHasOrchestrationSkill('claude', skills, [])).toBe(false)
  })

  it('marks a multi-segment provider-home agent from a Windows-style path', () => {
    expect(
      agentHasOrchestrationSkill(
        'opencode',
        [
          skill({
            providers: ['agent-skills'],
            sourceKind: 'home',
            rootPath: 'C:\\Users\\test\\.config\\opencode\\skills',
            directoryPath: 'C:\\Users\\test\\.config\\opencode\\skills\\orchestration'
          })
        ],
        [source('C:\\Users\\test\\.config\\opencode\\skills', 'opencode')]
      )
    ).toBe(true)
  })

  it('keeps provider-home agents distinct from each other', () => {
    const piInstall = [
      skill({
        providers: ['agent-skills'],
        sourceKind: 'home',
        rootPath: '/Users/test/.pi/agent/skills',
        directoryPath: '/Users/test/.pi/agent/skills/orchestration'
      })
    ]
    const piSources = [source('/Users/test/.pi/agent/skills', 'pi')]

    expect(agentHasOrchestrationSkill('pi', piInstall, piSources)).toBe(true)
    expect(agentHasOrchestrationSkill('opencode', piInstall, piSources)).toBe(false)
  })

  it('marks Claude Agent Teams from ~/.claude/skills like Claude Code', () => {
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/orchestration'
      })
    ]

    expect(
      agentHasOrchestrationSkill('claude-agent-teams', skills, [
        source('/Users/test/.claude/skills', 'claude')
      ])
    ).toBe(true)
  })

  it('marks Windows skill paths', () => {
    expect(
      agentHasOrchestrationSkill(
        'claude',
        [
          skill({
            providers: ['claude'],
            sourceKind: 'home',
            rootPath: 'C:\\Users\\test\\.claude\\skills',
            directoryPath: 'C:\\Users\\test\\.claude\\skills\\orchestration'
          })
        ],
        [source('C:\\Users\\test\\.claude\\skills', 'claude')]
      )
    ).toBe(true)
  })
})
