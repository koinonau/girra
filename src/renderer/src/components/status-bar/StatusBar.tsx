import React from 'react'
import { StatusBarSurface } from './StatusBarSurface'

export {
  buildClaudeStatusSwitchGroups,
  getClaudeStatusActiveId,
  normalizeClaudeStatusRuntimeTarget,
  resolveClaudeStatusAccountState
} from './status-bar-claude-accounts'
export {
  getStatusBarPreferredWslDistro,
  type ClaudeStatusSwitchGroup,
  type AccountStatusRuntimeTarget,
  type ClaudeStatusSwitchTarget
} from './status-bar-runtime-targets'
export { ClaudeSwitcherMenu } from './ClaudeSwitcherMenu'
export { InlineUsageBars } from './InlineProviderUsage'
export { ProviderDetailsMenu } from './ProviderDetailsMenu'
export { ProviderSegment } from './StatusBarProviderSegment'

export const StatusBar = React.memo(StatusBarSurface)
