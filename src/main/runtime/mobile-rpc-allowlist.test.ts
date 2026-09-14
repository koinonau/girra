import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MOBILE_STREAMING_CLEANUP_RPC_METHODS = [
  // Why: shared-control unsubscribe methods are sent from generated cleanup
  // paths, so literal mobile source scanning cannot discover every one.
  'accounts.unsubscribe',
  'browser.screencast.unsubscribe',
  'notifications.unsubscribe',
  'runtime.clientEvents.unsubscribe',
  'session.tabs.unsubscribe',
  'session.tabs.unsubscribeAll',
  'terminal.unsubscribe'
]

function mobileRpcAllowlist(): Set<string> {
  const source = readFileSync(
    join(process.cwd(), 'src/main/runtime/runtime-rpc/runtime-rpc-mobile-method-allowlist.ts'),
    'utf8'
  )
  const allowlist = source.match(/const MOBILE_RPC_METHOD_ALLOWLIST = new Set\(\[([\s\S]*?)\]\)/)
  if (!allowlist) {
    throw new Error('MOBILE_RPC_METHOD_ALLOWLIST not found')
  }
  return new Set([...allowlist[1]!.matchAll(/'([^']+)'/g)].map((match) => match[1]!))
}

describe('mobile RPC allowlist', () => {
  it('allows every cleanup RPC for mobile streaming subscriptions', () => {
    const allowed = mobileRpcAllowlist()
    const missing = MOBILE_STREAMING_CLEANUP_RPC_METHODS.filter((method) => !allowed.has(method))

    expect(missing).toEqual([])
  })

  it('does not grant mobile credentials control over host updates', () => {
    const allowed = mobileRpcAllowlist()
    expect(
      ['updater.getStatus', 'updater.check', 'updater.download', 'updater.install'].filter(
        (method) => allowed.has(method)
      )
    ).toEqual([])
  })

  it('exposes only the mobile structured agent-session surface', () => {
    expect(
      [...mobileRpcAllowlist()].filter((method) => method.startsWith('agentSession.'))
    ).toEqual([
      'agentSession.createSupport',
      'agentSession.create',
      'agentSession.ensure',
      'agentSession.reveal',
      'agentSession.send',
      'agentSession.cancel',
      'agentSession.close',
      'agentSession.respondToApproval',
      'agentSession.respondToQuestion',
      'agentSession.setOption',
      'agentSession.handoffStatus',
      'agentSession.options',
      'agentSession.conversationCommand',
      'agentSession.commands',
      'agentSession.history',
      'agentSession.subscribe',
      'agentSession.unsubscribe',
      'agentSession.hold',
      'agentSession.release'
    ])
    expect(mobileRpcAllowlist().has('agentSession.attach')).toBe(false)
    expect(mobileRpcAllowlist().has('agentSession.requestHandoff')).toBe(false)
  })
})
