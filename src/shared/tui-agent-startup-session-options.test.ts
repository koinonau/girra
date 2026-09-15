import { describe, expect, it } from 'vitest'
import {
  buildAgentDraftLaunchPlan,
  buildAgentResumeStartupPlan,
  buildAgentStartupPlan
} from './tui-agent-startup'
import { resolveAgentLaunchCommand } from './tui-agent-launch-command'

describe('tui agent startup session options', () => {
  it('emits catalog options before user arguments without recording an overridden model', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true,
      sessionOptions: { model: 'opus', effort: 'xhigh', fastMode: true },
      agentArgs: '--model haiku'
    })
    expect(plan?.launchCommand).toBe("claude '--model' 'opus' '--effort' 'xhigh' '--model' 'haiku'")
    expect(plan?.sessionOptions).toBeUndefined()
  })

  it('keeps the model record but drops an effort overridden by user arguments', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true,
      sessionOptions: { model: 'opus', effort: 'xhigh' },
      agentArgs: '--effort low'
    })
    expect(plan?.sessionOptions).toEqual({ model: 'opus' })
  })

  it('lets explicit worker preferences override general agent arguments', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true,
      sessionOptions: { model: 'custom-claude-model', effort: 'high' },
      sessionOptionsOverrideAgentArgs: true,
      agentArgs: '--model sonnet --effort low'
    })
    expect(plan?.launchCommand).toBe("claude '--model' 'custom-claude-model' '--effort' 'high'")
    expect(plan?.launchConfig.agentCommand).toBe("claude '--model' 'sonnet' '--effort' 'low'")
    expect(plan?.sessionOptions).toEqual({ model: 'custom-claude-model', effort: 'high' })
  })

  it('inserts worker preferences before an argument terminator', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true,
      sessionOptions: { model: 'custom-claude-model', effort: 'high' },
      sessionOptionsOverrideAgentArgs: true,
      agentArgs: '--dangerously-skip-permissions -- literal'
    })
    expect(plan?.launchCommand).toBe(
      "claude '--dangerously-skip-permissions' '--model' 'custom-claude-model' '--effort' 'high' '--' 'literal'"
    )
  })

  it('rejects conflicting singleton flags in an agent command override', () => {
    expect(
      resolveAgentLaunchCommand({
        agent: 'claude',
        cmdOverrides: { claude: 'claude --verbose --model sonnet' },
        platform: 'linux',
        shell: 'posix',
        sessionOptions: { model: 'custom-claude-model', effort: 'high' },
        sessionOptionsOverrideAgentArgs: true
      })
    ).toEqual({
      ok: false,
      error:
        'Agent command override conflicts with the requested launch preferences. Remove model or effort flags from the command override.'
    })
  })

  it('keeps one-time picker flags out of the command captured for resume', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true,
      sessionOptions: { model: 'opus', effort: 'medium' },
      agentArgs: '--dangerously-skip-permissions'
    })
    expect(plan?.launchConfig.agentCommand).toBe("claude '--dangerously-skip-permissions'")
  })

  it('quotes option values for a remote POSIX launch', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      isRemote: true,
      allowEmptyPromptLaunch: true,
      sessionOptions: { model: "team's-model", effort: 'high' }
    })
    expect(plan?.launchCommand).toContain(`'team'"'"'s-model'`)
  })

  it('threads options through native draft launches', () => {
    const plan = buildAgentDraftLaunchPlan({
      agent: 'claude',
      draft: 'review this',
      cmdOverrides: {},
      platform: 'linux',
      sessionOptions: { model: 'opus', effort: 'high' }
    })
    expect(plan?.launchCommand).toContain("claude '--model' 'opus' '--effort' 'high'")
    expect(plan?.sessionOptions).toEqual({ model: 'opus', effort: 'high' })
  })

  it('applies explicit session options to resume commands', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: 'thread-1' },
      cmdOverrides: {},
      platform: 'linux',
      agentArgs: '--model sonnet --effort medium',
      sessionOptions: { model: 'opus', effort: 'high' },
      sessionOptionsOverrideAgentArgs: true
    })
    expect(plan?.launchCommand).toBe(
      "claude '--model' 'opus' '--effort' 'high' '--resume' 'thread-1'"
    )
    expect(plan?.launchConfig.agentCommand).toBe("claude '--model' 'sonnet' '--effort' 'medium'")
    expect(plan?.sessionOptions).toEqual({ model: 'opus', effort: 'high' })
  })
})
