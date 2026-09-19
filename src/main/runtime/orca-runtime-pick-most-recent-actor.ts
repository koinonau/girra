// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithMarkPtyLivenessUnverifiable } from './orca-runtime-mark-pty-liveness-unverifiable'
import type { ApplyLayoutResult, PtyLayoutState, PtyLayoutTarget } from './orca-runtime-core'

export class OrcaRuntimeWithPickMostRecentActor extends OrcaRuntimeWithMarkPtyLivenessUnverifiable {
  // ─── Layout state machine ─────────────────────────────────────────
  //
  // See docs/mobile-terminal-layout-state-machine.md.
  //
  // applyLayout is the SOLE writer of:
  //   - this.layouts
  //   - this.terminalFitOverrides (except the sanctioned dead-pty cleanups in
  //     onPtyExit and reclaimTerminalForDesktop's orphan branch, which delete)
  //   - this.ptyController.resize (i.e. the actual PTY dims)
  //
  // Every trigger that wants to change PTY dims or flip mode goes through
  // enqueueLayout, which serializes calls behind a per-PTY async queue
  // (the await on ptyController.resize would otherwise let seq bumps reach
  // the wire out of order).

  getLayout(ptyId: string): PtyLayoutState | null {
    return this.layouts.get(ptyId) ?? null
  }

  // Why: `enqueueLayout`'s "no layouts entry" short-circuit must not fire
  // on the very first transition for a PTY (where the entry doesn't exist
  // yet *because* we're about to create it). Callers add the ptyId to
  // `freshSubscribeGuard` before calling enqueueLayout and remove it in a
  // finally block.
  protected isFreshSubscribe(ptyId: string): boolean {
    return this.freshSubscribeGuard.has(ptyId)
  }

  // Why: three-step fallback chain for desktop-restore targets. Always
  // returns a value; the terminal {80,24} branch is reached only under
  // bug. Wrapping the chain as a single helper prevents callsite drift.
  protected resolveDesktopRestoreTarget(ptyId: string): { cols: number; rows: number } {
    // 1. Most-recent desktop renderer geometry report.
    const renderer = this.lastRendererSizes.get(ptyId)
    if (renderer) {
      return { cols: renderer.cols, rows: renderer.rows }
    }
    // 2. Current PTY size.
    const size = this.getTerminalSize(ptyId)
    if (size) {
      return { cols: size.cols, rows: size.rows }
    }
    // 3. Hard default.
    return { cols: 80, rows: 24 }
  }

  // Why: a new viewport-only update from the same owner supersedes a
  // queued same-shape tail. Mode flips, owner changes, and take-back
  // append (losing a take-floor to a viewport tick would be a fairness
  // hole — see "enqueueLayout coalescing" in the design doc).
  protected coalescesWith(prev: PtyLayoutTarget, next: PtyLayoutTarget): boolean {
    if (prev.kind !== next.kind) {
      return false
    }
    if (prev.kind === 'remote-desktop' && next.kind === 'remote-desktop') {
      // Why: each owner's claim promise gates its following input. Sharing a
      // waiter across owners could release A's input only after B's grid lands.
      return prev.ownerSubscriptionKey === next.ownerSubscriptionKey
    }
    return true
  }

  protected enqueueLayout(ptyId: string, target: PtyLayoutTarget): Promise<ApplyLayoutResult> {
    // Why: PTY-exit short-circuit. Fresh-subscribe gate lets the very first
    // transition through even though `layouts` has no entry yet.
    if (!this.layouts.has(ptyId) && !this.isFreshSubscribe(ptyId)) {
      return Promise.resolve({ ok: false, reason: 'pty-exited' })
    }

    let entry = this.layoutQueues.get(ptyId)
    if (!entry) {
      entry = { running: null, pending: [] }
      this.layoutQueues.set(ptyId, entry)
    }
    const queue = entry

    return new Promise<ApplyLayoutResult>((resolve) => {
      if (!queue.running) {
        queue.running = this.runLayoutSlot(ptyId, target, [resolve])
        return
      }
      const tail = queue.pending.at(-1)
      if (tail && this.coalescesWith(tail.target, target)) {
        tail.target = target
        tail.waiters.push(resolve)
        return
      }
      queue.pending.push({ target, waiters: [resolve] })
    })
  }

  protected async runLayoutSlot(
    ptyId: string,
    target: PtyLayoutTarget,
    waiters: ((r: ApplyLayoutResult) => void)[]
  ): Promise<ApplyLayoutResult> {
    let result: ApplyLayoutResult
    try {
      result = await this.applyLayout(ptyId, target)
    } catch (err) {
      // Why: defensive — applyLayout itself catches resize errors, but a
      // throw from one of the synchronous map writes (e.g. notifier hook)
      // must not jam the queue forever.
      console.error('[layout] applyLayout threw', { ptyId, err })
      result = { ok: false, reason: 'resize-failed' }
    }
    for (const w of waiters) {
      w(result)
    }

    const queue = this.layoutQueues.get(ptyId)
    if (!queue) {
      return result
    }
    const next = queue.pending.shift()
    if (next) {
      queue.running = this.runLayoutSlot(ptyId, next.target, next.waiters)
    } else {
      queue.running = null
      // Why: drop the entry once empty so the map doesn't grow without bound
      // across short-lived PTYs.
      this.layoutQueues.delete(ptyId)
    }
    return result
  }
}
