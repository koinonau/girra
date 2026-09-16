import type { OrcaRuntimeService } from '../../../orca-runtime'
import {
  TerminalStreamOpcode,
  encodeTerminalStreamJson
} from '../../../../../shared/terminal-stream-protocol'
import { terminalStreamByteLengthExceeds } from '../../terminal-stream-byte-length'
import {
  iterateTerminalStreamTextPayloads,
  requestedSnapshotScrollbackCandidates
} from './terminal-stream-replay'
import type { SerializedSnapshot, SnapshotFrameOptions } from './terminal-stream-types'

const REQUESTED_SNAPSHOT_BYTE_BUDGET = 2 * 1024 * 1024

export async function serializeBudgetedRequestedSnapshot(
  runtime: OrcaRuntimeService,
  ptyId: string,
  scrollbackRows: number | undefined
): Promise<SerializedSnapshot> {
  const requestedRows = scrollbackRows ?? 0
  for (const rows of requestedSnapshotScrollbackCandidates(scrollbackRows)) {
    const serialized = await runtime.serializeAuthoritativeTerminalBuffer(ptyId, {
      scrollbackRows: rows
    })
    if (!serialized) {
      return null
    }
    const scrollbackAnsi =
      'scrollbackAnsi' in serialized && typeof serialized.scrollbackAnsi === 'string'
        ? serialized.scrollbackAnsi
        : ''
    const data = scrollbackAnsi + serialized.data
    const overByteBudget = terminalStreamByteLengthExceeds(data, REQUESTED_SNAPSHOT_BYTE_BUDGET)
    if (!overByteBudget || rows === 0) {
      return {
        ...serialized,
        data,
        scrollbackRows: rows,
        truncatedByByteBudget: rows < requestedRows || overByteBudget
      }
    }
  }
  return null
}

export function sendSnapshotFrames(
  sendFrame: (
    opcode: TerminalStreamOpcode,
    payload?: Uint8Array<ArrayBufferLike>
  ) => boolean | void,
  options: SnapshotFrameOptions
): { bytes: number; chunks: number; published: boolean } {
  if (
    sendFrame(
      TerminalStreamOpcode.SnapshotStart,
      encodeTerminalStreamJson({
        kind: options.kind,
        cols: options.cols,
        rows: options.rows,
        requestId: options.requestId,
        displayMode: options.displayMode,
        reason: options.reason,
        unavailable: options.unavailable,
        seq: options.seq,
        cwd: options.cwd,
        source: options.source,
        oscLinks: options.oscLinks,
        pendingEscapeTailAnsi: options.pendingEscapeTailAnsi,
        // Why conditional and additive: old clients ignore the unknown field,
        // and a new client must read absence as unknown rather than zero, so
        // no opcode or capability negotiation is involved (Rule 1 of
        // docs/reference/remote-wire-compatibility.md).
        // Why `seq` is required: the flags are only proven at this frame's own
        // seq, so without a replay boundary the client cannot order them.
        ...(typeof options.seq === 'number' && options.kittyKeyboardFlags !== undefined
          ? { kittyKeyboardFlags: options.kittyKeyboardFlags }
          : {}),
        ...(typeof options.seq === 'number' && options.terminalOwner
          ? { terminalOwner: options.terminalOwner }
          : {}),
        // The terminalOwner conjunct is load-bearing, not redundant: no consumer
        // re-checks it, and an un-gated alternateScreen would flip the renderer's
        // mouse-reset selection on every alt-screen reattach of a live TUI.
        ...(typeof options.seq === 'number' &&
        options.terminalOwner &&
        options.alternateScreen !== undefined
          ? { alternateScreen: options.alternateScreen }
          : {}),
        truncated: options.truncated === true,
        truncatedByByteBudget: options.truncatedByByteBudget === true
      })
    ) === false
  ) {
    return { bytes: 0, chunks: 0, published: false }
  }
  let chunks = 0
  let bytes = 0
  for (const chunk of iterateTerminalStreamTextPayloads(options.data)) {
    if (sendFrame(TerminalStreamOpcode.SnapshotChunk, chunk) === false) {
      return { bytes, chunks, published: false }
    }
    chunks++
    bytes += chunk.byteLength
  }
  const published = sendFrame(TerminalStreamOpcode.SnapshotEnd) !== false
  return { bytes, chunks, published }
}

/** The stream's opening image: the visible screen plus its retained scrollback, unbudgeted. */
export async function serializeInitialStreamSnapshot(
  runtime: OrcaRuntimeService,
  ptyId: string
): Promise<SerializedSnapshot> {
  const serialized = await runtime.serializeTerminalBuffer(ptyId, { scrollbackRows: 0 })
  return serialized
    ? {
        ...serialized,
        data: (serialized.scrollbackAnsi ?? '') + serialized.data,
        scrollbackRows: 0,
        truncatedByByteBudget: false
      }
    : null
}
