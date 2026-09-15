import { translate } from '@/i18n/i18n'
import { removeClaudeProviderAccount } from '@/runtime/runtime-provider-accounts-client'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import type { AccountsPaneSectionModel, RemoveAccountTarget } from './accounts-pane-types'

export function renderAccountsRemovalDialogs(
  model: AccountsPaneSectionModel,
  removeClaudeTarget: RemoveAccountTarget | null
): React.JSX.Element {
  const { runClaudeAccountAction, setRemoveClaudeTarget, settings } = model
  return (
    <Dialog
      open={removeClaudeTarget !== null}
      onOpenChange={(open) => !open && setRemoveClaudeTarget(null)}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.settings.AccountsPane.63843e37e2',
              'Remove Claude Account?'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.settings.AccountsPane.854ebbcc45',
              'Orca will delete the managed Claude auth for this saved account. If it is currently active, Orca falls back to the system default Claude login.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRemoveClaudeTarget(null)}>
            {translate('auto.components.settings.AccountsPane.dbb9626ed1', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const target = removeClaudeTarget
              if (!target) {
                return
              }
              setRemoveClaudeTarget(null)
              void runClaudeAccountAction(
                `remove:${target.id}`,
                () => removeClaudeProviderAccount(settings, target.id),
                target.runtime
              )
            }}
          >
            {translate('auto.components.settings.AccountsPane.c2d2751587', 'Remove Account')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
