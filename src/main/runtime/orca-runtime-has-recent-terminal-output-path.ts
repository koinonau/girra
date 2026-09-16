// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithGetOrchestrationDispatchAuthority } from './orca-runtime-get-orchestration-dispatch-authority'
import {
  recentTerminalOutputIncludesPath,
  recentTerminalPathCandidatesIncludePath
} from './terminal-output-path-candidates'

export class OrcaRuntimeWithHasRecentTerminalOutputPath extends OrcaRuntimeWithGetOrchestrationDispatchAuthority {
  hasRecentTerminalOutputPath(handle: string, pathText: string, absolutePath: string): boolean {
    // Why: safety net for any query path that never saw a mobile onReady —
    // lazily backfill so the answer matches pre-gate behavior.
    if (!this.recentPtyPathCandidateTrackingActive) {
      this.activateRecentPtyPathCandidateTracking()
    }
    const ptyId = this.resolveLeafForHandle(handle)?.ptyId
    const recentOutput = ptyId ? this.recentPtyOutputById.get(ptyId)?.read() : null
    if (recentOutput && recentTerminalOutputIncludesPath(recentOutput, pathText, absolutePath)) {
      return true
    }
    const candidates = ptyId ? this.recentPtyPathCandidatesById.get(ptyId) : null
    return candidates
      ? recentTerminalPathCandidatesIncludePath(candidates, pathText, absolutePath)
      : false
  }

  // ─── Terminal Fit Override Management ─────────────────────────

  getTerminalFitOverride(ptyId: string) {
    return this.terminalFitOverrides.get(ptyId) ?? null
  }

  getAllTerminalFitOverrides(): Map<
    string,
    { mode: 'remote-desktop-fit'; cols: number; rows: number }
  > {
    const result = new Map<string, { mode: 'remote-desktop-fit'; cols: number; rows: number }>()
    for (const ptyId of this.remoteDesktopFloor.ownerPtyIds()) {
      const size = this.getTerminalSize(ptyId)
      if (size) {
        result.set(ptyId, { mode: 'remote-desktop-fit', ...size })
      }
    }
    return result
  }

  getBrowserRemoteViewerPages(): string[] {
    return this.edgeCommands.getBrowserRemoteViewerPages()
  }
}
