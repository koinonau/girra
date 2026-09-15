import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from './constants'
import { resolveSourceControlAiForOperation } from './source-control-ai'

describe('source-control AI policy regressions', () => {
  it('does not apply a local model choice to an SSH execution host', () => {
    const settings = getDefaultSettings('/repo')
    settings.defaultTuiAgent = 'opencode'
    settings.sourceControlAi = {
      ...settings.sourceControlAi!,
      agentId: 'opencode',
      selectedModelByAgent: { opencode: 'opencode/gpt-5.4-mini' },
      selectedModelByAgentByHost: { local: { opencode: 'opencode/gpt-5.4-mini' } }
    }

    const result = resolveSourceControlAiForOperation({
      settings,
      operation: 'commitMessage',
      discoveryHostKey: 'ssh:build-host'
    })

    expect(result).toMatchObject({
      ok: true,
      value: { params: { agentId: 'opencode', model: 'opencode/deepseek-v4-flash-free' } }
    })
  })

  it('keeps repo recipe and host model precedence scoped to one operation', () => {
    const settings = getDefaultSettings('/repo')
    settings.defaultTuiAgent = 'opencode'
    settings.agentCmdOverrides = { opencode: ' managed-opencode ' }
    settings.sourceControlAi = {
      ...settings.sourceControlAi!,
      agentId: 'opencode',
      selectedModelByAgent: { opencode: 'opencode/deepseek-v4-flash-free' },
      instructionsByOperation: {
        ...settings.sourceControlAi!.instructionsByOperation,
        commitMessage: 'global instruction'
      }
    }
    const repo = {
      sourceControlAi: {
        modelOverridesByOperation: {
          commitMessage: {
            selectedModelByAgentByHost: {
              'ssh:build-host': { opencode: 'opencode/gpt-5.4-mini' }
            },
            selectedThinkingByModel: { 'opencode/gpt-5.4-mini': 'xhigh' }
          }
        },
        instructionsByOperation: { commitMessage: ' repo instruction ' },
        actionOverrides: {
          commitMessage: {
            commandInputTemplate: '{basePrompt}\n\nRepo policy',
            agentArgs: ' --json '
          }
        }
      }
    }

    const result = resolveSourceControlAiForOperation({
      settings,
      repo,
      operation: 'commitMessage',
      discoveryHostKey: 'ssh:build-host'
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        params: {
          agentId: 'opencode',
          model: 'opencode/gpt-5.4-mini',
          thinkingLevel: 'xhigh',
          customPrompt: 'repo instruction',
          commandInputTemplate: '{basePrompt}\n\nRepo policy',
          agentArgs: '--json',
          agentCommandOverride: 'managed-opencode'
        }
      }
    })
  })
})
