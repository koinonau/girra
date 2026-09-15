import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_VAULT_AGENTS } from '../../shared/ai-vault-types'
import { scanAiVaultSessions } from './session-scanner'
import { isolatedScanRoots, jsonLines } from './session-scanner-test-fixtures'

let tempRoots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

describe('scanAiVaultSessions', () => {
  it('indexes Claude and Pi transcripts with resume commands', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    const claudeRoot = roots.claudeProjectsDir
    await mkdir(join(claudeRoot, 'project'), { recursive: true })
    await mkdir(roots.piSessionsDir, { recursive: true })

    await writeFile(
      join(claudeRoot, 'project', 'claude-session.jsonl'),
      [
        JSON.stringify({
          type: 'user',
          sessionId: 'claude-session',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/repo/app',
          gitBranch: 'feature/vault',
          isMeta: false,
          message: { role: 'user', content: 'Implement the vault panel' }
        }),
        JSON.stringify({
          type: 'assistant',
          sessionId: 'claude-session',
          timestamp: '2026-05-01T10:02:00.000Z',
          cwd: '/repo/app',
          gitBranch: 'feature/vault',
          message: {
            model: 'claude-sonnet-4-5',
            usage: {
              input_tokens: 100,
              output_tokens: 40,
              cache_read_input_tokens: 10,
              cache_creation_input_tokens: 5
            }
          }
        }),
        JSON.stringify({
          type: 'custom-title',
          sessionId: 'claude-session',
          timestamp: '2026-05-01T10:03:00.000Z',
          customTitle: 'Vault polish pass'
        })
      ].join('\n')
    )

    await writeFile(
      join(roots.piSessionsDir, 'pi-session.jsonl'),
      jsonLines([
        {
          type: 'session',
          id: 'pi-session',
          timestamp: '2026-05-01T11:00:00.000Z',
          cwd: '/repo/pi'
        },
        {
          type: 'message',
          timestamp: '2026-05-01T11:00:01.000Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Fix the resume picker filters' }]
          }
        },
        {
          type: 'message',
          timestamp: '2026-05-01T11:00:02.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Done' }],
            model: 'pi-model',
            usage: { input: 500, output: 125 }
          }
        }
      ])
    )

    const result = await scanAiVaultSessions({
      ...roots,
      platform: 'darwin',
      limit: 1,
      unlimited: true
    })

    expect(result.issues).toEqual([])
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions.map((session) => session.title).sort()).toEqual([
      'Fix the resume picker filters',
      'Vault polish pass'
    ])
    const claude = result.sessions.find((session) => session.agent === 'claude')
    expect(claude).toMatchObject({
      sessionId: 'claude-session',
      cwd: '/repo/app',
      branch: 'feature/vault',
      model: 'claude-sonnet-4-5',
      messageCount: 2,
      totalTokens: 155,
      resumeCommand: "cd '/repo/app' && claude --resume 'claude-session'"
    })
    // Why: list scans omit firstUserPrompt so the vault payload stays bounded.
    expect(claude?.firstUserPrompt).toBeUndefined()

    const pi = result.sessions.find((session) => session.agent === 'pi')
    expect(pi).toMatchObject({
      sessionId: 'pi-session',
      cwd: '/repo/pi',
      model: 'pi-model',
      messageCount: 2,
      totalTokens: 625,
      codexHome: null,
      resumeCommand: "cd '/repo/pi' && pi --session 'pi-session'"
    })
    expect(pi?.firstUserPrompt).toBeUndefined()
  })

  it('indexes WSL home session roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-wsl-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    const wslHome = join(root, 'wsl', 'Ubuntu', 'home', 'ada')
    await mkdir(join(wslHome, '.claude', 'projects', 'repo'), { recursive: true })
    await mkdir(join(wslHome, '.pi', 'agent', 'sessions'), { recursive: true })

    await writeFile(
      join(wslHome, '.claude', 'projects', 'repo', 'claude-wsl.jsonl'),
      jsonLines([
        {
          type: 'user',
          sessionId: 'claude-wsl',
          timestamp: '2026-06-10T10:00:00.000Z',
          cwd: '/home/ada/repo',
          message: { role: 'user', content: 'Claude WSL title' }
        }
      ])
    )
    await writeFile(
      join(wslHome, '.pi', 'agent', 'sessions', 'pi-wsl.jsonl'),
      jsonLines([
        {
          type: 'session',
          id: 'pi-wsl',
          timestamp: '2026-06-10T10:01:00.000Z',
          cwd: '/home/ada/repo'
        },
        {
          type: 'message',
          timestamp: '2026-06-10T10:01:01.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Pi WSL title' }] }
        }
      ])
    )

    const result = await scanAiVaultSessions({
      ...roots,
      wslHomeDirs: [wslHome],
      platform: 'win32'
    })

    expect(result.issues).toEqual([])
    expect(result.sessions.map((session) => session.title).sort()).toEqual([
      'Claude WSL title',
      'Pi WSL title'
    ])
  })

  it('indexes every supported agent transcript format with native resume commands', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-all-agents-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)

    await mkdir(join(roots.claudeProjectsDir, 'project'), { recursive: true })
    await writeFile(
      join(roots.claudeProjectsDir, 'project', 'claude-session.jsonl'),
      jsonLines([
        {
          type: 'user',
          sessionId: 'claude-session',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/tmp/claude',
          message: { role: 'user', content: 'Claude title' }
        }
      ])
    )

    await mkdir(join(roots.opencodeStorageDir, 'session', 'project'), { recursive: true })
    await mkdir(join(roots.opencodeStorageDir, 'message', 'opencode-session'), { recursive: true })
    await writeFile(
      join(roots.opencodeStorageDir, 'session', 'project', 'ses_opencode.json'),
      JSON.stringify({
        id: 'opencode-session',
        directory: '/tmp/opencode',
        title: 'OpenCode title',
        time: { created: 1_777_634_000_000, updated: 1_777_634_001_000 }
      })
    )
    await writeFile(
      join(roots.opencodeStorageDir, 'message', 'opencode-session', 'msg_1.json'),
      JSON.stringify({
        role: 'user',
        summary: { title: 'OpenCode title' },
        time: { created: 1_777_634_000_000 },
        tokens: { input: 7, output: 3 }
      })
    )

    await mkdir(roots.piSessionsDir, { recursive: true })
    await writeFile(
      join(roots.piSessionsDir, 'pi-session.jsonl'),
      jsonLines([
        {
          type: 'session',
          id: 'pi-session',
          timestamp: '2026-05-01T10:08:00.000Z',
          cwd: '/tmp/pi'
        },
        {
          type: 'message',
          timestamp: '2026-05-01T10:08:01.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Pi title' }] }
        }
      ])
    )

    const result = await scanAiVaultSessions({ ...roots, platform: 'darwin', limit: 20 })

    expect(result.issues).toEqual([])
    expect(new Set(result.sessions.map((session) => session.agent))).toEqual(
      new Set(AI_VAULT_AGENTS)
    )

    const commandByAgent = new Map(
      result.sessions.map((session) => [session.agent, session.resumeCommand])
    )
    expect(commandByAgent.get('claude')).toBe(
      "cd '/tmp/claude' && claude --resume 'claude-session'"
    )
    expect(commandByAgent.get('opencode')).toBe(
      "cd '/tmp/opencode' && opencode --session 'opencode-session'"
    )
    expect(commandByAgent.get('pi')).toBe("cd '/tmp/pi' && pi --session 'pi-session'")
  })

  it('captures an in-progress Pi model from model_change before any assistant reply', async () => {
    // No assistant message yet: the model must come from model_change alone.
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-pi-mc-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    await mkdir(roots.piSessionsDir, { recursive: true })
    await writeFile(
      join(roots.piSessionsDir, 'pi-in-progress.jsonl'),
      jsonLines([
        {
          type: 'session',
          id: 'pi-in-progress',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/tmp/pi'
        },
        {
          type: 'model_change',
          modelId: 'pi-mc-only-model',
          timestamp: '2026-05-01T10:00:01.000Z'
        },
        {
          type: 'message',
          timestamp: '2026-05-01T10:00:02.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'first prompt' }] }
        }
      ])
    )

    const result = await scanAiVaultSessions({ ...roots, platform: 'darwin', limit: 5 })
    const session = result.sessions.find((s) => s.agent === 'pi')
    expect(session?.model).toBe('pi-mc-only-model')
  })
})
