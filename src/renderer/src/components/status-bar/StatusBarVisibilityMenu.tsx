import { Activity, Plug, Server } from 'lucide-react'
import React from 'react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ClaudeIcon, MiniMaxIcon, OpenCodeGoIcon } from './icons'
import { translate } from '@/i18n/i18n'
import { isStatusBarItemAvailable } from './status-bar-agent-gating'
import type { StatusBarController } from './use-status-bar-controller'

export function StatusBarVisibilityMenu({
  controller
}: {
  controller: StatusBarController
}): React.JSX.Element {
  const {
    detectedAgentIds,
    menuOpen,
    menuPoint,
    recordFeatureInteraction,
    setMenuOpen,
    statusBarItems,
    toggleStatusBarItem
  } = controller

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute size-px opacity-0"
          style={{ left: menuPoint.x, top: menuPoint.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-0 w-fit" sideOffset={0} align="start">
        {isStatusBarItemAvailable('claude', detectedAgentIds) && (
          <DropdownMenuCheckboxItem
            checked={statusBarItems.includes('claude')}
            onCheckedChange={() => {
              recordFeatureInteraction('usage-tracking')
              toggleStatusBarItem('claude')
            }}
          >
            <ClaudeIcon size={14} />
            {translate('auto.components.status.bar.StatusBar.3885eb74d8', 'Claude Usage')}
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('opencode-go')}
          onCheckedChange={() => {
            recordFeatureInteraction('usage-tracking')
            toggleStatusBarItem('opencode-go')
          }}
        >
          <OpenCodeGoIcon size={14} />
          {translate('auto.components.status.bar.StatusBar.8c86cd77b0', 'OpenCode Go Usage')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('minimax')}
          onCheckedChange={() => {
            recordFeatureInteraction('usage-tracking')
            toggleStatusBarItem('minimax')
          }}
        >
          <MiniMaxIcon size={14} />
          {translate('auto.components.status.bar.StatusBar.3bbf140864', 'MiniMax Usage')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('ssh')}
          onCheckedChange={() => {
            recordFeatureInteraction('ssh')
            toggleStatusBarItem('ssh')
          }}
        >
          <Server className="size-3.5" />
          {translate('auto.components.status.bar.StatusBar.24ac89df1a', 'Remote Hosts')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('resource-usage')}
          onCheckedChange={() => {
            recordFeatureInteraction('resource-manager')
            toggleStatusBarItem('resource-usage')
          }}
        >
          <Activity className="size-3.5" />
          {translate('auto.components.status.bar.StatusBar.d1e1a7a6bf', 'Resource Manager')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('ports')}
          onCheckedChange={() => {
            recordFeatureInteraction('ports')
            toggleStatusBarItem('ports')
          }}
        >
          <Plug className="size-3.5" />
          {translate('auto.components.status.bar.StatusBar.9659e38343', 'Ports')}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
