import { OrcaRuntimeWithApplyLayout } from './orca-runtime-apply-layout'

export class OrcaRuntimeWithRendererGeometry extends OrcaRuntimeWithApplyLayout {
  // Why: called after a desktop renderer path has successfully resized the
  // PTY (local IPC or remote desktop viewport). The runtime mirror must take
  // the same accepted geometry so hidden-output restore parses at PTY width.
  onExternalPtyResize(ptyId: string, cols: number, rows: number): void {
    // The pty:resize IPC handler is supposed to gate via `isResizeSuppressed`
    // before calling here, but defend against callers that don't.
    if (this.isResizeSuppressed()) {
      return
    }
    // Why: while a fit override is in place, the desktop renderer's safeFit
    // echoes pty:resize(override.cols, override.rows). Treating that echo as
    // legitimate geometry would overwrite the restore baseline with held dims,
    // so the next take-back enqueues a no-op and leaves xterm stuck. Only
    // filter reports that EXACTLY match the override. A fresh measurement from
    // a now-visible pane reports different dims and is the right baseline.
    const activeOverride = this.terminalFitOverrides.get(ptyId)
    if (activeOverride && activeOverride.cols === cols && activeOverride.rows === rows) {
      return
    }
    // Why: a successful host resize supersedes any target retained after a
    // failed viewer reclaim; a later viewer cycle must capture this new truth.
    this.remoteDesktopFloor.clearStaleHostReclaimTarget(ptyId)
    this.resizeHeadlessTerminal(ptyId, cols, rows)
    this.refreshRendererGeometry(ptyId, cols, rows)
  }

  // Why: pty:reportGeometry IPC sibling. The renderer calls this when a desktop
  // pane container goes from 0×0 to a real size while a remote viewer owns the
  // PTY, so the restore-target baseline tracks real desktop dims even during
  // the hold, since otherwise resolveDesktopRestoreTarget falls back to the PTY's
  // spawn default (typically 80×24) and Take Back leaves the terminal partially
  // restored. Measurement-only: it refreshes lastRendererSizes, never resizes
  // the PTY, and bypasses both isResizeSuppressed and the override-echo gate by
  // design, because the renderer only fires it when it has just measured fresh
  // real geometry.
  recordRendererGeometry(ptyId: string, cols: number, rows: number): void {
    if (cols <= 0 || rows <= 0) {
      return
    }
    // Why: a viewer may leave while a hold still owns the PTY. Keep its
    // deferred host reclaim cache aligned with later trusted pane measurements.
    this.remoteDesktopFloor.updateHostReclaimTarget(ptyId, cols, rows)
    this.refreshRendererGeometry(ptyId, cols, rows)
  }

  protected refreshRendererGeometry(ptyId: string, cols: number, rows: number): void {
    this.lastRendererSizes.set(ptyId, { cols, rows })
  }

  // Why: the pty:resize IPC handler calls this to check if the global
  // suppress window is active. During this window, all desktop renderer
  // pty:resize events are ignored to prevent collateral safeFit corruption.
  isResizeSuppressed(): boolean {
    return Date.now() < this.resizeSuppressedUntil
  }

  protected suppressResizesForMs(ms: number): void {
    this.resizeSuppressedUntil = Date.now() + ms
  }
}
