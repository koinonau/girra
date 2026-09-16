export type BrowserPagePaintabilityState = {
  isActive: boolean
  isAutomationVisible: boolean
  // Why: a paired desktop/web/CLI client streaming this page takes no presence lock, so without
  // its own term the guest is parked display:none and the screencast it subscribed to goes dark.
  hasRemoteViewer: boolean
}

export function isBrowserPagePanePaintable({
  isActive,
  isAutomationVisible,
  hasRemoteViewer
}: BrowserPagePaintabilityState): boolean {
  return isActive || isAutomationVisible || hasRemoteViewer
}
