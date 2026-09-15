import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ClaudeTranscriptTailIncompleteError,
  readClaudeTranscriptLeafWithReproof
} from '../claude/claude-transcript-branch-proof'
import { readClaudeTranscriptLeafUuid, resolveSessionFilePath } from './session-file-resolver'

let tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

async function makeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = previous
  }
}

describe('resolveSessionFilePath', () => {
  it('reads Claude last-prompt leaf metadata as the durable branch marker', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-leaf-')
    const transcript = join(root, 'session.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'leaf-old', parentUuid: null, sessionId: 'session-1' },
        {
          type: 'assistant',
          uuid: 'leaf-current',
          parentUuid: 'leaf-old',
          sessionId: 'session-1'
        },
        { type: 'last-prompt', leafUuid: 'leaf-current', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1', 'leaf-old')).resolves.toBe(
      'leaf-current'
    )
  })

  it('fails closed when a Claude transcript has no branch marker', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-no-leaf-')
    const transcript = join(root, 'session.jsonl')
    await writeFile(
      transcript,
      '{"type":"assistant","uuid":"not-a-leaf","parentUuid":null,"sessionId":"session-1"}\n',
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1')).rejects.toThrow(
      'missing last-prompt marker'
    )
  })

  it('distinguishes an incomplete final Claude JSONL record from durable malformed content', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-torn-tail-')
    const transcript = join(root, 'session.jsonl')
    await writeFile(transcript, '{"type":"last-prompt"', 'utf8')

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1')).rejects.toBeInstanceOf(
      ClaudeTranscriptTailIncompleteError
    )

    await writeFile(transcript, '{"type":"last-prompt"\n', 'utf8')
    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1')).rejects.not.toBeInstanceOf(
      ClaudeTranscriptTailIncompleteError
    )
  })

  it('refuses a Claude marker on a sibling branch', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-sibling-')
    const transcript = join(root, 'session.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'root', parentUuid: null, sessionId: 'session-1' },
        { type: 'assistant', uuid: 'expected', parentUuid: 'root', sessionId: 'session-1' },
        { type: 'system', uuid: 'sibling', parentUuid: 'root', sessionId: 'session-1' },
        { type: 'last-prompt', leafUuid: 'sibling', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1', 'expected')).rejects.toThrow(
      'sibling branch'
    )
  })

  it('refuses missing and cyclic Claude parent chains', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-invalid-ancestry-')
    const missing = join(root, 'missing.jsonl')
    const cycle = join(root, 'cycle.jsonl')
    await writeFile(
      missing,
      [
        { type: 'user', uuid: 'expected', parentUuid: null, sessionId: 'session-1' },
        { type: 'assistant', uuid: 'leaf', parentUuid: 'absent', sessionId: 'session-1' },
        { type: 'last-prompt', leafUuid: 'leaf', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )
    await writeFile(
      cycle,
      [
        { type: 'user', uuid: 'expected', parentUuid: null, sessionId: 'session-1' },
        { type: 'assistant', uuid: 'left', parentUuid: 'right', sessionId: 'session-1' },
        { type: 'system', uuid: 'right', parentUuid: 'left', sessionId: 'session-1' },
        { type: 'last-prompt', leafUuid: 'right', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(missing, 'session-1', 'expected')).rejects.toThrow(
      'missing ancestor absent'
    )
    await expect(readClaudeTranscriptLeafUuid(cycle, 'session-1', 'expected')).rejects.toThrow(
      'cycle in parentUuid ancestry'
    )
  })

  it('rejects non-transcript and sidechain UUIDs as the durable leaf', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-leaf-filter-')
    const transcript = join(root, 'session.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'main-user', parentUuid: null, sessionId: 'session-1' },
        {
          type: 'assistant',
          uuid: 'sidechain-assistant',
          parentUuid: 'main-user',
          sessionId: 'session-1',
          isSidechain: true
        },
        { type: 'result', uuid: 'result-frame', parentUuid: 'main-user', sessionId: 'session-1' },
        {
          type: 'system',
          subtype: 'init',
          uuid: 'init-frame',
          parentUuid: null,
          sessionId: 'session-1'
        },
        { type: 'stream_event', uuid: 'stream-frame', parentUuid: null, sessionId: 'session-1' },
        { type: 'last-prompt', leafUuid: 'sidechain-assistant', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1')).rejects.toThrow(
      'marker leaf is missing from the session graph'
    )
  })

  it('rejects a main leaf whose ancestry crosses a subagent sidechain', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-sidechain-ancestry-')
    const transcript = join(root, 'session.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'main-user', parentUuid: null, sessionId: 'session-1' },
        {
          type: 'assistant',
          uuid: 'sidechain-assistant',
          parentUuid: 'main-user',
          sessionId: 'session-1',
          isSidechain: true
        },
        {
          type: 'assistant',
          uuid: 'main-after-sidechain',
          parentUuid: 'sidechain-assistant',
          sessionId: 'session-1'
        },
        { type: 'last-prompt', leafUuid: 'main-after-sidechain', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1')).rejects.toThrow(
      'not on the main transcript'
    )
  })

  it('rejects a main leaf whose ancestry crosses a parent-tool-use sidechain', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-parent-tool-ancestry-')
    const transcript = join(root, 'transcript.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'main-user', parentUuid: null, sessionId: 'session-1' },
        {
          type: 'assistant',
          uuid: 'subagent-assistant',
          parentUuid: 'main-user',
          sessionId: 'session-1',
          parent_tool_use_id: 'tool-use-1'
        },
        {
          type: 'assistant',
          uuid: 'main-after-sidechain',
          parentUuid: 'subagent-assistant',
          sessionId: 'session-1'
        },
        { type: 'last-prompt', leafUuid: 'main-after-sidechain', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1')).rejects.toThrow(
      'not on the main transcript'
    )
  })

  it('rejects a previous cursor descended from a parent-tool-use sidechain', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-parent-tool-cursor-')
    const transcript = join(root, 'transcript.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'main-user', parentUuid: null, sessionId: 'session-1' },
        {
          type: 'assistant',
          uuid: 'subagent-assistant',
          parentUuid: 'main-user',
          sessionId: 'session-1',
          parent_tool_use_id: 'tool-use-1'
        },
        {
          type: 'assistant',
          uuid: 'main-after-sidechain',
          parentUuid: 'subagent-assistant',
          sessionId: 'session-1'
        },
        { type: 'last-prompt', leafUuid: 'main-after-sidechain', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(
      readClaudeTranscriptLeafUuid(transcript, 'session-1', 'main-after-sidechain')
    ).rejects.toThrow('not on the main transcript')
  })

  it('rejects a latest marker descended from a parent-tool-use cursor sidechain', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-parent-tool-cursor-descendant-')
    const transcript = join(root, 'transcript.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'main-user', parentUuid: null, sessionId: 'session-1' },
        {
          type: 'assistant',
          uuid: 'subagent-assistant',
          parentUuid: 'main-user',
          sessionId: 'session-1',
          parent_tool_use_id: 'tool-use-1'
        },
        {
          type: 'assistant',
          uuid: 'main-after-sidechain',
          parentUuid: 'subagent-assistant',
          sessionId: 'session-1'
        },
        {
          type: 'assistant',
          uuid: 'latest-after-sidechain',
          parentUuid: 'main-after-sidechain',
          sessionId: 'session-1'
        },
        { type: 'last-prompt', leafUuid: 'latest-after-sidechain', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(
      readClaudeTranscriptLeafUuid(transcript, 'session-1', 'main-after-sidechain')
    ).rejects.toThrow('not on the main transcript')
  })

  it('rejects a post-snapshot descendant whose parent row was observed later', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-post-snapshot-')
    const transcript = join(root, 'transcript.jsonl')
    await writeFile(
      transcript,
      [
        {
          type: 'assistant',
          uuid: 'descendant',
          parentUuid: 'previous',
          sessionId: 'session-1'
        },
        { type: 'assistant', uuid: 'previous', parentUuid: null, sessionId: 'session-1' },
        { type: 'last-prompt', leafUuid: 'descendant', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1', 'previous')).rejects.toThrow(
      'parent row follows descendant'
    )
  })

  it('does not re-prove a divergent sibling after the sampled cursor rejects', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-sibling-reproof-')
    const transcript = join(root, 'transcript.jsonl')
    await writeFile(
      transcript,
      [
        { type: 'user', uuid: 'root', parentUuid: null, sessionId: 'session-1' },
        { type: 'assistant', uuid: 'old', parentUuid: 'root', sessionId: 'session-1' },
        { type: 'assistant', uuid: 'new', parentUuid: 'root', sessionId: 'session-1' },
        { type: 'last-prompt', leafUuid: 'new', sessionId: 'session-1' }
      ]
        .map((record) => JSON.stringify(record))
        .join('\n'),
      'utf8'
    )
    const calls: (string | null)[] = []
    const readTranscriptLeaf = async ({
      previousLeafUuid
    }: {
      previousLeafUuid: string | null
    }) => {
      calls.push(previousLeafUuid)
      return readClaudeTranscriptLeafUuid(transcript, 'session-1', previousLeafUuid)
    }

    await expect(readClaudeTranscriptLeafUuid(transcript, 'session-1', 'old')).rejects.toThrow(
      'sibling branch'
    )

    await expect(
      readClaudeTranscriptLeafWithReproof({
        readTranscriptLeaf,
        claudeConfigDir: '/accounts/claude',
        providerSessionId: 'session-1',
        previousLeafUuid: 'old'
      })
    ).rejects.toThrow('sibling branch')
    expect(calls).toEqual(['old'])
  })

  it('does not accept a divergent sibling after a truncated-tail reproof', async () => {
    const calls: (string | null)[] = []
    const readTranscriptLeaf = vi.fn(
      async ({ previousLeafUuid }: { previousLeafUuid: string | null }) => {
        calls.push(previousLeafUuid)
        if (calls.length === 1) {
          throw new ClaudeTranscriptTailIncompleteError()
        }
        return 'divergent-sibling'
      }
    )

    await expect(
      readClaudeTranscriptLeafWithReproof({
        readTranscriptLeaf,
        claudeConfigDir: '/accounts/claude',
        providerSessionId: 'session-1',
        previousLeafUuid: 'old'
      })
    ).rejects.toBeInstanceOf(ClaudeTranscriptTailIncompleteError)
    expect(calls).toEqual(['old'])
  })

  it('globs Claude project subdirs for <sessionId>.jsonl', async () => {
    const root = await makeRoot('orca-native-chat-resolve-claude-')
    const claudeProjectsDir = join(root, 'claude-projects')
    const projectDir = join(claudeProjectsDir, '-Users-ada-repo')
    await mkdir(projectDir, { recursive: true })
    const target = join(projectDir, 'sess-123.jsonl')
    await writeFile(target, '{}\n')

    const resolved = await resolveSessionFilePath('claude', 'sess-123', { claudeProjectsDir })
    expect(resolved).toBe(target)
  })

  it('returns null when no transcript matches', async () => {
    const root = await makeRoot('orca-native-chat-resolve-missing-')
    const claudeProjectsDir = join(root, 'claude-projects')
    await mkdir(claudeProjectsDir, { recursive: true })
    expect(await resolveSessionFilePath('claude', 'nope', { claudeProjectsDir })).toBeNull()
  })

  it('returns null for unsupported agents', async () => {
    expect(await resolveSessionFilePath('gemini', 'whatever')).toBeNull()
  })

  it('prefers the hook transcriptPath when it exists (Claude id != file name)', async () => {
    // Recent Claude Code names the file with a UUID that differs from the hook
    // session_id, so the id glob would miss it — but transcript_path is exact.
    const root = await makeRoot('orca-native-chat-resolve-path-')
    const claudeProjectsDir = join(root, 'claude-projects')
    const projectDir = join(claudeProjectsDir, '-Users-ada-repo')
    await mkdir(projectDir, { recursive: true })
    // The real transcript is named by a DIFFERENT id than the hook session id.
    const realFile = join(projectDir, 'real-file-uuid.jsonl')
    await writeFile(realFile, '{}\n')

    const resolved = await resolveSessionFilePath('claude', 'hook-session-id', {
      claudeProjectsDir,
      transcriptPath: realFile
    })
    expect(resolved).toBe(realFile)
  })

  it('falls back to the id glob when the hook transcriptPath does not exist', async () => {
    const root = await makeRoot('orca-native-chat-resolve-path-stale-')
    const claudeProjectsDir = join(root, 'claude-projects')
    const projectDir = join(claudeProjectsDir, '-Users-ada-repo')
    await mkdir(projectDir, { recursive: true })
    const target = join(projectDir, 'sess-xyz.jsonl')
    await writeFile(target, '{}\n')

    const resolved = await resolveSessionFilePath('claude', 'sess-xyz', {
      claudeProjectsDir,
      transcriptPath: join(projectDir, 'does-not-exist.jsonl')
    })
    expect(resolved).toBe(target)
  })

  it('ignores a non-jsonl transcriptPath and falls back to the glob', async () => {
    const root = await makeRoot('orca-native-chat-resolve-path-ext-')
    const claudeProjectsDir = join(root, 'claude-projects')
    const projectDir = join(claudeProjectsDir, '-Users-ada-repo')
    await mkdir(projectDir, { recursive: true })
    const bogus = join(projectDir, 'not-a-transcript.txt')
    await writeFile(bogus, 'x')
    const target = join(projectDir, 'sess-ok.jsonl')
    await writeFile(target, '{}\n')

    const resolved = await resolveSessionFilePath('claude', 'sess-ok', {
      claudeProjectsDir,
      transcriptPath: bogus
    })
    expect(resolved).toBe(target)
  })
})

// Mobile native chat resolves with no root override (transcript-read-cache.ts:104),
// while the account home a structured Claude session pins is
// `CLAUDE_CONFIG_DIR || ~/.claude` (runtime-paths.ts:15). When the two disagree the
// CLI writes one place and mobile reads another, and the chat goes dark with no
// wire-level error — so the default root has to honour the same variable.
describe('the default Claude transcript root mobile falls back to', () => {
  it('follows CLAUDE_CONFIG_DIR, the same variable the pinned account home follows', async () => {
    const configDir = await makeRoot('orca-native-chat-claude-config-dir-')
    const slugDir = join(configDir, 'projects', '-repos-workspace-1')
    await mkdir(slugDir, { recursive: true })
    const transcript = join(slugDir, 'session-under-config-dir.jsonl')
    await writeFile(transcript, '', 'utf8')
    const previous = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = configDir

    try {
      // No `claudeProjectsDir` override: exactly the call mobile makes.
      await expect(resolveSessionFilePath('claude', 'session-under-config-dir')).resolves.toBe(
        transcript
      )
    } finally {
      restoreEnv('CLAUDE_CONFIG_DIR', previous)
    }
  })

  it('ignores a blank CLAUDE_CONFIG_DIR rather than resolving against the filesystem root', async () => {
    const previous = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = '   '

    try {
      await expect(
        resolveSessionFilePath('claude', 'session-that-does-not-exist')
      ).resolves.toBeNull()
    } finally {
      restoreEnv('CLAUDE_CONFIG_DIR', previous)
    }
  })
})
