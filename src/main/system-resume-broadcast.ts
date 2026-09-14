import { BrowserWindow, powerMonitor } from 'electron'
import { publishSystemResume, publishSystemSuspend } from './system-power-lifecycle'

export const SYSTEM_RESUMED_CHANNEL = 'system:resumed'

type PowerLifecycleEvent = 'suspend' | 'resume'

type ResumeEventSource = {
  on(event: PowerLifecycleEvent, listener: () => void): unknown
  off(event: PowerLifecycleEvent, listener: () => void): unknown
}

type ResumeBroadcastWindow = {
  isDestroyed(): boolean
  webContents: { send(channel: string): void }
}

type SystemResumeBroadcastOptions = {
  resumeSource?: ResumeEventSource
  getWindows?: () => ResumeBroadcastWindow[]
}

// Why: renderers cannot observe OS sleep/wake directly, and Linux has no
// window-occlusion tracking so visibilitychange never fires around suspend.
// Wake-sensitive renderer recovery needs this explicit resume signal.
export function registerSystemResumeBroadcast(
  options: SystemResumeBroadcastOptions = {}
): () => void {
  const resumeSource = options.resumeSource ?? powerMonitor
  const getWindows = options.getWindows ?? (() => BrowserWindow.getAllWindows())

  const onSuspend = (): void => {
    publishSystemSuspend()
  }

  const onResume = (): void => {
    publishSystemResume()
    for (const window of getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(SYSTEM_RESUMED_CHANNEL)
      }
    }
  }

  resumeSource.on('suspend', onSuspend)
  resumeSource.on('resume', onResume)
  return () => {
    resumeSource.off('suspend', onSuspend)
    resumeSource.off('resume', onResume)
  }
}
