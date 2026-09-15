import { describe, expect, it } from 'vitest'
import {
  createAgentComboboxCommandState,
  resolveAgentComboboxCommandState,
  updateAgentComboboxCommandValue
} from './agent-combobox-command-state'

describe('agent combobox command state', () => {
  it('resets command highlight when the active query candidate changes while open', () => {
    const state = updateAgentComboboxCommandValue(
      createAgentComboboxCommandState('opencode'),
      'claude'
    )

    expect(resolveAgentComboboxCommandState(state, true, 'pi')).toEqual({
      commandValue: 'pi',
      activeCommandValue: 'pi'
    })
  })

  it('preserves hover selection while the active query candidate is unchanged', () => {
    const state = updateAgentComboboxCommandValue(
      createAgentComboboxCommandState('opencode'),
      'claude'
    )

    expect(resolveAgentComboboxCommandState(state, true, 'opencode')).toBe(state)
  })

  it('does not repair command highlight while the popover is closed', () => {
    const state = updateAgentComboboxCommandValue(
      createAgentComboboxCommandState('opencode'),
      'claude'
    )

    expect(resolveAgentComboboxCommandState(state, false, 'pi')).toBe(state)
  })

  it('reuses the same object when command value is unchanged', () => {
    const state = createAgentComboboxCommandState('opencode')

    expect(updateAgentComboboxCommandValue(state, 'opencode')).toBe(state)
    expect(resolveAgentComboboxCommandState(state, true, 'opencode')).toBe(state)
  })
})
