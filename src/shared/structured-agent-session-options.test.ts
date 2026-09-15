import { describe, expect, it } from 'vitest'
import { CLAUDE_SESSION_OPTION_CATALOG } from './agent-session-option-catalog-claude'
import { buildNativeChatSessionOptionSnapshot } from './native-chat-session-option-snapshot'
import { createNativeChatSessionOptionRecord } from './native-chat-session-option-state'
import {
  applyStructuredAgentSessionOptions,
  createStructuredAgentSessionOptionState,
  structuredAgentSessionOptionSnapshot
} from './structured-agent-session-options'

describe('structured agent session options', () => {
  it('projects native Claude selects on a separate transport from the bridge', () => {
    const state = applyStructuredAgentSessionOptions(
      createStructuredAgentSessionOptionState('claude'),
      CLAUDE_SESSION_OPTION_CATALOG,
      {
        models: [
          {
            id: 'account-model',
            label: 'Account Model',
            isDefault: true,
            defaultEffort: 'medium',
            efforts: [
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }
            ]
          }
        ],
        current: { model: 'account-model', effort: 'medium' }
      }
    )

    const structured = structuredAgentSessionOptionSnapshot(state)
    expect(structured.map((descriptor) => descriptor.id)).toEqual(['model', 'effort'])
    expect(structured[0]).toMatchObject({
      settable: true,
      kind: { type: 'select', currentValue: 'account-model' }
    })
    expect(structured[0]).not.toHaveProperty('action')
    expect(structured[1]).toMatchObject({
      settable: true,
      kind: { type: 'select', currentValue: 'medium' }
    })

    const bridgeRecord = createNativeChatSessionOptionRecord('claude')
    bridgeRecord.model = { value: 'opus', source: 'reported' }
    const bridge = buildNativeChatSessionOptionSnapshot({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record: bridgeRecord,
      mode: 'live',
      modelLabel: 'Model',
      liveTransport: 'catalog'
    })
    // Same catalog, same `dispatched` vocabulary — only the transport separates them.
    expect(structured.every((descriptor) => descriptor.transport === 'agent-session')).toBe(true)
    expect(bridge.every((descriptor) => descriptor.transport === 'catalog')).toBe(true)
    expect(bridge[0]).not.toHaveProperty('action')
  })

  it('uses provider-scoped models and retains the current unknown id', () => {
    const state = applyStructuredAgentSessionOptions(
      createStructuredAgentSessionOptionState('claude'),
      CLAUDE_SESSION_OPTION_CATALOG,
      {
        models: [
          {
            id: 'account-model',
            label: 'Account Model',
            isDefault: false,
            efforts: []
          }
        ],
        current: { model: 'persisted-unknown' }
      }
    )
    const model = structuredAgentSessionOptionSnapshot(state)[0]
    expect(
      model.kind.type === 'select' ? model.kind.choices.map((choice) => choice.value) : []
    ).toEqual(['account-model', 'persisted-unknown'])
    expect(model.kind.type === 'select' ? model.kind.currentValue : null).toBe('persisted-unknown')
  })

  it('projects live options as directly settable descriptors', () => {
    const state = applyStructuredAgentSessionOptions(
      createStructuredAgentSessionOptionState('claude'),
      CLAUDE_SESSION_OPTION_CATALOG,
      {
        models: [
          {
            id: 'account-model',
            label: 'Account Model',
            isDefault: true,
            defaultEffort: 'medium',
            efforts: [
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }
            ]
          }
        ],
        current: { model: 'account-model', effort: 'medium' }
      }
    )

    const snapshot = structuredAgentSessionOptionSnapshot(state)
    expect(snapshot.map((descriptor) => descriptor.id)).toEqual(['model', 'effort'])
    expect(snapshot.every((descriptor) => descriptor.settable)).toBe(true)
    expect(snapshot.every((descriptor) => descriptor.action === undefined)).toBe(true)
  })
})
