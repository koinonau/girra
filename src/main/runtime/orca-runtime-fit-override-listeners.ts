// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithStopRequestedPtyIds } from './orca-runtime-stop-requested-pty-ids'
import { RuntimeSubscriptionRegistry } from './runtime-subscription-registry'
import type {
  ProviderBufferAcquisition,
  RuntimeHeadlessTerminal,
  RuntimePtyTitleTrackerEntry,
  RuntimePtyWorktreeRecord,
  RuntimeVisibleTerminalState
} from './runtime-terminal-state-records'
import type { TerminalKittyKeyboardModeTracker } from '../../shared/terminal-kitty-keyboard-mode-tracker'
import type { PtyProviderBufferSnapshot } from '../providers/types'
import type { WaitBlockedCheckState } from './wait-blocked-check-state'
import type { createAgentStatusOscProcessor } from '../../shared/agent-status-osc'
import { RuntimeTerminalViewSubscribers } from './runtime-terminal-view-subscribers'
import { parseAppSshPtyId } from '../../shared/ssh-pty-id'

export class OrcaRuntimeWithFitOverrideListeners extends OrcaRuntimeWithStopRequestedPtyIds {
  // Why: remote view clients need to know when the host releases a fit hold so
  // they can update their UI. Invoked from applyLayout, the desktop take-back
  // and onPtyExit.
  protected fitOverrideListeners = new Map<
    string,
    Set<(event: { mode: 'remote-desktop-fit' | 'desktop-fit'; cols: number; rows: number }) => void>
  >()

  protected readonly subscriptions = new RuntimeSubscriptionRegistry()

  protected ptysById = new Map<string, RuntimePtyWorktreeRecord>()

  protected readonly pairedRendererSessionOwnedPtyIds = new Set<string>()

  protected wslDistroByPtyId = new Map<string, string>()

  protected titleObservationSequence = 0

  protected headlessTerminals = new Map<string, RuntimeHeadlessTerminal>()

  protected ptyOutputSequenceById = new Map<string, number>()

  protected providerSequenceInitializedPtys = new Set<string>()

  protected providerSequenceOffsetByPtyId = new Map<string, number>()

  protected providerSnapshotPreferredPtys = new Set<string>()

  protected providerModeTrackersByPtyId = new Map<string, TerminalKittyKeyboardModeTracker>()

  protected providerModeSnapshotScansByPtyId = new Map<
    string,
    Set<TerminalKittyKeyboardModeTracker>
  >()

  protected providerBufferAcquisitionsByPtyId = new Map<string, ProviderBufferAcquisition>()

  protected providerVisibleStateByPtyId = new Map<string, RuntimeVisibleTerminalState>()

  protected providerVisibleStateReadsByPtyId = new Map<
    string,
    { generation: number; promise: Promise<RuntimeVisibleTerminalState | null> }
  >()

  protected providerVisibleRetryAtByPtyId = new Map<string, number>()

  protected providerSnapshotsWithLiveModeTransition = new WeakSet<PtyProviderBufferSnapshot>()

  protected ptyLifecycleGenerationById = new Map<string, number>()

  protected nextPtyLifecycleGeneration = 1

  protected recentPtyPathCandidatesById = new Map<string, string[]>()

  // Why: candidates only feed mobile file-tap provenance; desktop-only
  // sessions skip the 3-regex extraction on every PTY chunk until a
  // mobile/remote client authenticates (sticky, backfilled on activation).
  protected recentPtyPathCandidateTrackingActive = false

  // Why: OSC 9999 status can span PTY chunks. Keeping parser state in the
  // runtime lets hidden/model-owned terminals observe agent state without a
  // mounted xterm view.
  // Why a throttle: the blocked-reason check builds and scans two full wait
  // texts (<=256KB each, lowercased) — measured at ~85% of onPtyData's cost
  // under a TUI flood (findings log 2026-07-03). PTY chunk boundaries are
  // arbitrary, so running the identical computation over coalesced chunks at
  // a bounded cadence (plus a trailing-edge timer so burst-final state is
  // always evaluated) preserves semantics while removing it from the hot path.
  protected waitBlockedCheckStateByPtyId = new Map<string, WaitBlockedCheckState>()

  protected agentStatusOscProcessorsByPtyId = new Map<
    string,
    ReturnType<typeof createAgentStatusOscProcessor>
  >()

  // Why: per-PTY shared title trackers (all-titles ordering + stale-working
  // timer) replace last-title-per-chunk scanning so main observes the same
  // intra-chunk working→idle transitions the renderer does (issue #1083).
  // Lazily created like agentStatusOscProcessorsByPtyId; disposed on PTY exit.
  protected ptyTitleTrackersByPtyId = new Map<string, RuntimePtyTitleTrackerEntry>()

  // Why: the Command Code output detector arms early from the launch command
  // when known (banner detection covers user-typed launches), mirroring the
  // renderer detector's startupCommand seed.
  protected terminalSpawnCommandsByPtyId = new Map<string, string>()

  // Why: ordinary OSC 0/1/2 titles can split across PTY chunks, especially over
  // SSH/relay buffering. Keep a small raw scan tail and feed reconstructed
  // chunks into the title tracker instead of falling back to last-title scans.
  protected oscTitleScanTailByPtyId = new Map<string, string>()

  // Why: mobile file taps resolve relative paths on the host. OSC 7 is the
  // terminal-owned cwd signal, and it can arrive in live output between snapshots.
  protected osc7ScanTailByPtyId = new Map<string, string>()

  protected terminalCwdByPtyId = new Map<string, string>()

  protected terminalFileUriHostnameByPtyId = new Map<string, string>()

  // Why: per-PTY hydration state guards against double-hydration. Keys:
  //   'pending'  → maybeHydrateHeadlessFromRenderer is in flight
  //   'done'     → hydration completed (success or skip); never run again
  // Absent  → hydration has not been considered yet for this PTY.
  // See docs/mobile-prefer-renderer-scrollback.md.
  protected headlessHydrationState = new Map<string, 'pending' | 'done'>()

  // Why: fit overrides are keyed by ptyId (not terminal handle) because
  // handles can be reissued while the PTY identity is stable. In-memory only —
  // a stale override should not survive an app restart.
  protected terminalFitOverrides = new Map<
    string,
    {
      cols: number
      rows: number
      previousCols: number | null
      previousRows: number | null
      updatedAt: number
      clientId: string
    }
  >()

  // Why: Phase-5 query-responder suppression — a terminal-RPC subscribe
  // stream feeds a remote xterm view (web/remote desktop) that answers
  // queries with view authority, so main must yield while one is attached
  // (terminal-query-authority.md). Ref-counted per PTY because multiple
  // streams can attach concurrently.
  protected readonly terminalViewSubscribers = new RuntimeTerminalViewSubscribers({
    notifyPresenceChanged: (ptyId) => this.notifyRemoteTerminalViewPresenceChanged(ptyId),
    isUnattachedLocalCandidate: (ptyId) => {
      if (
        this.headlessTerminals.has(ptyId) ||
        this.providerSnapshotPreferredPtys.has(ptyId) ||
        this.pendingPtyRegistrationIncarnations.has(ptyId) ||
        parseAppSshPtyId(ptyId)
      ) {
        return false
      }
      const pty = this.ptysById.get(ptyId)
      return pty !== undefined && pty.connectionId === null && pty.connected
    },
    attachProvider: (ptyId) => {
      const attach = this.ptyController?.attach
      return attach ? (async () => attach(ptyId))() : null
    }
  })
}
