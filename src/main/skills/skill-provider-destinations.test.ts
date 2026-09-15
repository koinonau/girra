import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { selectedOrDetectedSkillProviders } from '../../shared/skill-install-providers'
import { resolveSkillProviderDestinations } from './skill-provider-destinations'

const HOME = join('/home', 'dev')
const WORKSPACE = join('/repos', 'orca')

describe('resolveSkillProviderDestinations', () => {
  it('places every detected agent that owns a directory', () => {
    const destinations = resolveSkillProviderDestinations({
      scope: 'global',
      homeDirectory: HOME,
      detectedProviders: ['claude']
    })
    expect(destinations.map((destination) => destination.rootPath)).toEqual([
      join(HOME, '.claude', 'skills')
    ])
  })

  it('honors custom global config roots without changing workspace roots', () => {
    const customClaudeRoot = join('/srv', 'claude', 'skills')
    expect(
      resolveSkillProviderDestinations({
        scope: 'global',
        homeDirectory: HOME,
        detectedProviders: ['claude'],
        providerRootOverrides: { claude: customClaudeRoot }
      })
    ).toEqual([{ provider: 'claude', readsCanonicalRoot: false, rootPath: customClaudeRoot }])
    expect(
      resolveSkillProviderDestinations({
        scope: 'workspace',
        homeDirectory: HOME,
        workspaceDirectory: WORKSPACE,
        detectedProviders: ['claude'],
        providerRootOverrides: { claude: customClaudeRoot }
      })[0]?.rootPath
    ).toBe(join(WORKSPACE, '.claude', 'skills'))
  })

  it('treats a custom root equal to canonical as canonical', () => {
    expect(
      resolveSkillProviderDestinations({
        scope: 'global',
        homeDirectory: HOME,
        detectedProviders: ['claude'],
        providerRootOverrides: { claude: join(HOME, '.agents', 'skills') }
      })
    ).toEqual([
      {
        provider: 'claude',
        readsCanonicalRoot: true,
        rootPath: join(HOME, '.agents', 'skills')
      }
    ])
  })

  it('ignores agents Orca cannot place skills for', () => {
    expect(
      resolveSkillProviderDestinations({
        scope: 'global',
        homeDirectory: HOME,
        detectedProviders: ['opencode', 'pi', 'not-an-agent']
      })
    ).toEqual([])
  })

  it('requires a workspace directory for workspace scope', () => {
    expect(() =>
      resolveSkillProviderDestinations({
        scope: 'workspace',
        homeDirectory: HOME,
        detectedProviders: ['claude']
      })
    ).toThrow('skill-install-workspace-required')
  })
})

describe('selectedOrDetectedSkillProviders', () => {
  // Why: removal passes no selection so it can still clean roots an earlier
  // install wrote, even if the user has since narrowed their agents.
  it('keeps every detected agent when nothing was selected', () => {
    expect(selectedOrDetectedSkillProviders(['claude', 'opencode'], undefined)).toEqual([
      'claude',
      'opencode'
    ])
  })

  it('honors selected agents even when they are not currently detected', () => {
    expect(selectedOrDetectedSkillProviders(['claude', 'opencode'], ['claude', 'pi'])).toEqual([
      'claude',
      'pi'
    ])
  })

  it('places nothing extra when the choice is empty', () => {
    expect(selectedOrDetectedSkillProviders(['claude', 'opencode'], [])).toEqual([])
  })
})
