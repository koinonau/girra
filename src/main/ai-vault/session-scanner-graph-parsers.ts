import { remoteSessionContentLines } from './remote-session-content-lines'
import { openTranscriptReadStream } from '../native-chat/wsl-transcript-fs-access'
import { createInterface } from 'node:readline'
import type { AiVaultSession } from '../../shared/ai-vault-types'
import type { ExecutionHostId } from '../../shared/execution-host'
import type {
  FileWithMtime,
  ResumableSessionParseState,
  SessionAccumulator
} from './session-scanner-types'
import type { TranscriptMessageSink } from './session-transcript-consumers'
import {
  accumulatorFoldResumeState,
  addPreviewContent,
  createAccumulator,
  sessionIdFromFileName,
  updateTimeline
} from './session-scanner-accumulator'
import {
  asRecord,
  extractMessageText,
  extractString,
  parseJsonObject,
  tokenTotal
} from './session-scanner-values'

type ParserSessionOptions = {
  executionHostId?: ExecutionHostId
  executionHostPlatform?: NodeJS.Platform | null
}

// Pi transcripts are append-only message-graph JSONL (session + model_change +
// message records).
export async function parseMessageGraphSessionFile(
  file: FileWithMtime,
  platform: NodeJS.Platform = process.platform,
  messages?: TranscriptMessageSink
): Promise<AiVaultSession | null> {
  const input = openTranscriptReadStream(file.path, { encoding: 'utf-8' }, 'scan')
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    return await parseMessageGraphSessionLines({ file, lines, platform, messages })
  } finally {
    // readline.close() leaves the underlying stream open; destroy it so a
    // mid-parse throw cannot leak the gated transcript handle.
    lines.close()
    input.destroy()
  }
}

export async function parseMessageGraphSessionContent(
  file: FileWithMtime,
  content: string,
  platform: NodeJS.Platform = process.platform,
  options: ParserSessionOptions = {},
  signal?: AbortSignal
): Promise<AiVaultSession | null> {
  return parseMessageGraphSessionLines({
    file,
    lines: remoteSessionContentLines(content, signal),
    platform,
    options
  })
}

function consumeMessageGraphRecordLine(accumulator: SessionAccumulator, line: string): void {
  const record = parseJsonObject(line)
  if (!record) {
    return
  }
  updateTimeline(accumulator, extractString(record.timestamp))
  if (record.type === 'session') {
    const sessionId = extractString(record.id)
    if (sessionId) {
      accumulator.sessionId = sessionId
    }
    accumulator.cwd = extractString(record.cwd) ?? accumulator.cwd
    return
  }
  if (record.type === 'model_change') {
    // Pi writes `modelId`; older records wrote `model`. Prefer either so an
    // in-progress session shows its model before the first assistant reply lands.
    accumulator.model =
      extractString(record.modelId) ?? extractString(record.model) ?? accumulator.model
    return
  }
  if (record.type !== 'message') {
    return
  }
  const message = asRecord(record.message)
  const role = extractString(message?.role)
  if (role === 'user' || role === 'assistant') {
    accumulator.messageCount++
    if (role === 'user') {
      accumulator.title ??= extractMessageText(message)
    } else {
      accumulator.model = extractString(message?.model) ?? accumulator.model
      accumulator.totalTokens += tokenTotal(message?.usage)
    }
    addPreviewContent(accumulator, role, message?.content, record.timestamp)
  }
}

export function createMessageGraphSessionResumeState(
  file: FileWithMtime,
  messages?: TranscriptMessageSink
): ResumableSessionParseState {
  return accumulatorFoldResumeState(
    createAccumulator({ agent: 'pi', file, sessionId: sessionIdFromFileName(file.path), messages }),
    consumeMessageGraphRecordLine
  )
}

async function parseMessageGraphSessionLines(args: {
  file: FileWithMtime
  lines: AsyncIterable<string> | Iterable<string>
  platform: NodeJS.Platform
  options?: ParserSessionOptions
  messages?: TranscriptMessageSink
}): Promise<AiVaultSession | null> {
  const state = createMessageGraphSessionResumeState(args.file, args.messages)
  for await (const line of args.lines) {
    state.consumeLine(line)
  }
  return state.finalize(args.platform, args.options)
}
