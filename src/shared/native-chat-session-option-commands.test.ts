import { describe, expect, it, vi } from 'vitest'
import { CLAUDE_SESSION_OPTION_CATALOG } from './agent-session-option-catalog-claude'
import {
  buildNativeChatSessionOptionCommand,
  parseBuiltSessionOptionCommand,
  recordNativeChatSessionOptionCommand
} from './native-chat-session-option-commands'
import {
  createNativeChatSessionOptionRecord,
  type NativeChatSessionOptionRecord
} from './native-chat-session-option-state'

function claudeRecord(model?: string): NativeChatSessionOptionRecord {
  const record = createNativeChatSessionOptionRecord('claude')
  if (model) {
    record.model = { value: model, source: 'dispatched' }
  }
  return record
}

describe('buildNativeChatSessionOptionCommand', () => {
  it('builds the catalog midSession command for model and options', () => {
    expect(
      buildNativeChatSessionOptionCommand(CLAUDE_SESSION_OPTION_CATALOG.modelApply, 'opus')
    ).toBe('/model opus')
    const effortApply = CLAUDE_SESSION_OPTION_CATALOG.models
      .find((model) => model.id === 'sonnet')!
      .options.find((option) => option.id === 'effort')!.apply
    expect(buildNativeChatSessionOptionCommand(effortApply, 'high')).toBe('/effort high')
  })

  it('returns the bare toggle command for flip-only options', () => {
    const fastModeApply = CLAUDE_SESSION_OPTION_CATALOG.models
      .find((model) => model.id === 'opus')!
      .options.find((option) => option.id === 'fastMode')!.apply
    expect(buildNativeChatSessionOptionCommand(fastModeApply, true)).toBe('/fast')
  })
})

describe('parseBuiltSessionOptionCommand', () => {
  it('recovers the value from a built command and rejects other text', () => {
    const build = (value: unknown): string => `/model ${String(value)}`
    expect(parseBuiltSessionOptionCommand(build, '/model opus')).toBe('opus')
    expect(parseBuiltSessionOptionCommand(build, '/effort high')).toBeNull()
    expect(parseBuiltSessionOptionCommand(build, '/model ')).toBeNull()
  })
})

describe('recordNativeChatSessionOptionCommand', () => {
  it('tracks a typed /model value as dispatched truth', () => {
    const record = claudeRecord()
    const result = recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      command: '/model sonnet'
    })
    expect(result).toEqual({ changed: true, opensAgentPicker: false })
    expect(record.model).toEqual({ value: 'sonnet', source: 'dispatched' })
  })

  it('tracks a typed option value under the current model', () => {
    const record = claudeRecord('sonnet')
    recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      command: '/effort low'
    })
    expect(record.valuesByModel.sonnet?.effort).toEqual({ value: 'low', source: 'dispatched' })
  })

  it('clears tracked truth for a bare picker command and reports the agent picker', () => {
    const record = claudeRecord('sonnet')
    const result = recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      command: '/model'
    })
    expect(result).toEqual({ changed: true, opensAgentPicker: true })
    expect(record.model).toBeUndefined()
  })

  it('clears a flip-only toggle’s tracked baseline on a typed flip', () => {
    const record = claudeRecord('opus')
    record.valuesByModel.opus = { fastMode: { value: true, source: 'applied' } }
    recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      command: '/fast'
    })
    // A typed flip inverts an unknown-to-us direction; the baseline is gone.
    expect(record.valuesByModel.opus?.fastMode).toBeUndefined()
  })

  it('rejects prose that merely starts with a command template', () => {
    // The `/model ` prefix matches this, so an unvalidated parse tracked
    // "is a weird word" as the current model — which then rendered as the pill
    // label and, matching no catalog model, dropped every per-model option.
    const record = claudeRecord('sonnet')
    expect(
      recordNativeChatSessionOptionCommand({
        catalog: CLAUDE_SESSION_OPTION_CATALOG,
        models: CLAUDE_SESSION_OPTION_CATALOG.models,
        record,
        command: '/model is a weird word'
      })
    ).toEqual({ changed: false, opensAgentPicker: false })
    expect(record.model).toEqual({ value: 'sonnet', source: 'dispatched' })
  })

  it('rejects an option value outside the catalog choices', () => {
    const record = claudeRecord('sonnet')
    recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      command: '/effort of will is required'
    })
    expect(record.valuesByModel.sonnet?.effort).toBeUndefined()
  })

  it('tracks nothing for a multi-line paste whose first line looks like a command', () => {
    const record = claudeRecord('opus')
    recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: CLAUDE_SESSION_OPTION_CATALOG.models,
      record,
      command: '/model sonnet\nplease review this'
    })
    expect(record.model).toEqual({ value: 'opus', source: 'dispatched' })
  })

  it('still accepts an alias, a full provider id, and extra spacing', () => {
    for (const [command, expected] of [
      ['/model opus', 'opus'],
      ['/model claude-sonnet-5', 'sonnet'],
      ['/model  sonnet', 'sonnet']
    ] as const) {
      const record = claudeRecord()
      recordNativeChatSessionOptionCommand({
        catalog: CLAUDE_SESSION_OPTION_CATALOG,
        models: CLAUDE_SESSION_OPTION_CATALOG.models,
        record,
        command
      })
      expect(record.model).toEqual({ value: expected, source: 'dispatched' })
    }
  })

  it('still tracks an alias the active model list no longer carries', () => {
    // Per-host discovery can drop the `opus` alias; typing it is still valid and
    // callers reconcile the row back, so rejecting it would lose the selection.
    const record = claudeRecord('sonnet')
    const discovered = CLAUDE_SESSION_OPTION_CATALOG.models.filter((model) => model.id !== 'opus')
    recordNativeChatSessionOptionCommand({
      catalog: CLAUDE_SESSION_OPTION_CATALOG,
      models: discovered,
      record,
      command: '/model opus'
    })
    expect(record.model).toEqual({ value: 'opus', source: 'dispatched' })
  })

  it('ignores unrelated commands', () => {
    const record = claudeRecord('sonnet')
    expect(
      recordNativeChatSessionOptionCommand({
        catalog: CLAUDE_SESSION_OPTION_CATALOG,
        models: CLAUDE_SESSION_OPTION_CATALOG.models,
        record,
        command: '/clear'
      })
    ).toEqual({ changed: false, opensAgentPicker: false })
  })
})

describe('recordNativeChatSessionOptionCommand under a CLI default model', () => {
  const catalog = { ...CLAUDE_SESSION_OPTION_CATALOG, defaultModelIsCliDefault: true as const }

  function record(command: string, target = claudeRecord(), persist = vi.fn()) {
    const result = recordNativeChatSessionOptionCommand({
      catalog,
      models: catalog.models,
      record: target,
      command,
      persist
    })
    return { result, target, persist }
  }

  it('tracks a typed effort under the CLI default when no model was picked', () => {
    // Regression: the picker draws the effort row under the CLI default, so reading the
    // tracked model alone dropped the very command that row's pill reports on.
    const { result, target, persist } = record('/effort low')
    expect(result).toEqual({ changed: true, opensAgentPicker: false })
    expect(target.valuesByModel.sonnet?.effort).toEqual({ value: 'low', source: 'dispatched' })
    expect(persist).toHaveBeenCalledWith('sonnet', 'effort', 'low')
  })

  it('does not reset tracked state when the typed model is the CLI default already shown', () => {
    const { target } = record('/effort low')
    record('/model sonnet', target)
    expect(target.valuesByModel.sonnet?.effort).toEqual({ value: 'low', source: 'dispatched' })
  })

  it('still keeps the default model state when the typed model is a real switch', () => {
    const { target } = record('/effort low')
    record('/model opus', target)
    expect(target.model).toEqual({ value: 'opus', source: 'dispatched' })
    expect(target.valuesByModel.sonnet?.effort).toEqual({ value: 'low', source: 'dispatched' })
  })
})
