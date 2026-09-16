// @vitest-environment happy-dom

/**
 * A record Girra switched off used to be indistinguishable from one the user
 * switched off — same "Paused", no reason, no next step. These pin the one new
 * state to the migration's own stamp, and pin the other two to reading exactly
 * as they did before it existed.
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Automation } from '../../../../shared/automations-types'
import { AutomationDetail } from './AutomationDetail'
import { makeAutomation } from './automations-page-fixtures'

const roots: Root[] = []

async function render(overrides: Partial<Automation>): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(
      <TooltipProvider>
        <AutomationDetail
          automation={makeAutomation(overrides)}
          runs={[]}
          projectName="orca"
          workspaceName="main"
          projectDefaultBaseRef="main"
          runNowAvailability={null}
          now={0}
          onRunNow={vi.fn()}
          onEdit={vi.fn()}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
        />
      </TooltipProvider>
    )
  })
  return container
}

function notice(container: HTMLDivElement): HTMLElement | null {
  return container.querySelector('[data-testid="automation-enablement-notice"]')
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount())
  })
  document.body.innerHTML = ''
})

describe('AutomationDetail enablement', () => {
  it('shows a paused record as a plain pause', async () => {
    const container = await render({ enabled: false })

    expect(container.textContent).toContain('Paused')
    expect(notice(container)).toBeNull()
  })

  it('shows a running automation as enabled', async () => {
    const container = await render({ enabled: true })

    expect(container.textContent).toContain('Enabled')
    expect(notice(container)).toBeNull()
  })

  it('keeps a paused automation whose agent was dropped from resuming', async () => {
    const container = await render({
      enabled: false,
      // Why: a profile saved before the roster shrank still carries the old id.
      agentId: 'retired-agent' as Automation['agentId']
    })

    expect(container.textContent).toContain('Agent no longer available')
    const resume = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resume automation"]'
    )
    expect(resume?.disabled).toBe(true)
  })

  it('lets a paused automation with a known agent resume', async () => {
    const container = await render({ enabled: false, agentId: 'opencode' })

    const resume = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resume automation"]'
    )
    expect(resume?.disabled).toBe(false)
  })
})
