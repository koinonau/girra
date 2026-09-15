import type React from 'react'
import { ClaudeIcon } from '@/components/status-bar/icons'
import type { TuiAgent } from '../../../shared/tui-agent'
import { getTuiAgentLaunchCommand, TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'
import { AgentLetterIcon, OpenCodeIcon, PiIcon } from './agent-icon-glyphs'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export type AgentCatalogEntry = {
  id: TuiAgent
  label: string
  /** Default CLI binary name used for PATH detection. */
  cmd: string
  /** Homepage/install docs URL, sourced from the README agent badge list. */
  homepageUrl: string
}

function getCatalogPlatform(): NodeJS.Platform {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (userAgent.includes('Windows')) {
    return 'win32'
  }
  if (userAgent.includes('Mac')) {
    return 'darwin'
  }
  if (userAgent) {
    return 'linux'
  }
  return typeof process === 'undefined' ? 'linux' : process.platform
}

export const getAgentCatalog = createLocalizedCatalog((): AgentCatalogEntry[] => [
  {
    id: 'claude',
    label: translate('auto.lib.agent.catalog.0708ed89f1', 'Claude'),
    cmd: 'claude',
    homepageUrl: 'https://code.claude.com/docs'
  },
  {
    id: 'claude-agent-teams',
    label: translate('auto.lib.agent.catalog.bf53f09bf8', 'Claude Agent Teams'),
    cmd: getTuiAgentLaunchCommand(TUI_AGENT_CONFIG['claude-agent-teams'], getCatalogPlatform()),
    homepageUrl: 'https://code.claude.com/docs/en/agent-teams'
  },
  {
    id: 'opencode',
    label: translate('auto.lib.agent.catalog.e7a4ca5103', 'OpenCode'),
    cmd: 'opencode',
    homepageUrl: 'https://opencode.ai/docs/cli/'
  },
  {
    id: 'pi',
    label: translate('auto.lib.agent.catalog.302934c5d9', 'Pi'),
    cmd: 'pi',
    homepageUrl: 'https://pi.dev'
  }
])

// Why: tests and a few legacy call sites still import a catalog snapshot.
export const AGENT_CATALOG: AgentCatalogEntry[] = getAgentCatalog()

export function getAgentLabel(agent: TuiAgent): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

export function AgentIcon({
  agent,
  size = 14
}: {
  agent: TuiAgent | null | undefined
  size?: number
}): React.JSX.Element {
  // Why: render a neutral glyph while the agent identity is unknown rather
  // than guessing Claude until the first hook callback arrives.
  if (!agent) {
    return <AgentLetterIcon letter="?" size={size} />
  }
  if (agent === 'claude' || agent === 'claude-agent-teams') {
    return <ClaudeIcon size={size} />
  }
  if (agent === 'pi') {
    return <PiIcon size={size} />
  }
  if (agent === 'opencode') {
    return <OpenCodeIcon size={size} />
  }
  // Why: a stale persisted id from a dropped agent still gets a neutral glyph.
  return <AgentLetterIcon letter={String(agent).charAt(0).toUpperCase()} size={size} />
}
