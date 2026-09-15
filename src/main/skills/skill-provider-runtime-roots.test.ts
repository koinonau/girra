import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveEnvironmentSkillProviderRoots,
  withClaudeSkillProviderRoot
} from './skill-provider-runtime-roots'

describe('skill provider runtime roots', () => {
  it('maps the Claude config home to its global skill root', () => {
    const claudeRoot = resolve('/srv/claude')
    expect(resolveEnvironmentSkillProviderRoots({ CLAUDE_CONFIG_DIR: claudeRoot })).toEqual({
      claude: join(claudeRoot, 'skills')
    })
  })

  it('rejects relative config roots and lets a target-specific Claude root win', () => {
    const roots = resolveEnvironmentSkillProviderRoots({ CLAUDE_CONFIG_DIR: '../claude' })
    expect(roots).toEqual({})
    const managedClaudeRoot = resolve('/managed/claude')
    expect(withClaudeSkillProviderRoot(roots, managedClaudeRoot)).toEqual({
      claude: join(managedClaudeRoot, 'skills')
    })
  })
})
