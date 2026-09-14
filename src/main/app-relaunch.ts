import { app } from 'electron'
import { runWithLaunchPath } from './startup/hydrate-shell-path'

export type AppRelaunchReason = 'admin-restart' | 'gpu-fallback' | 'renderer-request'

export function relaunchApp(_reason: AppRelaunchReason): void {
  runWithLaunchPath(() => app.relaunch())
}
