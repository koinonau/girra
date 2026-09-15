import { isPiTerminalTitle } from '../../../../shared/agent-detection'
import { titleHasAnyLegacyAgentName } from '../../../../shared/agent-name-token-match'

const EXTRA_TITLE_AGENT_TOKEN_RE = /(?<![\w./\\-])pi(?:\.(?:exe|cmd|bat|ps1))?(?![\w./\\-])/i

export function titleHasExplicitAgentIdentity(title: string): boolean {
  if (!title) {
    return false
  }
  if (
    title.startsWith('. ') ||
    title.startsWith('* ') ||
    title.startsWith('✳') ||
    isPiTerminalTitle(title)
  ) {
    return true
  }
  return titleHasAnyLegacyAgentName(title) || EXTRA_TITLE_AGENT_TOKEN_RE.test(title)
}
