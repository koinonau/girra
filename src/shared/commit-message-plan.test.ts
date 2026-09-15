import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration, planAgentBinary } from './commit-message-plan'

describe('planCommitMessageGeneration', () => {
  it('keeps extension-provided Pi models available in generated Git text plans', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'pi', model: 'local-extension/model' },
      'Write a commit message'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.error)
    }
    expect(result.plan.args).not.toContain('--no-extensions')
    expect(result.plan.args).toEqual(
      expect.arrayContaining([
        '--no-session',
        '--no-tools',
        '--no-skills',
        '--no-context-files',
        '--model',
        'local-extension/model'
      ])
    )
    expect(result.plan.stdinPayload).toBe('Write a commit message')
  })

  it('plans Claude non-interactive generation with the prompt on stdin only', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'sonnet',
        thinkingLevel: 'high'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'claude',
        args: [
          '-p',
          '--output-format',
          'text',
          '--model',
          'sonnet',
          '--permission-mode',
          'plan',
          '--effort',
          'high'
        ],
        stdinPayload: 'PROMPT',
        label: 'Claude'
      }
    })
  })

  it('plans OpenCode run with prompt on stdin and model variant', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        thinkingLevel: 'high'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'opencode',
        args: [
          'run',
          '--model',
          'opencode/gpt-5.4-mini',
          '--agent',
          'build',
          '--format',
          'default',
          '--variant',
          'high'
        ],
        stdinPayload: 'PROMPT',
        label: 'OpenCode'
      }
    })
  })

  it('keeps OpenCode preset command overrides while sending the prompt on stdin', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentCommandOverride: 'npx opencode'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'npx',
        args: [
          'opencode',
          'run',
          '--model',
          'opencode/gpt-5.4-mini',
          '--agent',
          'build',
          '--format',
          'default'
        ],
        stdinPayload: 'PROMPT',
        label: 'OpenCode'
      }
    })
  })

  it('allows discovered dynamic models that are not in the seed catalog', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'openai/gpt-5.2',
        thinkingLevel: 'xhigh'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'opencode',
        args: [
          'run',
          '--model',
          'openai/gpt-5.2',
          '--agent',
          'build',
          '--format',
          'default',
          '--variant',
          'xhigh'
        ],
        stdinPayload: 'PROMPT',
        label: 'OpenCode'
      }
    })
  })

  // Why: real #14059 reproduction config. CLI arguments repeat --model and add
  // --add-dir/--effort/--dangerously-skip-permissions; the duplicate --model is deduped
  // by DEFAULT_SINGLETON_OPTIONS on a spec that declares no singleton options.
  it('keeps #14059-style recipe CLI arguments intact and deduped on a default-singleton spec', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'sonnet',
        agentArgs: '--add-dir . --model opus --effort low --dangerously-skip-permissions'
      },
      'Generate a concise git commit message for the currently staged changes.'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'claude',
        args: [
          '-p',
          '--output-format',
          'text',
          '--model',
          'opus',
          '--permission-mode',
          'plan',
          '--add-dir',
          '.',
          '--effort',
          'low',
          '--dangerously-skip-permissions'
        ],
        stdinPayload: 'Generate a concise git commit message for the currently staged changes.',
        label: 'Claude'
      }
    })
  })

  it('uses preset agent command overrides as the spawn command prefix', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'pi',
        model: 'github-copilot/gpt-5.4-mini',
        agentCommandOverride: 'npx pi'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        binary: 'npx',
        args: [
          'pi',
          '--print',
          '--no-session',
          '--no-tools',
          '--no-skills',
          '--no-context-files',
          '--mode',
          'text',
          '--model',
          'github-copilot/gpt-5.4-mini'
        ],
        stdinPayload: 'PROMPT'
      }
    })
  })

  it.each([
    ['long option', '--model openai/gpt-5.6-luna', ['--model', 'openai/gpt-5.6-luna'], []],
    ['short option', '-m openai/gpt-5.6-luna', ['-m', 'openai/gpt-5.6-luna'], []],
    ['equals form', '--model=openai/gpt-5.6-luna', ['--model=openai/gpt-5.6-luna'], []],
    ['attached short form', '-mopenai/gpt-5.6-luna', ['-mopenai/gpt-5.6-luna'], []],
    [
      'sibling arguments',
      '--model openai/gpt-5.6-luna --share',
      ['--model', 'openai/gpt-5.6-luna'],
      ['--share']
    ]
  ])(
    'lets OpenCode recipe args override the generated model via %s',
    (_, agentArgs, overrideArgs, trailingArgs) => {
      const result = planCommitMessageGeneration(
        {
          agentId: 'opencode',
          model: 'opencode/gpt-5.4-mini',
          thinkingLevel: 'medium',
          agentArgs
        },
        'PROMPT'
      )

      expect(result).toMatchObject({
        ok: true,
        plan: {
          args: [
            'run',
            ...overrideArgs,
            '--agent',
            'build',
            '--format',
            'default',
            '--variant',
            'medium',
            ...trailingArgs
          ],
          stdinPayload: 'PROMPT'
        }
      })
    }
  )

  it('keeps Pi recipe arguments unchanged when they do not override the model', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'pi',
        model: 'github-copilot/gpt-5.4-mini',
        agentArgs: '--offline'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          '--print',
          '--no-session',
          '--no-tools',
          '--no-skills',
          '--no-context-files',
          '--mode',
          'text',
          '--model',
          'github-copilot/gpt-5.4-mini',
          '--offline'
        ]
      }
    })
  })

  it('keeps the generated OpenCode model when model-like text follows an option terminator', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentArgs: '-- --model literal'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          'run',
          '--model',
          'opencode/gpt-5.4-mini',
          '--agent',
          'build',
          '--format',
          'default',
          '--',
          '--model',
          'literal'
        ]
      }
    })
  })

  it('lets OpenCode recipe args override the generated model instead of repeating it', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentArgs: '--model opencode/gpt-5.5'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: ['run', '--model', 'opencode/gpt-5.5', '--agent', 'build', '--format', 'default'],
        stdinPayload: 'PROMPT'
      }
    })
  })

  it('overrides the generated OpenCode model from a short-form recipe alias', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'opencode', model: 'opencode/gpt-5.4-mini', agentArgs: '-m opencode/gpt-5.5' },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: ['run', '-m', 'opencode/gpt-5.5', '--agent', 'build', '--format', 'default']
      }
    })
  })

  it('overrides OpenCode singleton flags beyond the model', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        thinkingLevel: 'high',
        agentArgs: '--agent plan --format json --variant low'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          'run',
          '--model',
          'opencode/gpt-5.4-mini',
          '--agent',
          'plan',
          '--format',
          'json',
          '--variant',
          'low'
        ]
      }
    })
  })

  it('appends per-action CLI arguments that do not repeat a generated OpenCode flag', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'opencode', model: 'opencode/gpt-5.4-mini', agentArgs: '--share' },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          'run',
          '--model',
          'opencode/gpt-5.4-mini',
          '--agent',
          'build',
          '--format',
          'default',
          '--share'
        ],
        stdinPayload: 'PROMPT'
      }
    })
  })

  it('collapses a singleton flag the user typed twice in one field', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentArgs: '--model opencode/first -m opencode/second'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: ['run', '--model', 'opencode/first', '--agent', 'build', '--format', 'default']
      }
    })
  })

  it('keeps a model flag in the agent command override and removes the generated duplicate', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentCommandOverride: 'npx opencode --model opencode/gpt-5.5 --log-level DEBUG'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        binary: 'npx',
        args: [
          'opencode',
          '--model',
          'opencode/gpt-5.5',
          '--log-level',
          'DEBUG',
          'run',
          '--agent',
          'build',
          '--format',
          'default'
        ]
      }
    })
  })

  it('does not move command override options across an option terminator', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentCommandOverride: 'opencode --model opencode/from-override -- --model literal'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          '--model',
          'opencode/from-override',
          '--',
          '--model',
          'literal',
          'run',
          '--model',
          'opencode/gpt-5.4-mini',
          '--agent',
          'build',
          '--format',
          'default'
        ]
      }
    })
  })

  it('lets recipe args outrank a command override that also sets the model', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'opencode',
        model: 'opencode/gpt-5.4-mini',
        agentCommandOverride: 'opencode --model opencode/from-override',
        agentArgs: '--model opencode/from-recipe'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        binary: 'opencode',
        args: ['run', '--model', 'opencode/from-recipe', '--agent', 'build', '--format', 'default']
      }
    })
  })

  it('keeps custom per-action CLI arguments before a positional prompt', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent --message {prompt}',
        agentArgs: '--model gpt-5.5'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'agent',
        args: ['--message', '--model', 'gpt-5.5', 'PROMPT'],
        stdinPayload: null,
        label: 'agent'
      }
    })
  })

  it('appends custom per-action CLI arguments when the prompt is sent on stdin', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent --message',
        agentArgs: '--model gpt-5.5'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: ['--message', '--model', 'gpt-5.5'],
        stdinPayload: 'PROMPT'
      }
    })
  })

  it('rejects invalid per-action CLI arguments before spawning', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'haiku',
        agentArgs: '--model "unterminated'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: false,
      error: 'CLI arguments are invalid: Unclosed quote in command template.'
    })
  })

  it('rejects invalid preset agent command overrides before spawning', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'haiku',
        agentCommandOverride: 'claude "unterminated'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: false,
      error: 'Agent command override is invalid: Unclosed quote in command template.'
    })
  })
})

describe('backslash mode reaches every command the user can type (#11375)', () => {
  const WINDOWS_BINARY = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

  it('keeps an agent command override intact in literal mode', () => {
    const posix = planAgentBinary('claude', WINDOWS_BINARY)
    const literal = planAgentBinary('claude', WINDOWS_BINARY, 'literal')

    // The bug: POSIX escaping eats every separator, so the binary is not found.
    expect(posix.ok && posix.binary).toBe('C:WindowsSystem32WindowsPowerShellv1.0powershell.exe')
    expect(literal.ok && literal.binary).toBe(WINDOWS_BINARY)
  })

  it('keeps a quoted path containing spaces intact in literal mode', () => {
    const literal = planAgentBinary('claude', '"C:\\Program Files\\nodejs\\node.exe"', 'literal')

    expect(literal.ok && literal.binary).toBe('C:\\Program Files\\nodejs\\node.exe')
  })

  it('keeps extra CLI args intact through planCommitMessageGeneration', () => {
    const plan = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'sonnet',
        agentCommandOverride: WINDOWS_BINARY,
        agentArgs: '--config C:\\Users\\me\\.claude.json',
        backslash: 'literal'
      },
      'prompt'
    )

    expect(plan.ok && plan.plan.binary).toBe(WINDOWS_BINARY)
    expect(plan.ok && plan.plan.args).toContain('C:\\Users\\me\\.claude.json')
  })

  it('defaults to POSIX escaping when no mode is given', () => {
    const plan = planCommitMessageGeneration(
      { agentId: 'claude', model: 'sonnet', agentArgs: '--dir /my\\ dir' },
      'prompt'
    )

    expect(plan.ok && plan.plan.args).toContain('/my dir')
  })
})
