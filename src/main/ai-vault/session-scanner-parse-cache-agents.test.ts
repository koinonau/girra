import { appendFile, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseAgentSessionFile } from './session-scanner-agent-parser'
import { allIncrementalAgentFixtures } from './session-scanner-incremental-fixtures'
import {
  createSessionParseStats,
  parseAgentSessionFileCached,
  resetSessionParseCacheForTests
} from './session-scanner-parse-cache'
import type { SessionFileCandidate } from './session-scanner-types'

let tempRoots: string[] = []

beforeEach(() => {
  resetSessionParseCacheForTests()
})

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

async function makeTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-parse-cache-agents-'))
  tempRoots.push(root)
  return root
}

async function candidateFor(
  agent: SessionFileCandidate['agent'],
  path: string
): Promise<SessionFileCandidate> {
  const fileStat = await stat(path)
  return {
    agent,
    file: {
      path,
      mtimeMs: fileStat.mtimeMs,
      modifiedAt: fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size
    }
  }
}

describe.each(allIncrementalAgentFixtures())('incremental parse parity: $agent', (fixture) => {
  it('reuses unchanged files, resumes appends, and matches cold parses exactly', async () => {
    const root = await makeTempDir()
    const path = join(root, fixture.fileName)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${fixture.seedLines.join('\n')}\n`)

    const stats = createSessionParseStats()
    const seedCandidate = await candidateFor(fixture.agent, path)
    const seeded = await parseAgentSessionFileCached(seedCandidate, process.platform, stats)
    expect(stats.fullParses).toBe(1)
    expect(seeded).toEqual(await parseAgentSessionFile(seedCandidate, process.platform))

    // Unchanged rescan returns the identical cached object.
    const reused = await parseAgentSessionFileCached(seedCandidate, process.platform, stats)
    expect(reused).toBe(seeded)
    expect(stats.reused).toBe(1)

    // Appended lines resume from the stored byte offset and must equal a
    // cold parse of the grown file.
    await appendFile(path, `${fixture.appendLines.join('\n')}\n`)
    const grownCandidate = await candidateFor(fixture.agent, path)
    const incremental = await parseAgentSessionFileCached(grownCandidate, process.platform, stats)
    expect(stats.incremental).toBe(1)
    expect(incremental).toEqual(await parseAgentSessionFile(grownCandidate, process.platform))

    // A truncated rewrite falls back to a full parse.
    await writeFile(path, `${fixture.truncatedLines.join('\n')}\n`)
    const truncatedCandidate = await candidateFor(fixture.agent, path)
    const reparsed = await parseAgentSessionFileCached(truncatedCandidate, process.platform, stats)
    expect(stats.fullParses).toBe(2)
    expect(reparsed).toEqual(await parseAgentSessionFile(truncatedCandidate, process.platform))
  })

  it('includes a trailing unterminated line without double-counting it later', async () => {
    const root = await makeTempDir()
    const path = join(root, fixture.fileName)
    await mkdir(dirname(path), { recursive: true })
    const lastSeedLine = fixture.seedLines.at(-1)
    const headLines = fixture.seedLines.slice(0, -1)
    await writeFile(path, `${[...headLines, ''].join('\n')}${lastSeedLine}`)

    const partialCandidate = await candidateFor(fixture.agent, path)
    const shown = await parseAgentSessionFileCached(partialCandidate, process.platform)
    expect(shown).toEqual(await parseAgentSessionFile(partialCandidate, process.platform))

    await appendFile(path, `\n${fixture.appendLines.join('\n')}\n`)
    const grownCandidate = await candidateFor(fixture.agent, path)
    const stats = createSessionParseStats()
    const completed = await parseAgentSessionFileCached(grownCandidate, process.platform, stats)
    expect(stats.incremental).toBe(1)
    expect(completed).toEqual(await parseAgentSessionFile(grownCandidate, process.platform))
  })

  it('tolerates a mid-write truncated trailing line and never double-counts it', async () => {
    const root = await makeTempDir()
    const path = join(root, fixture.fileName)
    await mkdir(dirname(path), { recursive: true })
    // A writer caught mid-record: the trailing line is invalid JSON.
    await writeFile(path, `${fixture.seedLines.join('\n')}\n{"type":"user","mess`)

    const shown = await parseAgentSessionFileCached(
      await candidateFor(fixture.agent, path),
      process.platform
    )
    expect(shown).toEqual(
      await parseAgentSessionFile(await candidateFor(fixture.agent, path), process.platform)
    )

    // The writer "finishes" the interrupted record as unparseable junk (both
    // the fold and a cold parse must skip it identically) and appends more.
    await appendFile(path, `age": }\n${fixture.appendLines.join('\n')}\n`)
    const stats = createSessionParseStats()
    const completed = await parseAgentSessionFileCached(
      await candidateFor(fixture.agent, path),
      process.platform,
      stats
    )
    expect(stats.incremental).toBe(1)
    expect(completed).toEqual(
      await parseAgentSessionFile(await candidateFor(fixture.agent, path), process.platform)
    )
  })
})

describe('non-resumable formats keep reuse-only caching', () => {
  it('re-parses a changed opencode session doc fully and reuses it when unchanged', async () => {
    const root = await makeTempDir()
    const path = join(root, 'ses_1.json')
    await writeFile(
      path,
      JSON.stringify({ id: 'ses_1', title: 'OpenCode seed', time: { updated: 1_777_629_600_000 } })
    )

    const stats = createSessionParseStats()
    const seeded = await parseAgentSessionFileCached(
      await candidateFor('opencode', path),
      process.platform,
      stats
    )
    const reused = await parseAgentSessionFileCached(
      await candidateFor('opencode', path),
      process.platform,
      stats
    )
    expect(reused).toBe(seeded)
    expect(stats).toMatchObject({ fullParses: 1, reused: 1, incremental: 0 })

    await writeFile(
      path,
      JSON.stringify({
        id: 'ses_1',
        title: 'OpenCode rewritten with a longer title',
        time: { updated: 1_777_633_200_000 }
      })
    )
    const rewritten = await parseAgentSessionFileCached(
      await candidateFor('opencode', path),
      process.platform,
      stats
    )
    expect(stats).toMatchObject({ fullParses: 2, incremental: 0 })
    expect(rewritten).toEqual(
      await parseAgentSessionFile(await candidateFor('opencode', path), process.platform)
    )
  })
})
