import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import type * as NodeReadlineModule from 'node:readline'
import type * as WslFsAccessModule from '../native-chat/wsl-transcript-fs-access'
import type { FileWithMtime } from './session-scanner-types'

// readline.close() leaves its input open, so a parser that stops consuming
// mid-file (a throw, a break) strands the gated transcript handle until the
// gate's deadline and delays every later scan. These pin the finally blocks.
const mocks = vi.hoisted(() => ({
  openStream: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  createInterface: vi.fn()
}))

vi.mock('../native-chat/wsl-transcript-fs-access', async (importOriginal) => ({
  ...(await importOriginal<typeof WslFsAccessModule>()),
  openTranscriptReadStream: mocks.openStream,
  wslGatedReadFile: mocks.readFile,
  wslGatedStat: mocks.stat
}))

vi.mock('node:readline', async (importOriginal) => ({
  ...(await importOriginal<typeof NodeReadlineModule>()),
  createInterface: mocks.createInterface
}))

import { parseMessageGraphSessionFile } from './session-scanner-graph-parsers'

const PARSE_FAILURE = 'parser failed mid-transcript'

const opened: { path: string; stream: Readable }[] = []
const interfaces: { close: ReturnType<typeof vi.fn> }[] = []

function file(path: string): FileWithMtime {
  return { path, mtimeMs: 1, modifiedAt: '2026-06-01T10:05:00.000Z', sizeBytes: 128 }
}

function lastOpened(): { path: string; stream: Readable } {
  const entry = opened.at(-1)
  if (!entry) {
    throw new Error('no transcript stream was opened')
  }
  return entry
}

function expectStreamTornDown(): void {
  expect(lastOpened().stream.destroyed).toBe(true)
  expect(interfaces.at(-1)?.close).toHaveBeenCalled()
}

beforeEach(() => {
  opened.length = 0
  interfaces.length = 0
  mocks.openStream.mockReset()
  mocks.readFile.mockReset()
  mocks.stat.mockReset()
  mocks.createInterface.mockReset()

  mocks.openStream.mockImplementation((path: string) => {
    const stream = new Readable({
      read() {
        this.push(null)
      }
    })
    opened.push({ path, stream })
    return stream
  })
  // One line, then a consumer-side throw: the parser must still tear the
  // stream down on its way out.
  mocks.createInterface.mockImplementation(() => {
    const lines = {
      close: vi.fn(),
      [Symbol.asyncIterator]: async function* () {
        yield '{}'
        throw new Error(PARSE_FAILURE)
      }
    }
    interfaces.push(lines)
    return lines
  })
})

describe('session parsers that stop consuming a gated transcript early', () => {
  it('destroys the stream when the message graph parse throws', async () => {
    await expect(parseMessageGraphSessionFile(file('/w/session.jsonl'), 'linux')).rejects.toThrow(
      PARSE_FAILURE
    )

    expectStreamTornDown()
  })
})
