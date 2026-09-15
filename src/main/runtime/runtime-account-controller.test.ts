import { describe, expect, it, vi } from 'vitest'
import { RuntimeAccountController, type RuntimeAccountServices } from './runtime-account-controller'

describe('RuntimeAccountController', () => {
  it('keeps the retired Codex slot in snapshots for older paired clients', () => {
    let publish: ((state: never) => void) | undefined
    const controller = new RuntimeAccountController()
    controller.setServices({
      claudeAccounts: { listAccounts: () => ({ accounts: [], activeAccountId: null }) },
      rateLimits: {
        getState: () => 'state',
        onStateChange: (listener: (state: never) => void) => {
          publish = listener
          return () => {}
        }
      }
    } as unknown as RuntimeAccountServices)
    const listener = vi.fn()

    controller.onChanged(listener)
    publish?.('next' as never)

    const retired = { accounts: [], activeAccountId: null }
    expect(controller.getSnapshot().codex).toEqual(retired)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ codex: retired }))
  })
})
