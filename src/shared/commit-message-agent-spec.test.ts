import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMMIT_MESSAGE_AGENT_SPECS,
  CUSTOM_AGENT_ID,
  DEFAULT_COMMIT_MESSAGE_AGENT_ID,
  getCommitMessageAgentCapability,
  getCommitMessageAgentSpec,
  getCommitMessageModelCapability,
  getCommitMessageModel,
  isCustomAgentId,
  listCommitMessageAgentCapabilities,
  listCommitMessageAgentIds,
  resolveCommitMessageAgentChoice
} from './commit-message-agent-spec'
import { parseClaudeModels, parseLineModels, parsePiModels } from './commit-message-model-parsers'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('COMMIT_MESSAGE_AGENT_SPECS', () => {
  it('exposes the installed local agents as commit-message agents', () => {
    const ids = listCommitMessageAgentIds().sort()
    expect(ids).toEqual(['claude', 'opencode', 'pi'])
  })

  it('uses the strongest available defaults for core agents', () => {
    expect(COMMIT_MESSAGE_AGENT_SPECS.claude?.defaultModelId).toBe('sonnet')
    expect(COMMIT_MESSAGE_AGENT_SPECS.pi?.defaultModelId).toBe('github-copilot/gpt-5.4-mini')
  })

  it('defaults the agent picker to Claude', () => {
    expect(DEFAULT_COMMIT_MESSAGE_AGENT_ID).toBe('claude')
  })

  it('treats disabled default agents as unavailable for implicit Source Control AI choices', () => {
    expect(resolveCommitMessageAgentChoice(null, 'opencode', ['opencode'])).toBe('claude')
    expect(resolveCommitMessageAgentChoice(null, null, ['claude'])).toBeNull()
    expect(resolveCommitMessageAgentChoice('opencode', null, ['opencode'])).toBe('opencode')
  })

  it('gives every model with thinking levels a valid default', () => {
    for (const spec of Object.values(COMMIT_MESSAGE_AGENT_SPECS)) {
      if (!spec) {
        continue
      }
      for (const model of spec.models) {
        if (model.thinkingLevels) {
          expect(model.defaultThinkingLevel).toBeDefined()
          expect(model.thinkingLevels.some((l) => l.id === model.defaultThinkingLevel)).toBe(true)
        }
      }
    }
  })

  it('exposes OpenAI thinking levels on a discovered gpt-*-codex model id', () => {
    const spark = getCommitMessageModel('opencode', 'openai/gpt-5.3-codex-spark')
    expect(spark).toBeDefined()
    expect(spark?.thinkingLevels?.map((l) => l.id)).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(spark?.defaultThinkingLevel).toBe('low')
  })

  it('omits thinking levels on Claude Haiku (non-reasoning model)', () => {
    const haiku = getCommitMessageModel('claude', 'haiku')
    expect(haiku).toBeDefined()
    expect(haiku?.thinkingLevels).toBeUndefined()
    expect(haiku?.defaultThinkingLevel).toBeUndefined()
  })

  it('identifies the custom sentinel via isCustomAgentId', () => {
    expect(isCustomAgentId(CUSTOM_AGENT_ID)).toBe(true)
    expect(isCustomAgentId('claude')).toBe(false)
    expect(isCustomAgentId('opencode')).toBe(false)
    expect(isCustomAgentId(null)).toBe(false)
    expect(isCustomAgentId(undefined)).toBe(false)
  })

  it('does not list "custom" alongside preset agent ids', () => {
    expect(listCommitMessageAgentIds()).not.toContain(CUSTOM_AGENT_ID)
  })

  it('exposes UI capabilities without spawn details', () => {
    const capabilities = listCommitMessageAgentCapabilities()
    expect(capabilities.map((capability) => capability.id)).toContain('opencode')
    const opencode = getCommitMessageAgentCapability('opencode')
    expect(opencode).toMatchObject({
      id: 'opencode',
      label: 'OpenCode',
      modelSource: 'dynamic',
      defaultModelId: 'opencode/deepseek-v4-flash-free'
    })
    expect(opencode).not.toHaveProperty('binary')
    expect(opencode).not.toHaveProperty('buildArgs')
    expect(
      getCommitMessageModelCapability('opencode', 'opencode/gpt-5.4-mini')?.thinkingLevels
    ).toBeDefined()
  })
})

describe('buildArgs (Claude)', () => {
  const spec = getCommitMessageAgentSpec('claude')!

  it('passes -p, output format, and model on every call', () => {
    const args = spec.buildArgs({ prompt: '', model: 'haiku' })
    expect(args).toEqual([
      '-p',
      '--output-format',
      'text',
      '--model',
      'haiku',
      '--permission-mode',
      'plan'
    ])
  })

  it('appends --effort when a thinking level is supplied', () => {
    const args = spec.buildArgs({
      prompt: '',
      model: 'sonnet',
      thinkingLevel: 'high'
    })
    expect(args).toEqual([
      '-p',
      '--output-format',
      'text',
      '--model',
      'sonnet',
      '--permission-mode',
      'plan',
      '--effort',
      'high'
    ])
  })

  it('omits --effort when thinkingLevel is not provided', () => {
    const args = spec.buildArgs({ prompt: '', model: 'opus' })
    expect(args).not.toContain('--effort')
  })
})

describe('model discovery parsers', () => {
  it('parses Claude list_models output into commit-message models', () => {
    const stdout = `${JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'orca-model-discovery',
        response: {
          models: [
            {
              value: 'default',
              displayName: 'Default (recommended)',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max']
            },
            {
              value: 'opus[1m]',
              displayName: 'Opus (1M context)',
              description: 'Opus 5 with 1M context · $5/$25 per Mtok',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
              supportsFastMode: true
            },
            { value: 'haiku', displayName: 'Haiku' }
          ]
        }
      }
    })}\n`
    expect(parseClaudeModels(stdout)).toEqual([
      {
        id: 'opus[1m]',
        label: 'Opus (1M context)',
        description: 'Opus 5 with 1M context · $5/$25 per Mtok',
        thinkingLevels: [
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Medium' },
          { id: 'high', label: 'High' },
          { id: 'xhigh', label: 'Extra High' },
          { id: 'max', label: 'Max' }
        ],
        defaultThinkingLevel: 'low',
        supportsFastMode: true
      },
      { id: 'haiku', label: 'Haiku' }
    ])
  })

  it('returns no Claude models when the CLI lacks list_models so the seed stays', () => {
    expect(
      parseClaudeModels(
        '{"type":"control_response","response":{"subtype":"error","request_id":"orca-model-discovery","error":"Unsupported control request subtype: list_models"}}\n'
      )
    ).toEqual([])
  })

  it('declares stdin-driven dynamic discovery for Claude', () => {
    const discovery = COMMIT_MESSAGE_AGENT_SPECS.claude?.modelDiscovery
    expect(COMMIT_MESSAGE_AGENT_SPECS.claude?.modelSource).toBe('dynamic')
    expect(discovery?.binary).toBe('claude')
    expect(discovery?.args).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose'
    ])
    const payload = JSON.parse(discovery?.stdinPayload ?? '') as {
      type?: string
      request?: { subtype?: string }
    }
    expect(payload.type).toBe('control_request')
    expect(payload.request?.subtype).toBe('list_models')
    expect(discovery?.stdinPayload?.endsWith('\n')).toBe(true)
  })

  it('parses one-model-per-line output', () => {
    expect(parseLineModels('opencode/gpt-5.4-mini\n\nopenai/gpt-5.5\n').map((m) => m.id)).toEqual([
      'opencode/gpt-5.4-mini',
      'openai/gpt-5.5'
    ])
  })

  it('parses Pi model table output with provider-qualified ids', () => {
    const output = [
      'provider        model                   context  max-out  thinking  images',
      'github-copilot  gpt-5.4-mini            400K     128K     yes       yes',
      'github-copilot  gpt-4o                  128K     4.1K     no        yes'
    ].join('\n')

    expect(parsePiModels(output)).toEqual([
      {
        id: 'github-copilot/gpt-5.4-mini',
        label: 'Github Copilot GPT 5.4 Mini',
        thinkingLevels: [
          { id: 'off', label: 'Off' },
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Medium' },
          { id: 'high', label: 'High' },
          { id: 'xhigh', label: 'Extra High' }
        ],
        defaultThinkingLevel: 'low'
      },
      {
        id: 'github-copilot/gpt-4o',
        label: 'Github Copilot GPT 4O'
      }
    ])
  })

  it('parses CRLF-heavy dynamic model outputs without full line-array splitting', () => {
    const splitSpy = vi.spyOn(String.prototype, 'split')
    const noise = 'ignored model with spaces\r\n'.repeat(10_000)
    const blankNoise = '\r\n'.repeat(10_000)

    expect(
      parseLineModels(`${noise}${blankNoise}opencode/gpt-5.4-mini\r\nopenai/gpt-5.5\r\n`)
    ).toEqual([
      {
        id: 'opencode/gpt-5.4-mini',
        label: 'Opencode GPT 5.4 Mini',
        thinkingLevels: [
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Medium' },
          { id: 'high', label: 'High' },
          { id: 'xhigh', label: 'Extra High' }
        ],
        defaultThinkingLevel: 'low'
      },
      {
        id: 'openai/gpt-5.5',
        label: 'Openai GPT 5.5',
        thinkingLevels: [
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Medium' },
          { id: 'high', label: 'High' },
          { id: 'xhigh', label: 'Extra High' }
        ],
        defaultThinkingLevel: 'low'
      }
    ])
    expect(
      parsePiModels(
        `${noise}provider model context max-out thinking images\r\ngithub-copilot gpt-5.4-mini 400K 128K yes yes\r\n`
      )[0]?.id
    ).toBe('github-copilot/gpt-5.4-mini')

    const usedFullLineSplit = splitSpy.mock.calls.some(
      ([separator]) =>
        (typeof separator === 'string' && separator === '\n') ||
        (separator instanceof RegExp && separator.source === '\\r?\\n')
    )
    const usedWhitespaceFieldSplit = splitSpy.mock.calls.some(
      ([separator]) => separator instanceof RegExp && separator.source === '\\s+'
    )
    expect(usedFullLineSplit).toBe(false)
    expect(usedWhitespaceFieldSplit).toBe(false)
  })
})

describe('buildArgs (OpenCode)', () => {
  const spec = getCommitMessageAgentSpec('opencode')!

  it('runs `opencode run` without passing the prompt via argv', () => {
    const prompt = `PROMPT ${'x'.repeat(1024)}`
    const args = spec.buildArgs({
      prompt,
      model: 'opencode/deepseek-v4-flash-free'
    })

    expect(args).toEqual([
      'run',
      '--model',
      'opencode/deepseek-v4-flash-free',
      '--agent',
      'build',
      '--format',
      'default'
    ])
    expect(args).not.toContain(prompt)
    expect(args).not.toContain('')
    expect(spec.promptDelivery).toBe('stdin')
  })

  it('emits --variant <level> when thinking level is supplied', () => {
    const args = spec.buildArgs({
      prompt: 'PROMPT',
      model: 'opencode/gpt-5.4-mini',
      thinkingLevel: 'high'
    })

    expect(args).toEqual([
      'run',
      '--model',
      'opencode/gpt-5.4-mini',
      '--agent',
      'build',
      '--format',
      'default',
      '--variant',
      'high'
    ])
  })

  it('omits --variant when no thinking level is supplied', () => {
    const args = spec.buildArgs({
      prompt: 'PROMPT',
      model: 'opencode/gpt-5.4-mini'
    })

    expect(args).not.toContain('--variant')
  })
})
