import { TUI_AGENT_CONFIG } from './tui-agent-config'
import { getCommandTokenPathBasename, getFirstCommandToken } from './command-token-scanner'

/**
 * True when `agentType` names Pi. Pi emits milestone `agent_end` events between
 * steps while still working, so it is treated differently from agents that only
 * signal completion at turn end.
 */
export function isPiCompatibleAgentType(agentType: string | null | undefined): agentType is 'pi' {
  return agentType === 'pi'
}

function getLaunchBinary(command: string): string {
  return getCommandTokenPathBasename(getFirstCommandToken(command))
    .toLowerCase()
    .replace(/\.(?:cmd|exe|sh)$/, '')
}

const PI_LAUNCH_BINARY = getLaunchBinary(TUI_AGENT_CONFIG.pi.launchCmd)

/** True when the command's first token launches the Pi binary. */
export function isPiLaunchCommand(command: string | undefined): boolean {
  return getLaunchBinary(command ?? '') === PI_LAUNCH_BINARY
}
