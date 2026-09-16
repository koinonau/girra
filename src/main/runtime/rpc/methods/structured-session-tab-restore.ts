import type { RpcContext } from '../core'
import { supportsStructuredAgentSessions } from './structured-agent-session-policy'

/** Republishes structured tabs into the host's own snapshot map.
 *  Restoring spawns no provider child for a cleanly closed session. */
export async function restoreStructuredTabsIfSupported(
  context: Pick<RpcContext, 'runtime' | 'clientKind' | 'clientCapabilities'>
): Promise<void> {
  const shouldRestore = supportsStructuredAgentSessions(context)
  if (shouldRestore && typeof context.runtime.restoreStructuredAgentSessionTabs === 'function') {
    await context.runtime.restoreStructuredAgentSessionTabs()
  }
}
