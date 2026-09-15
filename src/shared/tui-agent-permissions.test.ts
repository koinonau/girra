import { describe, expect, it } from 'vitest'
import {
  applyAgentPermissionMode,
  resolveAgentPermissionModeSummary,
  YOLO_TUI_AGENT_ARGS,
  YOLO_TUI_AGENT_ENV
} from './tui-agent-permissions'

describe('tui agent permissions', () => {
  it('recognizes the current default profile as yolo', () => {
    expect(
      resolveAgentPermissionModeSummary({
        agentDefaultArgs: YOLO_TUI_AGENT_ARGS,
        agentDefaultEnv: YOLO_TUI_AGENT_ENV
      })
    ).toBe('yolo')
  })

  it('recognizes an empty profile as manual', () => {
    expect(resolveAgentPermissionModeSummary({ agentDefaultArgs: {}, agentDefaultEnv: {} })).toBe(
      'manual'
    )
  })

  it('preserves custom agent arguments when applying manual mode', () => {
    const result = applyAgentPermissionMode({
      mode: 'manual',
      agentDefaultArgs: {
        claude: '--dangerously-skip-permissions',
        'claude-agent-teams': '--model sonnet'
      },
      agentDefaultEnv: YOLO_TUI_AGENT_ENV
    })

    expect(result.agentDefaultArgs.claude).toBe('')
    expect(result.agentDefaultArgs['claude-agent-teams']).toBe('--model sonnet')
  })

  it('reports mixed when custom arguments are present', () => {
    expect(
      resolveAgentPermissionModeSummary({
        agentDefaultArgs: {
          ...YOLO_TUI_AGENT_ARGS,
          'claude-agent-teams': '--model sonnet'
        },
        agentDefaultEnv: YOLO_TUI_AGENT_ENV
      })
    ).toBe('mixed')
  })

  it('reports mixed when one agent is yolo and another is manual', () => {
    expect(
      resolveAgentPermissionModeSummary({
        agentDefaultArgs: { claude: YOLO_TUI_AGENT_ARGS.claude, 'claude-agent-teams': '' },
        agentDefaultEnv: {}
      })
    ).toBe('mixed')
  })

  it('ignores arguments for agents without a yolo flag', () => {
    expect(
      resolveAgentPermissionModeSummary({
        agentDefaultArgs: { opencode: '--model gpt-5' },
        agentDefaultEnv: {}
      })
    ).toBe('manual')
  })

  it('applies yolo mode to every agent with a yolo flag', () => {
    expect(applyAgentPermissionMode({ mode: 'yolo' }).agentDefaultArgs).toEqual(YOLO_TUI_AGENT_ARGS)
  })
})
