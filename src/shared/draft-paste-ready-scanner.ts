import type { DraftPasteReadySignal } from './tui-agent-config'

// Why: agents enable bracketed paste (DECSET 2004) before their composer is
// actually mounted/focused. These markers let the scanner detect the real
// "input is ready" moment per agent instead of guessing from output silence.
const DECSET_BRACKETED_PASTE = '\x1b[?2004h'
const CODEX_COMPOSER_PROMPT = '›'
// Why: opencode emits the DECTCEM show-cursor only once the composer row is
// mounted and the text cursor is placed in it — a "composer ready" signal,
// analogous to Codex's prompt glyph. It fires ~2s after bracketed paste is
// enabled, so gating on it (instead of a quiet window) stops the paste from
// racing the composer mount under slow/noisy startup. mimo-code uses the same
// signal by parity; the quiet-window fallback covers any agent that differs.
const DECTCEM_SHOW_CURSOR = '\x1b[?25h'
const DECSET_ALT_SCREEN = '\x1b[?1049h'
const DECRST_ALT_SCREEN = '\x1b[?1049l'

type DraftPasteReadySignalSpec = {
  /** Bytes that must precede `marker` for it to count; null when there is no marker. */
  markerAnchor: string | null
  /** Composer-ready marker, or null for signals that only use the quiet window. */
  marker: string | null
  /** Bytes that arm the quiet-window fallback, or null when the signal has none. */
  quietAnchor: string | null
}

const DRAFT_PASTE_READY_SIGNALS: Record<DraftPasteReadySignal, DraftPasteReadySignalSpec> = {
  'codex-composer-prompt': {
    markerAnchor: DECSET_BRACKETED_PASTE,
    marker: CODEX_COMPOSER_PROMPT,
    quietAnchor: null
  },
  'render-cursor-after-bracketed-paste': {
    markerAnchor: DECSET_BRACKETED_PASTE,
    marker: DECTCEM_SHOW_CURSOR,
    quietAnchor: null
  },
  'render-quiet-after-bracketed-paste': {
    markerAnchor: null,
    marker: null,
    quietAnchor: DECSET_BRACKETED_PASTE
  }
}

/** Longest anchor sequence minus one — the carry needed to rejoin one split across chunks. */
const ANCHOR_CARRY_CHARS = 7

export type DraftPasteReadyScanResult = {
  /** The agent-specific ready signal fired — caller should deliver the paste now. */
  ready: boolean
  /** Caller should (re)arm the quiet-window fallback timer for this chunk. */
  armQuietTimer: boolean
}

/**
 * Pure, incremental scanner shared by the renderer and main-process draft-paste
 * readiness waiters so the two delivery paths (desktop-local vs runtime/SSH/
 * remote) cannot drift. It only parses the PTY byte stream; timers, the PTY
 * subscription, and resolution stay with each caller because their transports
 * and return types differ.
 *
 * Per agent signal:
 *   - `codex-composer-prompt`: ready when the `›` glyph renders after DECSET
 *     2004, or when DECSET follows a glyph rendered while Codex owns the
 *     alternate screen; never arms the quiet window.
 *   - `render-cursor-after-bracketed-paste`: ready when DECTCEM show-cursor
 *     (`\x1b[?25h`) renders after DECSET 2004. Like Codex it does NOT arm the
 *     quiet window: opencode stays silent for ~1.5-2s between enabling
 *     bracketed paste and mounting its composer, so a quiet window would fire
 *     during that gap and pre-empt the marker. opencode re-emits show-cursor on
 *     every render frame once mounted, so the marker is effectively guaranteed;
 *     the caller's hard timeout is the backstop if it never appears.
 *   - `render-quiet-after-bracketed-paste` (default): no signal marker; arms the
 *     quiet window once DECSET 2004 is seen.
 *
 * A 512-byte ring (`recent` / `postAnchorRecent`) covers escape sequences
 * split across chunk boundaries without retaining terminal scrollback.
 */
export function createDraftPasteReadyScanner(readySignal: DraftPasteReadySignal): {
  observe: (data: string) => DraftPasteReadyScanResult
} {
  let recent = ''
  let postAnchorRecent = ''
  let codexCarry = ''
  let sawMarkerAnchor = false
  let sawQuietAnchor = false
  let codexAltScreen = false
  let sawCodexPromptInAltScreen = false

  const { markerAnchor, marker: signalMarker, quietAnchor } = DRAFT_PASTE_READY_SIGNALS[readySignal]

  const scanCodexPreAnchorPrompt = (data: string): void => {
    const window = codexCarry + data
    codexCarry = window.slice(-ANCHOR_CARRY_CHARS)
    let cursor = 0
    while (cursor < window.length) {
      const enterIndex = window.indexOf(DECSET_ALT_SCREEN, cursor)
      const leaveIndex = window.indexOf(DECRST_ALT_SCREEN, cursor)
      const promptIndex = window.indexOf(CODEX_COMPOSER_PROMPT, cursor)
      const nextIndex = Math.min(
        ...[enterIndex, leaveIndex, promptIndex].filter((index) => index !== -1)
      )
      if (!Number.isFinite(nextIndex)) {
        return
      }
      if (nextIndex === enterIndex) {
        codexAltScreen = true
        sawCodexPromptInAltScreen = false
        cursor = nextIndex + DECSET_ALT_SCREEN.length
      } else if (nextIndex === leaveIndex) {
        codexAltScreen = false
        sawCodexPromptInAltScreen = false
        cursor = nextIndex + DECRST_ALT_SCREEN.length
      } else {
        if (codexAltScreen) {
          sawCodexPromptInAltScreen = true
        }
        cursor = nextIndex + CODEX_COMPOSER_PROMPT.length
      }
    }
  }

  return {
    observe(data: string): DraftPasteReadyScanResult {
      const combined = recent + data
      recent = combined.slice(-512)
      if (!sawQuietAnchor && quietAnchor !== null && combined.includes(quietAnchor)) {
        sawQuietAnchor = true
      }
      if (readySignal === 'codex-composer-prompt' && !sawMarkerAnchor) {
        scanCodexPreAnchorPrompt(data)
      }
      if (signalMarker !== null && markerAnchor !== null) {
        if (!sawMarkerAnchor) {
          const anchorIndex = combined.indexOf(markerAnchor)
          if (anchorIndex !== -1) {
            sawMarkerAnchor = true
            if (readySignal === 'codex-composer-prompt' && sawCodexPromptInAltScreen) {
              return { ready: true, armQuietTimer: false }
            }
            const postAnchorChunk = combined.slice(anchorIndex + markerAnchor.length)
            if (postAnchorChunk.includes(signalMarker)) {
              return { ready: true, armQuietTimer: false }
            }
            postAnchorRecent = postAnchorChunk.slice(-512)
          }
        } else {
          if (data.includes(signalMarker) || (postAnchorRecent + data).includes(signalMarker)) {
            return { ready: true, armQuietTimer: false }
          }
          postAnchorRecent = (postAnchorRecent + data).slice(-512)
        }
      }
      // Why: the Codex glyph and opencode show-cursor signals must NOT arm the
      // quiet window (they carry no quiet anchor). opencode goes silent for
      // ~1.5-2s between enabling bracketed paste and mounting its composer, so a
      // quiet window would fire during that gap — before the composer exists —
      // and pre-empt the marker. Those signals wait for their marker, bounded
      // only by the caller's hard timeout (and its best-effort
      // process-ownership paste after that).
      return { ready: false, armQuietTimer: sawQuietAnchor }
    }
  }
}
