import { describe, expect, it } from 'vitest'
import { ORCHESTRATION_WORKER_LAUNCH_PREFERENCES_RUNTIME_CAPABILITY } from '../../../../../../shared/protocol-version'
import {
  assertWorkerLaunchPreferencesCreateTerminal,
  assertWorkerLaunchPreferencesRuntimeSupported,
  createPendingWorkerLaunchReceipt,
  resolveFederatedWorkerLaunchReceipt,
  resolveWorkerLaunchPreferences
} from './worker-launch-preferences'
import { WorkerStartParams } from './worker-start-schema'

describe('orchestration worker launch preferences', () => {
  it('passes an opaque Claude model and portable effort through the shared catalog', () => {
    expect(
      resolveWorkerLaunchPreferences({
        agent: 'claude',
        model: 'aws-bedrock-opus-5',
        effort: 'high'
      })
    ).toEqual({
      preferences: { model: 'aws-bedrock-opus-5', effort: 'high' },
      receipt: {
        requested: { agent: 'claude', model: 'aws-bedrock-opus-5', effort: 'high' },
        effective: { agent: 'claude', model: 'aws-bedrock-opus-5', effort: 'high' }
      }
    })
  })

  it('does not invent an effort when only a model is requested', () => {
    expect(resolveWorkerLaunchPreferences({ agent: 'claude', model: 'opus' }).preferences).toEqual({
      model: 'opus'
    })
  })

  it('rejects effort without a model', () => {
    expect(() => resolveWorkerLaunchPreferences({ agent: 'claude', effort: 'high' })).toThrow(
      '--effort requires --model'
    )
  })

  it('rejects model selection for agents without a launch catalog', () => {
    expect(() =>
      resolveWorkerLaunchPreferences({ agent: 'opencode', model: 'openai/gpt-5.4' })
    ).toThrow('does not support launch-time model selection')
  })

  it('rejects preferences when reusing an existing terminal', () => {
    expect(() =>
      assertWorkerLaunchPreferencesCreateTerminal({
        terminal: 'term_existing',
        model: 'gpt-5.6-sol'
      })
    ).toThrow('cannot be applied when reusing an existing terminal')
  })

  it('requires remote capability support only for explicit preferences', () => {
    expect(() =>
      assertWorkerLaunchPreferencesRuntimeSupported({
        model: 'gpt-5.6-sol',
        capabilities: [],
        serverName: 'windows'
      })
    ).toThrow('does not support worker model or effort overrides')
    expect(() =>
      assertWorkerLaunchPreferencesRuntimeSupported({
        capabilities: [],
        serverName: 'windows'
      })
    ).not.toThrow()
    expect(() =>
      assertWorkerLaunchPreferencesRuntimeSupported({
        model: 'gpt-5.6-sol',
        capabilities: [ORCHESTRATION_WORKER_LAUNCH_PREFERENCES_RUNTIME_CAPABILITY],
        serverName: 'windows'
      })
    ).not.toThrow()
  })

  it('refuses --retry-of beside --spec, which could only create a fresh Task', () => {
    const parsed = WorkerStartParams.safeParse({
      spec: 'redo it',
      retryOf: 'ctx_prior',
      agent: 'claude',
      from: 'term_coord'
    })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      '--retry-of needs --task <task_id> naming the failed Task; --spec creates a new one'
    )
    expect(
      WorkerStartParams.safeParse({
        task: 'task_1',
        retryOf: 'ctx_prior',
        agent: 'claude',
        from: 'term_coord'
      }).success
    ).toBe(true)
  })

  it('uses the requested launch receipt when an older worker omits it', () => {
    const requested = createPendingWorkerLaunchReceipt({
      agent: 'claude',
      model: 'gpt-5.6-sol',
      effort: 'high'
    })

    expect(resolveFederatedWorkerLaunchReceipt(undefined, requested, true)).toEqual({
      requested: requested.requested,
      effective: requested.requested
    })
    expect(resolveFederatedWorkerLaunchReceipt(undefined, requested, false)).toBe(requested)
  })

  it.each([' custom-model', 'custom-model '])(
    'rejects model ids with surrounding whitespace: %j',
    (model) => {
      expect(WorkerStartParams.safeParse({ task: 'task_1', agent: 'claude', model }).success).toBe(
        false
      )
    }
  )

  it('bounds opaque launch preferences', () => {
    expect(
      WorkerStartParams.safeParse({
        task: 'task_1',
        agent: 'claude',
        model: 'm'.repeat(513)
      }).success
    ).toBe(false)
    expect(
      WorkerStartParams.safeParse({
        task: 'task_1',
        agent: 'claude',
        model: 'custom-model',
        effort: 'e'.repeat(513)
      }).success
    ).toBe(false)
  })

  it('requires exactly one task identity', () => {
    expect(WorkerStartParams.safeParse({ agent: 'claude' }).success).toBe(false)
    expect(
      WorkerStartParams.safeParse({ task: 'task_1', spec: 'new work', agent: 'claude' }).success
    ).toBe(false)
    expect(
      WorkerStartParams.safeParse({ spec: 'new work', agent: 'claude', from: 'term_coord' }).success
    ).toBe(true)
  })
})
