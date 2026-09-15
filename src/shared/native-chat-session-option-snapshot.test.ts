import { describe, expect, it } from 'vitest'
import {
  sessionOptionDispatchUnconfirmed,
  type SessionOptionDescriptor
} from './native-chat-session-options'
import { CLAUDE_SESSION_OPTION_CATALOG } from './agent-session-option-catalog-claude'
import { resolveAgentSessionOptionLaunch } from './agent-session-option-launch'
import {
  createNativeChatSessionOptionRecord,
  type NativeChatSessionOptionRecord
} from './native-chat-session-option-state'
import {
  buildNativeChatSessionOptionSnapshot,
  sortNativeChatSessionOptions,
  withTrackedNativeChatModel
} from './native-chat-session-option-snapshot'

function claudeRecord(): NativeChatSessionOptionRecord {
  return createNativeChatSessionOptionRecord('claude')
}

describe('buildNativeChatSessionOptionSnapshot', () => {
  // The producer names its lane once, here; `dispatched` is emitted by both and
  // is not evidence of which one, so the descriptor has to carry the answer.
  it.each(['catalog', 'agent-session'] as const)(
    'stamps every descriptor with the %s transport it was built for',
    (liveTransport) => {
      const record = claudeRecord()
      record.model = { value: 'sonnet', source: 'dispatched' }
      const snapshot = buildNativeChatSessionOptionSnapshot({
        catalog: CLAUDE_SESSION_OPTION_CATALOG,
        models: CLAUDE_SESSION_OPTION_CATALOG.models,
        record,
        mode: 'live',
        modelLabel: 'Model',
        liveTransport
      })
      expect(snapshot.length).toBeGreaterThan(1)
      expect(snapshot.every((descriptor) => descriptor.transport === liveTransport)).toBe(true)
      const dispatched = snapshot.filter((descriptor) => descriptor.valueSource === 'dispatched')
      expect(dispatched.length).toBeGreaterThan(0)
      expect(dispatched.every(sessionOptionDispatchUnconfirmed)).toBe(liveTransport === 'catalog')
    }
  )

  it('offers every catalog model with the current value unknown', () => {
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record: claudeRecord(),
      mode: 'live',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    expect(snapshot).toHaveLength(1)
    const model = snapshot[0]!
    expect(model).toMatchObject({ id: 'model', category: 'model', valueSource: 'unknown' })
    if (model.kind.type !== 'select') {
      throw new Error('model descriptor must be a select')
    }
    expect(model.kind.currentValue).toBeUndefined()
    expect(model.kind.choices.map((choice) => choice.value)).toEqual(
      CLAUDE_SESSION_OPTION_CATALOG.models.map((catalogModel) => catalogModel.id)
    )
  })

  it('adds the tracked model’s options once the model is known', () => {
    const record = claudeRecord()
    record.model = { value: 'sonnet', source: 'dispatched' }
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      mode: 'live',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    expect(snapshot.map((descriptor) => descriptor.id)).toEqual(['model', 'effort'])
    expect(snapshot[0]).toMatchObject({ valueSource: 'dispatched' })
  })

  it('renders exactly the models it is given, without self-healing the tracked one', () => {
    // The builder no longer appends the tracked model itself — reconciling it is
    // the caller's job (withTrackedNativeChatModel), so every row is a real choice.
    const record = claudeRecord()
    record.model = { value: 'experimental-model', source: 'reported' }
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      mode: 'live',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    const model = snapshot[0]!
    if (model.kind.type !== 'select') {
      throw new Error('model descriptor must be a select')
    }
    expect(model.kind.choices.map((choice) => choice.value)).toEqual(
      CLAUDE_SESSION_OPTION_CATALOG.models.map((catalogModel) => catalogModel.id)
    )
  })

  it('is empty when the model list is empty', () => {
    expect(
      buildNativeChatSessionOptionSnapshot({
        catalog: CLAUDE_SESSION_OPTION_CATALOG,
        models: [],
        record: claudeRecord(),
        mode: 'live',
        modelLabel: 'Model',
        liveTransport: 'catalog'
      })
    ).toEqual([])
  })

  describe('sortNativeChatSessionOptions', () => {
    it('drops the model row and orders effort before model config before modes', () => {
      const descriptor = (id: string, category?: string): SessionOptionDescriptor =>
        ({
          id,
          label: id,
          ...(category ? { category } : {}),
          kind: { type: 'boolean' },
          valueSource: 'unknown',
          settable: true
        }) as SessionOptionDescriptor
      const sorted = sortNativeChatSessionOptions([
        descriptor('model', 'model'),
        descriptor('uncategorized'),
        descriptor('vim', 'mode'),
        descriptor('fastMode', 'model_config'),
        descriptor('effort', 'thought_level')
      ])
      expect(sorted.map((entry) => entry.id)).toEqual([
        'effort',
        'fastMode',
        'vim',
        'uncategorized'
      ])
    })
  })

  describe('withTrackedNativeChatModel', () => {
    it('keeps an unlisted tracked model as a choice, preferring the seed row', () => {
      const record = claudeRecord()
      record.model = { value: 'opus', source: 'reported' }
      // A discovered list that dropped the `opus` alias this host no longer lists.
      const discovered = CLAUDE_SESSION_OPTION_CATALOG.models.filter((model) => model.id !== 'opus')
      const reconciled = withTrackedNativeChatModel(
        CLAUDE_SESSION_OPTION_CATALOG,
        discovered,
        record
      )
      const restored = reconciled.find((model) => model.id === 'opus')
      expect(restored).toBeDefined()
      // The seed row carries the model's own options, so they don't vanish.
      expect(restored!.options.length).toBeGreaterThan(0)
      const snapshot = buildNativeChatSessionOptionSnapshot({
        catalog: CLAUDE_SESSION_OPTION_CATALOG,
        models: reconciled,
        record,
        mode: 'live',
        modelLabel: 'Model',
        liveTransport: 'catalog'
      })
      const model = snapshot[0]!
      if (model.kind.type !== 'select') {
        throw new Error('model descriptor must be a select')
      }
      expect(model.kind.currentValue).toBe('opus')
      expect(model.kind.choices.some((choice) => choice.value === 'opus')).toBe(true)
      expect(snapshot.length).toBeGreaterThan(1)
    })

    it('labels a wholly unknown tracked model by its id rather than dropping it', () => {
      const record = claudeRecord()
      record.model = { value: 'experimental-model', source: 'reported' }
      const reconciled = withTrackedNativeChatModel(
        CLAUDE_SESSION_OPTION_CATALOG,
        CLAUDE_SESSION_OPTION_CATALOG.models,
        record
      )
      expect(reconciled.at(-1)).toEqual({
        id: 'experimental-model',
        label: 'experimental-model',
        options: []
      })
    })

    it('leaves the list alone when the tracked model is already listed', () => {
      const record = claudeRecord()
      record.model = { value: 'sonnet', source: 'reported' }
      expect(
        withTrackedNativeChatModel(
          CLAUDE_SESSION_OPTION_CATALOG,
          CLAUDE_SESSION_OPTION_CATALOG.models,
          record
        )
      ).toEqual([...CLAUDE_SESSION_OPTION_CATALOG.models])
    })
  })

  it('marks flip-only toggles without a baseline as toggle actions', () => {
    const record = claudeRecord()
    record.model = { value: 'opus', source: 'reported' }
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      mode: 'live',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    const fastMode = snapshot.find((descriptor) => descriptor.id === 'fastMode')
    expect(fastMode).toMatchObject({ action: { type: 'toggle-command' } })
  })
})

describe('defaults on load', () => {
  // Structured sessions mark the probed default as the CLI's own choice.
  const cliDefaultCatalog = {
    ...CLAUDE_SESSION_OPTION_CATALOG,
    defaultModelIsCliDefault: true as const
  }
  const cliDefaultDraft = (
    models = cliDefaultCatalog.models,
    mode: 'draft' | 'live' = 'draft'
  ): SessionOptionDescriptor[] =>
    buildNativeChatSessionOptionSnapshot({
      catalog: cliDefaultCatalog,
      models,
      record: claudeRecord(),
      mode,
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })

  it('shows the default model before anything is picked', () => {
    const model = cliDefaultDraft()[0]!
    expect(model).toMatchObject({ id: 'model', valueSource: 'default' })
    expect(model.kind.type === 'select' ? model.kind.currentValue : null).toBe('sonnet')
  })

  it('offers the effort row under that default model without naming its value', () => {
    // With no model picked the launch sends no effort flag, so the CLI's choice is unknowable.
    const effort = cliDefaultDraft().find((descriptor) => descriptor.id === 'effort')
    expect(effort).toMatchObject({ valueSource: 'unknown' })
    expect(effort?.kind.type === 'select' ? effort.kind.currentValue : null).toBeUndefined()
  })

  it('names the CLI default in a live session too, where the picker actually renders', () => {
    const live = cliDefaultDraft(cliDefaultCatalog.models, 'live')
    expect(live[0]).toMatchObject({ id: 'model', valueSource: 'default' })
    expect(live[0]!.kind.type === 'select' ? live[0]!.kind.currentValue : null).toBe('sonnet')
    expect(live.find((descriptor) => descriptor.id === 'effort')).toMatchObject({
      valueSource: 'unknown'
    })
  })

  it('names no model when the list no longer carries a default', () => {
    // Guessing a replacement would misreport which model the launch actually picks.
    const snapshot = cliDefaultDraft(cliDefaultCatalog.models.filter((model) => !model.isDefault))
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0]).toMatchObject({ valueSource: 'unknown' })
  })

  it('leaves a tracked pick as the authority over the default', () => {
    const record = claudeRecord()
    record.model = { value: 'opus', source: 'dispatched' }
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: cliDefaultCatalog,
      models: cliDefaultCatalog.models,
      record,
      mode: 'draft',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    expect(snapshot[0]).toMatchObject({ valueSource: 'dispatched' })
    expect(snapshot[0]!.kind.type === 'select' ? snapshot[0]!.kind.currentValue : null).toBe('opus')
  })

  it('shows no default for an agent whose isDefault is only decorative', () => {
    // Claude's real default comes from the account and the user's settings, and an
    // untouched draft sends no --model, so naming the seed's `sonnet` would be a guess.
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record: claudeRecord(),
      mode: 'draft',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    expect(CLAUDE_SESSION_OPTION_CATALOG.models.some((model) => model.isDefault)).toBe(true)
    expect(CLAUDE_SESSION_OPTION_CATALOG.defaultModelIsCliDefault).toBeUndefined()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0]).toMatchObject({ valueSource: 'unknown' })
  })

  it('still shows an option default once a model is actually picked', () => {
    // Not a guess: launch reads `values[id] ?? defaultValue`, so this is the flag it emits.
    const record = claudeRecord()
    record.model = { value: 'sonnet', source: 'applied' }
    const snapshot = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      mode: 'draft',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    const effort = snapshot.find((descriptor) => descriptor.id === 'effort')
    expect(effort).toMatchObject({ valueSource: 'default' })
    expect(effort?.kind.type === 'select' ? effort.kind.currentValue : null).toBeDefined()
  })

  it('does not turn a shown default into a launch flag', () => {
    // Display is not authorization: only a persisted pick may emit `-m`.
    expect(resolveAgentSessionOptionLaunch('claude', undefined)).toEqual({
      args: [],
      appliedValues: {}
    })
  })
})
