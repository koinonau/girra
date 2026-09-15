import { getPtyIdForPaneKey } from '../ipc/pty'
import type { AgentStatusState } from '../../shared/agent-status-types'
import type { SyntheticAgentTitleProfile } from '../../shared/synthetic-agent-title'
import { shouldCopySyntheticTitleFrameToPtyData } from '../synthetic-title-frame-routing'
import { mainProcessState as state } from './main-process-state'

function sendSyntheticTitle(ptyId: string, data: string): void {
  const window = state.mainWindow
  if (!window || window.isDestroyed()) {
    return
  }
  // Why: feed the per-PTY tracker directly, never onPtyData — emulator/tails/transcripts/stats must not see fabricated bytes.
  state.runtime?.ingestSyntheticTitleFrame(ptyId, data)
  // Why: only the kill-switch-off renderer byte-parses synthetic frames; under main authority the copy mints phantom ACKs (see synthetic-title-frame-routing.ts).
  if (shouldCopySyntheticTitleFrameToPtyData(state.store?.getSettings())) {
    window.webContents.send('pty:data', { id: ptyId, data })
  }
}

export function driveSyntheticTitleFromHook(
  paneKey: string,
  agentState: AgentStatusState,
  profile: SyntheticAgentTitleProfile
): void {
  const ptyId = getPtyIdForPaneKey(paneKey)
  // Why: kept agents animate their own working titles, so only terminal frames are synthesized.
  if (!ptyId || agentState === 'working') {
    return
  }
  // Permission frames add a trailing BEL to light up user-input states; done frames omit it (completion notifications own that attention).
  const needsUserInput = agentState === 'blocked' || agentState === 'waiting'
  const label = needsUserInput ? profile.permissionLabel : profile.idleLabel
  sendSyntheticTitle(ptyId, `\x1b]0;${label}\x07${needsUserInput ? '\x07' : ''}`)
}
