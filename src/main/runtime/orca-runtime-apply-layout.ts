// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithPickMostRecentActor } from './orca-runtime-pick-most-recent-actor'
import type { ApplyLayoutResult, PtyLayoutState, PtyLayoutTarget } from './orca-runtime-core'

export class OrcaRuntimeWithApplyLayout extends OrcaRuntimeWithPickMostRecentActor {
  protected async applyLayout(ptyId: string, target: PtyLayoutTarget): Promise<ApplyLayoutResult> {
    // Why: re-check pty-exit at the head of the slot — the queue may have
    // accepted this target before onPtyExit ran.
    if (!this.layouts.has(ptyId) && !this.isFreshSubscribe(ptyId)) {
      return { ok: false, reason: 'pty-exited' }
    }

    const prev = this.layouts.get(ptyId) ?? null
    const seq = (prev?.seq ?? 0) + 1
    const next: PtyLayoutState = { ...target, seq, appliedAt: Date.now() }

    const currentSize = this.getTerminalSize(ptyId)
    const dimsChanged = currentSize?.cols !== target.cols || currentSize?.rows !== target.rows
    const modeChanged = (prev?.kind ?? 'desktop') !== target.kind

    // Snapshot for rollback.
    const prevFitOverride = this.terminalFitOverrides.get(ptyId) ?? null

    // Tentative writes — the resize is the point of no return.
    this.layouts.set(ptyId, next)
    this.terminalFitOverrides.delete(ptyId)

    if (dimsChanged) {
      let ok = false
      try {
        const r = this.ptyController?.resize?.(ptyId, target.cols, target.rows)
        ok = r ?? true
      } catch (err) {
        console.error('[layout] ptyController.resize threw', { ptyId, err })
        ok = false
      }
      if (!ok) {
        // Roll back to pre-call snapshot. seq is NOT bumped on the wire
        // because we never emit below.
        if (prev) {
          this.layouts.set(ptyId, prev)
        } else {
          this.layouts.delete(ptyId)
        }
        if (prevFitOverride) {
          this.terminalFitOverrides.set(ptyId, prevFitOverride)
        } else {
          this.terminalFitOverrides.delete(ptyId)
        }
        return { ok: false, reason: 'resize-failed' }
      }
      this.resizeHeadlessTerminal(ptyId, target.cols, target.rows)
    }

    // Why: remote desktop ownership is a fit hold for the host and passive
    // peer viewers. Emit every remote layout so owner changes at equal geometry
    // still park/release the correct clients without relying on resize deltas.
    // Defense-in-depth (#7588): also emit when a stale override was cleared
    // without a kind flip, repairing the renderer instead of stranding the held
    // modal.
    const overrideChanged = prevFitOverride != null
    if (target.kind === 'remote-desktop' || modeChanged || overrideChanged) {
      // Why: a flip back to desktop arms the renderer-cascade suppress window
      // before the collateral safeFit IPCs arrive. See "Renderer cascade
      // suppression".
      if (target.kind === 'desktop') {
        this.lastRendererSizes.delete(ptyId)
        this.suppressResizesForMs(500)
      }
      const mode = target.kind === 'remote-desktop' ? 'remote-desktop-fit' : 'desktop-fit'
      this.notifier?.terminalFitOverrideChanged(ptyId, mode, target.cols, target.rows)
      this.notifyFitOverrideListeners(ptyId, mode, target.cols, target.rows)
    }

    // Remote view clients re-fit on every dim change, not just mode flips.
    this.notifyTerminalResize(ptyId, {
      cols: target.cols,
      rows: target.rows,
      displayMode: 'desktop',
      reason: 'apply-layout',
      seq
    })

    return { ok: true, state: next }
  }
}
