import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineCommandTerminal } from '@/components/inline-command-terminal/InlineCommandTerminal'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { KOTHAR_INSTALL_WIZARD_COMMAND } from '../../../../shared/agent-feature-install-commands'
import { SKILLS_PAGE_COLUMN } from './skills-page-column'

export function KotharInstallTerminal({
  onCommandFinished,
  onClose
}: {
  onCommandFinished: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'shrink-0 border-b border-border pb-3')}>
      <div className="flex items-center justify-between gap-2 pt-3">
        <h2 className="text-sm font-semibold">
          {translate('auto.components.skills.SkillsPage.installKotharTitle', 'Install kothar')}
        </h2>
        <Button type="button" variant="ghost" size="xs" onClick={onClose}>
          <X />
          {translate('auto.components.skills.SkillsPage.closeInstallKothar', 'Close installer')}
        </Button>
      </div>
      {/* Why: pass the command raw; the Windows npx wrappers would break `curl | bash`. */}
      <InlineCommandTerminal
        command={KOTHAR_INSTALL_WIZARD_COMMAND}
        worktreeId="skills-kothar-install-terminal"
        title={translate('auto.components.skills.SkillsPage.installKotharTitle', 'Install kothar')}
        ariaLabel={translate(
          'auto.components.skills.SkillsPage.installKotharAria',
          'kothar installer terminal'
        )}
        description={translate(
          'auto.components.skills.SkillsPage.installKotharDescription',
          'Press Enter to run the kothar installer. The kothar repository is private, so the installer walks you through GitHub access.'
        )}
        terminalHeightPx={280}
        terminalTopMarginPx={8}
        descriptionPaddingClassName="px-4 py-2"
        autoScrollIntoView={false}
        onCommandFinished={onCommandFinished}
        onTerminalExit={onClose}
      />
    </div>
  )
}
