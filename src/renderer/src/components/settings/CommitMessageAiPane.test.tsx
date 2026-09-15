import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { SourceControlAiSettings } from '../../../../shared/source-control-ai-types'
import {
  getCommitMessageModelDiscoveryHostKey,
  getCommitMessageModelDiscoveryHostKeyForLocalRuntime,
  getCommitMessageModelDiscoveryHostKeyForScope
} from '../../../../shared/commit-message-host-key'
import { useAppStore } from '../../store'
import {
  CommitMessageAiPane,
  getCommitMessageSettingsPaneDiscoveryHostKey,
  mergeDiscoveredModelsIntoCommitMessageConfig
} from './CommitMessageAiPane'
import {
  getAgentCatalogForAction,
  getSourceControlAgentArgsPlaceholder
} from './source-control-action-recipe-options'
import { getCommitMessageAiPaneSearchEntries } from './commit-message-ai-search'
import { TooltipProvider } from '../ui/tooltip'

function renderPane(settings: GlobalSettings): string {
  return renderToStaticMarkup(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(CommitMessageAiPane, {
        settings,
        updateSettings: () => {}
      })
    )
  )
}

function buildSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    commitMessageAi: {
      enabled: false,
      agentId: null,
      selectedModelByAgent: {},
      selectedThinkingByModel: {},
      customPrompt: '',
      customAgentCommand: ''
    },
    ...overrides
  } as GlobalSettings
}

describe('CommitMessageAiPane', () => {
  beforeEach(() => {
    useAppStore.setState({ settingsSearchQuery: '' })
  })

  it('renders only the opt-in control before the feature is enabled', () => {
    const markup = renderPane(buildSettings())

    expect(markup).toContain('Source Control AI')
    expect(markup).toContain('Show Source Control AI actions')
    expect(markup).toContain('aria-checked="false"')
    expect(markup).not.toContain('Action recipes')
    expect(markup).not.toContain('Command template')
    expect(markup).not.toContain('Default model')
    expect(markup).not.toContain('Thinking effort')
  })

  it('renders action recipes for every Source Control AI action', () => {
    const markup = renderPane(
      buildSettings({
        commitMessageAi: {
          enabled: true,
          agentId: 'opencode',
          selectedModelByAgent: { opencode: 'opencode/gpt-5.4-mini' },
          selectedThinkingByModel: { 'opencode/gpt-5.4-mini': 'medium' },
          customPrompt: 'Use Conventional Commits.',
          customAgentCommand: ''
        }
      })
    )

    expect(markup).toContain('aria-checked="true"')
    expect(markup).toContain('Action recipes')
    expect(markup).toContain('Commit message')
    expect(markup).toContain('Pull request details')
    expect(markup).toContain('Branch name')
    expect(markup).toContain('Commit failure fixes')
    expect(markup).toContain('Push failure fixes')
    expect(markup).toContain('Broken checks fixes')
    expect(markup).toContain('Conflict resolution')
    expect(markup).toContain('CLI arguments')
    expect(markup).toContain('Command template')
    expect(markup).toContain('Custom command')
    expect(markup).toContain('{basePrompt}')
    expect(markup).toContain('{stagedPatch}')
    expect(markup).toContain('Use Conventional Commits.')
    expect(markup).not.toContain('Default model')
    expect(markup).not.toContain('Thinking effort')
  })

  it('uses agent-specific CLI argument placeholders', () => {
    const markup = renderPane(
      buildSettings({
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: {},
          customAgentCommand: '',
          actions: {
            fixChecks: {
              agentId: 'opencode'
            }
          },
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(markup).toContain('placeholder="--model opencode/deepseek-v4-flash-free"')
  })

  it('falls back to the preferred default agent for CLI argument placeholders', () => {
    const markup = renderPane(
      buildSettings({
        defaultTuiAgent: 'pi',
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: {},
          customAgentCommand: '',
          actions: {},
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(
      markup.match(/placeholder="--model github-copilot\/gpt-5\.4-mini"/g)?.length ?? 0
    ).toBeGreaterThan(0)
  })

  it('uses known model flags when building source-control CLI argument placeholders', () => {
    expect(getSourceControlAgentArgsPlaceholder(null)).toBe('--model sonnet')
    expect(getSourceControlAgentArgsPlaceholder('custom')).toBe('--flag value')
    expect(getSourceControlAgentArgsPlaceholder('claude')).toBe('--model sonnet')
    expect(getSourceControlAgentArgsPlaceholder('opencode')).toBe(
      '--model opencode/deepseek-v4-flash-free'
    )
    expect(getSourceControlAgentArgsPlaceholder('pi')).toBe('--model github-copilot/gpt-5.4-mini')
    expect(getSourceControlAgentArgsPlaceholder('claude-agent-teams')).toBe('--model <model>')
  })

  it('only offers non-interactive generation agents for text generation actions', () => {
    expect(getAgentCatalogForAction('commitMessage', null).map((agent) => agent.id)).not.toContain(
      'claude-agent-teams'
    )
    expect(getAgentCatalogForAction('pullRequest', null).map((agent) => agent.id)).not.toContain(
      'claude-agent-teams'
    )
    expect(getAgentCatalogForAction('fixChecks', null).map((agent) => agent.id)).toContain(
      'claude-agent-teams'
    )
  })

  it('explains which agents are supported for text-generation recipes', () => {
    const markup = renderPane(
      buildSettings({
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: {},
          customAgentCommand: '',
          actions: {},
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(markup).toContain('Supported agents for this recipe:')
    expect(markup).toContain('Claude, OpenCode, Pi')
    expect(markup).toContain('Custom command')
  })

  it('marks an unsupported saved text-recipe agent with the supported alternatives', () => {
    const markup = renderPane(
      buildSettings({
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: {},
          customAgentCommand: '',
          actions: {
            commitMessage: {
              agentId: 'claude-agent-teams'
            }
          },
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(markup).toContain(
      'Claude Agent Teams cannot run this text-generation recipe. Pick one of the supported agents below.'
    )
    expect(markup).toContain('Supported agents for this recipe:')
  })

  it('keeps action agent selectors constrained for long labels', () => {
    const markup = renderPane(
      buildSettings({
        commitMessageAi: {
          enabled: true,
          agentId: 'claude-agent-teams',
          selectedModelByAgent: { 'claude-agent-teams': 'sonnet' },
          selectedThinkingByModel: {},
          customPrompt: '',
          customAgentCommand: ''
        }
      })
    )

    expect(markup.match(/sm:w-\[220px\]/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
    expect(markup.match(/shrink-0/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
  })

  it('renders saved custom action templates in action recipes', () => {
    const markup = renderPane(
      buildSettings({
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: { commitMessage: '', pullRequest: '', branchName: '' },
          customAgentCommand: '',
          actions: {
            commitMessage: {
              agentId: 'opencode',
              commandInputTemplate: 'use $best-commit-msg to write a commit'
            },
            fixChecks: {
              agentId: 'claude',
              commandInputTemplate: 'use /fix-ci-issue to fix the linked CI bug'
            }
          },
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(markup).toContain('Source Control AI')
    expect(markup).toContain('use $best-commit-msg to write a commit')
    expect(markup).toContain('use /fix-ci-issue to fix the linked CI bug')
  })

  it('renders the custom command editor when a text action uses it', () => {
    const markup = renderPane(
      buildSettings({
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: { commitMessage: '', pullRequest: '', branchName: '' },
          customAgentCommand: 'my-commit-writer --prompt {prompt}',
          actions: {
            commitMessage: {
              agentId: 'custom',
              commandInputTemplate: '{basePrompt}'
            }
          },
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(markup).toContain('Used by commit-message, pull-request, and branch-name recipes')
    expect(markup).toContain('my-commit-writer --prompt {prompt}')
  })

  it('preserves in-progress trailing spaces in command template textareas', () => {
    const markup = renderPane(
      buildSettings({
        sourceControlAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedModelByAgentByHost: {},
          discoveredModelsByAgent: {},
          discoveredModelsByAgentByHost: {},
          selectedThinkingByModel: {},
          instructionsByOperation: { commitMessage: '', pullRequest: '', branchName: '' },
          customAgentCommand: '',
          actions: {
            fixChecks: {
              commandInputTemplate: 'use /fix-ci-issue '
            }
          },
          prCreationDefaults: {},
          launchActionDefaults: {}
        }
      })
    )

    expect(markup).toContain('use /fix-ci-issue </textarea>')
  })

  it('allows default-agent recipes even when the old default generator is unsupported', () => {
    const markup = renderPane(
      buildSettings({
        defaultTuiAgent: 'claude-agent-teams',
        commitMessageAi: {
          enabled: true,
          agentId: null,
          selectedModelByAgent: {},
          selectedThinkingByModel: {},
          customPrompt: '',
          customAgentCommand: ''
        }
      })
    )

    expect(markup).toContain('Action recipes')
    expect(markup).toContain('{basePrompt}')
    expect(markup).not.toContain('Not configured')
    expect(markup).not.toContain('Thinking effort')
  })

  it('keeps action recipes discoverable in settings search metadata', () => {
    const actionRecipesEntry = getCommitMessageAiPaneSearchEntries().find(
      (entry) => entry.title === 'Action recipes'
    )

    expect(actionRecipesEntry?.keywords).toEqual(
      expect.arrayContaining(['agent', 'arguments', 'cli', 'command', 'model', 'template', 'ci'])
    )
  })

  it('merges discovered models without clobbering newer settings fields', () => {
    const config: SourceControlAiSettings = {
      enabled: true,
      agentId: 'pi',
      selectedModelByAgent: { pi: 'stale-model', opencode: 'opencode/gpt-5.4-mini' },
      selectedThinkingByModel: { 'opencode/gpt-5.4-mini': 'low' },
      instructionsByOperation: { commitMessage: 'Use Conventional Commits.' },
      customAgentCommand: '',
      discoveredModelsByAgent: {}
    }

    const merged = mergeDiscoveredModelsIntoCommitMessageConfig(
      config,
      'pi',
      [{ id: 'auto', label: 'Auto' }],
      'auto'
    )

    expect(merged.instructionsByOperation.commitMessage).toBe('Use Conventional Commits.')
    expect(merged.agentId).toBe('pi')
    expect(merged.selectedModelByAgent).toEqual({
      pi: 'auto',
      opencode: 'opencode/gpt-5.4-mini'
    })
    expect(merged.discoveredModelsByAgent?.pi).toEqual([{ id: 'auto', label: 'Auto' }])
    expect(merged.discoveredModelsByAgentByHost?.local?.pi).toEqual([{ id: 'auto', label: 'Auto' }])
  })

  it('keeps SSH discovered models out of the legacy local cache', () => {
    const config: SourceControlAiSettings = {
      enabled: true,
      agentId: 'pi',
      selectedModelByAgent: { pi: 'auto' },
      selectedThinkingByModel: {},
      instructionsByOperation: {},
      customAgentCommand: '',
      discoveredModelsByAgent: { pi: [{ id: 'auto', label: 'Auto' }] },
      selectedModelByAgentByHost: {},
      discoveredModelsByAgentByHost: {}
    }

    const merged = mergeDiscoveredModelsIntoCommitMessageConfig(
      config,
      'pi',
      [{ id: 'remote-only', label: 'Remote Only' }],
      'remote-only',
      'ssh:conn-1'
    )

    expect(merged.selectedModelByAgent.pi).toBe('auto')
    expect(merged.discoveredModelsByAgent?.pi).toEqual([{ id: 'auto', label: 'Auto' }])
    expect(merged.selectedModelByAgentByHost?.['ssh:conn-1']?.pi).toBe('remote-only')
    expect(merged.discoveredModelsByAgentByHost?.['ssh:conn-1']?.pi).toEqual([
      { id: 'remote-only', label: 'Remote Only' }
    ])
  })

  it('keys model discovery cache by execution host', () => {
    expect(getCommitMessageModelDiscoveryHostKey(null)).toBe('local')
    expect(getCommitMessageModelDiscoveryHostKey('ssh-1')).toBe('ssh:ssh-1')
    expect(getCommitMessageModelDiscoveryHostKey(undefined)).toBe('unknown')
    expect(getCommitMessageModelDiscoveryHostKeyForLocalRuntime('Ubuntu')).toBe('wsl:Ubuntu')
    expect(getCommitMessageModelDiscoveryHostKeyForLocalRuntime(null)).toBe('local')
    expect(getCommitMessageModelDiscoveryHostKeyForScope('runtime:env-1')).toBe('runtime:env-1')
    expect(getCommitMessageModelDiscoveryHostKeyForScope('ssh-1')).toBe('ssh:ssh-1')
  })

  it('keeps local active worktree discovery scoped to local, not unknown', () => {
    expect(getCommitMessageSettingsPaneDiscoveryHostKey(buildSettings(), null, true)).toBe('local')
    expect(getCommitMessageSettingsPaneDiscoveryHostKey(buildSettings(), undefined, true)).toBe(
      'unknown'
    )
    expect(
      getCommitMessageSettingsPaneDiscoveryHostKey(
        buildSettings({ activeRuntimeEnvironmentId: 'env-1' }),
        null,
        true
      )
    ).toBe('runtime:env-1')
  })
})
