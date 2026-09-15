// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsageFilterRadioGroup, UsageTrackingPaneShell } from './UsageTrackingPaneShell'

afterEach(cleanup)

function renderEnabled({
  hasData = false,
  isRefreshing = false
}: { hasData?: boolean; isRefreshing?: boolean } = {}) {
  const onEnabledChange = vi.fn()
  const onRefresh = vi.fn()
  const onScopeChange = vi.fn()

  render(
    <UsageTrackingPaneShell
      enabled
      title="OpenCode Usage Tracking"
      status="Updated now"
      isRefreshing={isRefreshing}
      hasData={hasData}
      enableLabel="Enable OpenCode usage analytics"
      optionsLabel="OpenCode usage options"
      filtersLabel="Filters"
      refreshAriaLabel="Refresh OpenCode usage"
      refreshLabel="Refresh"
      filterSections={[
        <UsageFilterRadioGroup
          key="scope"
          label="Scope"
          value="orca"
          options={[
            { value: 'orca', label: 'Orca worktrees only' },
            { value: 'all', label: 'All local usage' }
          ]}
          onValueChange={onScopeChange}
        />,
        <div key="range">Range filter</div>
      ]}
      selectionSummary="Orca worktrees only • Last 7 days"
      emptyMessage="No local OpenCode usage found yet for this scope."
      onEnabledChange={onEnabledChange}
      onRefresh={onRefresh}
      headerAction={<span>Share usage</span>}
    >
      <div>Ready content</div>
    </UsageTrackingPaneShell>
  )

  return { onEnabledChange, onRefresh, onScopeChange }
}

describe('UsageTrackingPaneShell', () => {
  it('renders the disabled state and enables tracking', async () => {
    const onEnabledChange = vi.fn()
    const user = userEvent.setup()
    render(
      <UsageTrackingPaneShell
        enabled={false}
        title="OpenCode Usage Tracking"
        disabledDescription="Reads local OpenCode usage logs."
        enableLabel="Enable OpenCode usage analytics"
        onEnabledChange={onEnabledChange}
      />
    )

    expect(screen.getByText('Reads local OpenCode usage logs.')).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Enable OpenCode usage analytics' }))
    expect(onEnabledChange).toHaveBeenCalledWith(true)
  })

  it('renders the empty state and wires header actions', async () => {
    const user = userEvent.setup()
    const { onEnabledChange, onRefresh, onScopeChange } = renderEnabled()

    expect(screen.getByText('Updated now')).toBeInTheDocument()
    expect(screen.getByText('Share usage')).toBeInTheDocument()
    expect(screen.getByText('Orca worktrees only • Last 7 days')).toBeInTheDocument()
    expect(
      screen.getByText('No local OpenCode usage found yet for this scope.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Ready content')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'OpenCode usage options' }))
    expect(screen.getByRole('separator')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitemradio', { name: 'All local usage' }))
    await user.click(screen.getByRole('button', { name: 'Refresh OpenCode usage' }))
    await user.click(screen.getByRole('switch', { name: 'Enable OpenCode usage analytics' }))
    expect(onScopeChange).toHaveBeenCalledWith('all')
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onEnabledChange).toHaveBeenCalledWith(false)
  })

  it('renders ready content and disables refresh while scanning', () => {
    renderEnabled({ hasData: true, isRefreshing: true })

    expect(screen.getByText('Ready content')).toBeInTheDocument()
    expect(
      screen.queryByText('No local OpenCode usage found yet for this scope.')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh OpenCode usage' })).toBeDisabled()
  })
})
