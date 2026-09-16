// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithMarkPtyLivenessUnverifiable } from './orca-runtime-mark-pty-liveness-unverifiable'

export class OrcaRuntimeWithReclaimTerminalForDesktop extends OrcaRuntimeWithMarkPtyLivenessUnverifiable {
  // Why: invoked from `runtime:restoreTerminalFit` IPC and `terminal.restoreFit`
  // (the desktop "Take back" / "Restore" button). Forces a PTY held at a fit
  // override back to desktop dims. Two cases:
  //   1. Held override with a remote-desktop floor: let the floor resolve the
  //      target and apply its layout, releasing only if it cannot converge.
  //   2. Held override, no floor: resolve the restore target, enqueueLayout,
  //      then release.
  //
  // Why release on a failed resize: explicit take-back is a user command to
  // reclaim control NOW. The resize is best-effort, since the desktop renderer
  // refits the PTY on its next settled frame, but "Take back all terminals" must
  // not strand a banner on the panes whose resize could not converge (#7588).
  // Returns `true` whenever there was a hold to reclaim, `false` when nothing.
  //
  // NOTE: `terminalFitOverrides` lost its only writer with the mobile phone-fit
  // path, so `heldOverride` is always null and this method is inert. Kept intact
  // pending the follow-up decision to delete the take-back path or rewire it to
  // `remoteDesktopFloor.claimHost`.
  async reclaimTerminalForDesktop(ptyId: string): Promise<boolean> {
    const heldOverride = this.terminalFitOverrides.get(ptyId)
    if (heldOverride && this.remoteDesktopFloor.hasLayoutState(ptyId)) {
      const converged = await this.applyRemoteDesktopLayout(ptyId)
      if (!converged) {
        this.releaseDesktopTakeBack(ptyId)
        return true
      }
      return true
    }
    if (heldOverride) {
      // Why: with the PTY sitting at held dims, prefer a fresh desktop renderer
      // measurement; otherwise use the override's pre-fit baseline before
      // falling back to current size.
      const fallback = this.resolveDesktopRestoreTarget(ptyId)
      const renderer = this.lastRendererSizes.get(ptyId)
      const cols = renderer?.cols ?? heldOverride.previousCols ?? fallback.cols
      const rows = renderer?.rows ?? heldOverride.previousRows ?? fallback.rows
      await this.enqueueLayout(ptyId, { kind: 'desktop', cols, rows })
      this.releaseDesktopTakeBack(ptyId)
      return true
    }
    return false
  }

  // Why: the shared "banner must be gone now" step for an explicit desktop
  // take-back. If the best-effort resize left a fit-override held (resize didn't
  // converge), clears it optimistically with a paired desktop-fit 0x0, the same
  // signal onPtyExit emits, so the held-fit banner cannot survive the reclaim.
  // The desktop renderer refits the PTY to real dims on its next settled frame.
  protected releaseDesktopTakeBack(ptyId: string): void {
    if (this.terminalFitOverrides.has(ptyId)) {
      this.terminalFitOverrides.delete(ptyId)
      this.notifier?.terminalFitOverrideChanged(ptyId, 'desktop-fit', 0, 0)
      this.notifyFitOverrideListeners(ptyId, 'desktop-fit', 0, 0)
    }
  }
}
