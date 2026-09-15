import { describe, expect, it } from 'vitest'
import {
  clearNativeChatSessionOptionModel,
  narrowStructuredLaunchSeedOptions,
  resolveNativeChatSessionOptionDefaults,
  resolveStructuredLaunchSeedOptions,
  updateNativeChatSessionOptionDefaults
} from './native-chat-session-option-defaults'
import type { PersistedNativeChatSessionOptions } from './native-chat-session-options'

const persistedOpencode = (
  model: string | undefined,
  valuesByModel: Record<string, Record<string, string>> = {}
): PersistedNativeChatSessionOptions => ({
  opencode: { ...(model ? { model } : {}), valuesByModel }
})

describe('clearNativeChatSessionOptionModel', () => {
  it('drops the model a retired id would otherwise launch as -m', () => {
    const cleared = clearNativeChatSessionOptionModel(
      persistedOpencode('build-model', { 'build-model': { effort: 'low' } }),
      'opencode'
    )
    expect(cleared.opencode?.model).toBeUndefined()
    // Resolution keys off `model`, so clearing it is what stops the flag going out.
    expect(resolveNativeChatSessionOptionDefaults(cleared, 'opencode')).toBeUndefined()
  })

  it('keeps the per-model values so a reselect restores the old effort', () => {
    const cleared = clearNativeChatSessionOptionModel(
      persistedOpencode('build-model', { 'build-model': { effort: 'low' } }),
      'opencode'
    )
    expect(cleared.opencode?.valuesByModel).toEqual({ 'build-model': { effort: 'low' } })
    const reselected = updateNativeChatSessionOptionDefaults({
      persisted: cleared,
      agent: 'opencode',
      modelId: 'build-model',
      optionId: 'model',
      value: 'build-model'
    })
    expect(resolveNativeChatSessionOptionDefaults(reselected, 'opencode')).toEqual({
      model: 'build-model',
      effort: 'low'
    })
  })

  it('leaves every other agent untouched', () => {
    const cleared = clearNativeChatSessionOptionModel(
      { ...persistedOpencode('build-model'), claude: { model: 'opus', valuesByModel: {} } },
      'opencode'
    )
    expect(cleared.claude).toEqual({ model: 'opus', valuesByModel: {} })
  })

  it('is a no-op when nothing is persisted for the agent', () => {
    expect(clearNativeChatSessionOptionModel(undefined, 'opencode')).toEqual({})
    expect(clearNativeChatSessionOptionModel({}, 'opencode')).toEqual({})
    const untouched = persistedOpencode(undefined, { 'older-model': { effort: 'high' } })
    expect(clearNativeChatSessionOptionModel(untouched, 'opencode')).toEqual(untouched)
  })
})

describe('resolveNativeChatSessionOptionDefaults', () => {
  it('emits nothing until a model is explicitly picked, preserving the CLI default', () => {
    expect(resolveNativeChatSessionOptionDefaults(undefined, 'opencode')).toBeUndefined()
    expect(
      resolveNativeChatSessionOptionDefaults(persistedOpencode(undefined), 'opencode')
    ).toBeUndefined()
    expect(
      resolveNativeChatSessionOptionDefaults(persistedOpencode('   '), 'opencode')
    ).toBeUndefined()
  })

  it('returns a stale id verbatim, which is why retirement happens upstream', () => {
    // Nothing here validates the id against the host; a retired one still resolves
    // and becomes `-m <id>`. Only clearing the persisted value prevents that.
    expect(
      resolveNativeChatSessionOptionDefaults(persistedOpencode('build-model'), 'opencode')
    ).toEqual({
      model: 'build-model'
    })
  })
})

describe('resolveStructuredLaunchSeedOptions', () => {
  const persistedClaude = (
    valuesByModel: Record<string, Record<string, string | boolean>>
  ): PersistedNativeChatSessionOptions =>
    ({ claude: { model: 'opus', valuesByModel } }) as PersistedNativeChatSessionOptions

  it('seeds the saved model and effort a structured create must apply', () => {
    expect(
      resolveStructuredLaunchSeedOptions(persistedClaude({ opus: { effort: 'medium' } }), 'claude')
    ).toEqual({ model: 'opus', effort: 'medium' })
  })

  it('drops ids the providers only accept mid-session', () => {
    // `fastMode` is a boolean and `personality` is settable only mid-session;
    // neither belongs in the reservation's Record<string, string>.
    expect(
      resolveStructuredLaunchSeedOptions(
        persistedClaude({
          opus: { effort: 'high', fastMode: true, personality: 'concise' }
        }),
        'claude'
      )
    ).toEqual({ model: 'opus', effort: 'high' })
  })

  it('drops a seeded id whose persisted value is not a usable string', () => {
    // settings.json is user-writable, so a non-string `effort` must not reach a
    // record typed Record<string, string> and be emitted as a turn option.
    expect(
      resolveStructuredLaunchSeedOptions(persistedClaude({ opus: { effort: true } }), 'claude')
    ).toEqual({ model: 'opus' })
    expect(
      resolveStructuredLaunchSeedOptions(persistedClaude({ opus: { effort: '  ' } }), 'claude')
    ).toEqual({ model: 'opus' })
  })

  it('seeds nothing when the stored values empty the model out', () => {
    // `valuesByModel` is merged over the resolved model, so a stored `model` key
    // can blank it. Emitting `{ model: '' }` fails the record's bounded-string
    // guard, and that throw is not a wire refusal code — it escapes as a raw
    // error the client reads as unknown, stranding the launch with no fallback.
    expect(
      resolveStructuredLaunchSeedOptions(persistedClaude({ opus: { model: '' } }), 'claude')
    ).toBeUndefined()
  })

  it('seeds nothing until a model is picked, so the CLI default survives', () => {
    expect(resolveStructuredLaunchSeedOptions(undefined, 'claude')).toBeUndefined()
    expect(
      resolveStructuredLaunchSeedOptions({ claude: { valuesByModel: {} } }, 'claude')
    ).toBeUndefined()
  })
})

describe('narrowStructuredLaunchSeedOptions', () => {
  it('keeps the seedable ids an explicit selection names', () => {
    expect(narrowStructuredLaunchSeedOptions({ model: 'opus', effort: 'high' })).toEqual({
      model: 'opus',
      effort: 'high'
    })
  })

  it('drops ids no structured create may seed', () => {
    expect(
      narrowStructuredLaunchSeedOptions({ model: 'opus', mode: 'plan', fastMode: true })
    ).toEqual({ model: 'opus' })
  })

  it.each([
    ['nothing at all', {}],
    ['whitespace only', { model: '   ', effort: '\t' }],
    ['no usable string', { model: 5, effort: null }],
    ['undefined', undefined]
  ])('resolves %s to undefined rather than {}', (_name, values) => {
    // An empty map fails the durable record's bounded-string guard, and
    // `agent_session_options_invalid` is not a wire refusal code: the throw escapes as a raw
    // error the client reads as unknown, stranding the launch with no fallback.
    expect(narrowStructuredLaunchSeedOptions(values as never)).toBeUndefined()
  })
})
