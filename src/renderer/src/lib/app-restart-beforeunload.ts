import {
  GIRRA_APP_RESTART_ABORTED_EVENT,
  GIRRA_APP_RESTART_STARTED_EVENT
} from '../../../shared/app-restart-events'
import { GIRRA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT } from '../../../shared/renderer-shutdown-events'

let intentionalAppRestartInProgress = false

export function isIntentionalAppRestartInProgress(): boolean {
  return intentionalAppRestartInProgress
}

export function registerAppRestartBeforeUnloadBypass(): () => void {
  const markInProgress = (): void => {
    intentionalAppRestartInProgress = true
  }
  const clearInProgress = (): void => {
    intentionalAppRestartInProgress = false
  }

  window.addEventListener(GIRRA_APP_RESTART_STARTED_EVENT, markInProgress)
  window.addEventListener(GIRRA_APP_RESTART_ABORTED_EVENT, clearInProgress)
  window.addEventListener(GIRRA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT, clearInProgress)

  return () => {
    window.removeEventListener(GIRRA_APP_RESTART_STARTED_EVENT, markInProgress)
    window.removeEventListener(GIRRA_APP_RESTART_ABORTED_EVENT, clearInProgress)
    window.removeEventListener(GIRRA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT, clearInProgress)
    // Why: hot reloads can re-register this listener inside the same renderer.
    // Reset the module flag on cleanup so a failed earlier restart attempt
    // cannot silently suppress future unsaved-change prompts.
    intentionalAppRestartInProgress = false
  }
}
