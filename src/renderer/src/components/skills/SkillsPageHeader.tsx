import { BookOpen, Download, MoreHorizontal, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { skillCountLabel } from './skill-display-labels'
import { SKILLS_PAGE_COLUMN } from './skills-page-column'
import { SkillsSourcesPopover } from './SkillsSourcesPopover'
import type { SkillSourceInventoryEntry } from './skill-source-inventory'
import type { KotharSshInstallTarget } from './use-kothar-install-targets'

function MenuItemWithReason({
  disabled,
  reason,
  destructive = false,
  onSelect,
  children
}: {
  disabled: boolean
  reason: string | null
  destructive?: boolean
  onSelect: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="pointer-events-auto block">
          <DropdownMenuItem
            variant={destructive ? 'destructive' : 'default'}
            disabled={disabled}
            onSelect={onSelect}
          >
            {children}
          </DropdownMenuItem>
        </span>
      </TooltipTrigger>
      {disabled && reason ? (
        <TooltipContent side="left" sideOffset={4}>
          {reason}
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}

export function SkillsPageHeader({
  skillCount,
  sourceEntries,
  scannedSourceCount,
  hostLabel,
  onClose,
  deleteSupported,
  deleteUnsupportedReason,
  onStartDelete,
  installKotharDisabled,
  installKotharDisabledReason,
  onInstallKothar,
  sshInstallTargets,
  onInstallKotharOnSshHost
}: {
  skillCount: number
  sourceEntries: readonly SkillSourceInventoryEntry[]
  scannedSourceCount: number
  hostLabel: string | null
  onClose: () => void
  /** False while the target is unresolved or the host predates the delete
   *  capability, so the entry disables with a reason rather than routing a
   *  request nothing on that host answers. */
  deleteSupported: boolean
  deleteUnsupportedReason: string | null
  onStartDelete: () => void
  installKotharDisabled: boolean
  installKotharDisabledReason: string | null
  onInstallKothar: () => void
  sshInstallTargets: readonly KotharSshInstallTarget[]
  onInstallKotharOnSshHost: (target: KotharSshInstallTarget) => void
}): React.JSX.Element {
  return (
    <header className="shrink-0 border-b border-border">
      <div className={cn(SKILLS_PAGE_COLUMN, 'flex items-center gap-2 py-3')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-full"
              onClick={onClose}
              aria-label={translate(
                'auto.components.skills.SkillsPage.closeSkills',
                'Close skills'
              )}
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.skills.SkillsPage.closeTooltip', 'Close · Esc')}
          </TooltipContent>
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-border/50" aria-hidden />
        <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">
            {translate('auto.components.skills.SkillsPage.f43ad6edf3', 'Skills')}
          </h1>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">{skillCountLabel(skillCount)}</span>
            {sourceEntries.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <SkillsSourcesPopover entries={sourceEntries} scannedCount={scannedSourceCount} />
              </>
            ) : null}
            {hostLabel ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{hostLabel}</span>
              </>
            ) : null}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                'auto.components.skills.SkillsPage.moreActions',
                'More actions'
              )}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <MenuItemWithReason
              disabled={installKotharDisabled}
              reason={installKotharDisabledReason}
              onSelect={onInstallKothar}
            >
              <Download />
              {translate('auto.components.skills.SkillsPage.installKothar', 'Install kothar…')}
            </MenuItemWithReason>
            {sshInstallTargets.map((target) => (
              <MenuItemWithReason
                key={target.targetId}
                disabled={target.disabledReason !== null}
                reason={target.disabledReason}
                onSelect={() => onInstallKotharOnSshHost(target)}
              >
                <Download />
                {translate(
                  'auto.components.skills.SkillsPage.installKotharOnHost',
                  'Install kothar on {{value0}}…',
                  { value0: target.label }
                )}
              </MenuItemWithReason>
            ))}
            <DropdownMenuSeparator />
            <MenuItemWithReason
              destructive
              disabled={!deleteSupported}
              reason={deleteUnsupportedReason}
              onSelect={onStartDelete}
            >
              <Trash2 />
              {translate('auto.components.skills.SkillsPage.deleteSkills', 'Delete skills…')}
            </MenuItemWithReason>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
