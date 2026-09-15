import { describe, expect, it, vi } from 'vitest'
import {
  OrcaRuntimeService,
  getDefaultWorkspaceSession,
  join,
  makePaneKey,
  mkdtemp,
  setPlatform,
  setTerminalViewAttributes,
  tmpdir
} from '../orca-runtime-test-mocks.spec'
import type { OrchestrationDb } from '../orchestration/db'
import type {
  AgentSessionExecutionClaim,
  AgentSessionSurfaceBinding
} from '../orca-runtime-test-mocks.spec'
import {
  HEADLESS_LEAF_ID,
  RESTORED_AUTHORITY_TOKEN,
  RESTORED_AUTHORITY_TOKEN_HASH,
  TEST_FOLDER_WORKSPACE_KEY,
  TEST_WINDOW_ID,
  TEST_WORKTREE_ID,
  TEST_WORKTREE_PATH,
  UUID_RE,
  createFolderWorkspaceRuntimeStore,
  makeFolderProjectGroup,
  makeFolderWorkspace,
  makeHeadlessTerminalLayout,
  makeWorkspaceSessionWithHeadlessTerminal,
  store
} from '../orca-runtime-test-fixtures.spec'

describe('OrcaRuntimeService', () => {
  it('preserves SSH dispatch authority commitment across transient relay loss', async () => {
    const targetId = 'ssh-1'
    const ptyId = `ssh:${targetId}@@pty-retained`
    const tabId = 'ssh-worker'
    const paneKey = makePaneKey(tabId, HEADLESS_LEAF_ID)
    const incarnationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const sshSession = makeWorkspaceSessionWithHeadlessTerminal({
      activeTabId: tabId,
      activeTabIdByWorktree: { [TEST_WORKTREE_ID]: tabId },
      tabsByWorktree: {
        [TEST_WORKTREE_ID]: [
          {
            id: tabId,
            ptyId,
            worktreeId: TEST_WORKTREE_ID,
            title: 'SSH worker',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1
          }
        ]
      },
      terminalLayoutsByTabId: {
        [tabId]: makeHeadlessTerminalLayout({ [HEADLESS_LEAF_ID]: ptyId })
      },
      terminalPtyIncarnationsByPaneKey: { [paneKey]: incarnationId }
    })
    const retireAuthority = vi.fn()
    const failDispatch = vi.fn()
    const runtime = new OrcaRuntimeService(
      {
        ...store,
        getWorkspaceSession: (hostId?: string | null) =>
          hostId === `ssh:${targetId}` ? sshSession : getDefaultWorkspaceSession()
      },
      undefined,
      {
        attestAgentHookCompatibilityAuthority: ({
          paneKey: candidate,
          launchTokenHash,
          connectionId
        }) =>
          candidate === paneKey &&
          launchTokenHash === RESTORED_AUTHORITY_TOKEN_HASH &&
          connectionId === targetId
            ? { paneKey: candidate, source: 'hydrated_commitment' }
            : null,
        retireAgentHookCompatibilityAuthority: retireAuthority
      }
    )
    runtime.setOrchestrationDb({
      getActiveDispatchForTerminal: (handle: string) =>
        handle === 'term_ssh_retained'
          ? { id: 'dispatch-ssh', task_id: 'task-ssh', status: 'dispatched' }
          : undefined,
      failDispatch,
      getActiveCoordinatorRun: () => undefined
    } as unknown as OrchestrationDb)
    runtime.attachWindow(TEST_WINDOW_ID)
    runtime.syncWindowGraph(TEST_WINDOW_ID, {
      tabs: [
        {
          tabId,
          worktreeId: TEST_WORKTREE_ID,
          title: 'SSH worker',
          activeLeafId: HEADLESS_LEAF_ID,
          layout: null
        }
      ],
      leaves: [
        {
          tabId,
          worktreeId: TEST_WORKTREE_ID,
          leafId: HEADLESS_LEAF_ID,
          paneRuntimeId: 1,
          ptyId
        }
      ]
    })
    const listProcesses = vi.fn(async () => [
      {
        id: ptyId,
        incarnationId,
        terminalHandle: 'term_ssh_retained',
        title: 'SSH worker',
        cwd: TEST_WORKTREE_PATH,
        worktreeId: TEST_WORKTREE_ID,
        wslDistro: null
      }
    ])
    runtime.setPtyController({
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null,
      listProcesses
    })
    const refreshInventory = (connectionId: string | undefined) =>
      (
        runtime as unknown as {
          refreshPtyWorktreeRecordsWithControllerInventory: (
            worktrees: [],
            targetWorktreeId: string | null,
            deadline: number | undefined,
            connectionId: string | undefined
          ) => Promise<unknown>
        }
      ).refreshPtyWorktreeRecordsWithControllerInventory([], null, undefined, connectionId)
    const host = runtime.registerOrchestrationCompatibilitySshAttachment(
      targetId,
      'connection-incarnation'
    )
    const evidence = {
      terminalHandle: 'term_ssh_retained',
      paneKey,
      launchToken: RESTORED_AUTHORITY_TOKEN,
      host
    } as const

    await expect(refreshInventory(targetId)).resolves.not.toBeNull()
    expect(runtime.verifyOrchestrationCompatibilityCaller(evidence)).not.toBeNull()
    await expect(refreshInventory(undefined)).resolves.not.toBeNull()
    expect(runtime.verifyOrchestrationCompatibilityCaller(evidence)).not.toBeNull()

    runtime.onPtyExit(ptyId, -1, incarnationId)

    expect(runtime.verifyOrchestrationCompatibilityCaller(evidence)).toBeNull()
    expect(retireAuthority).not.toHaveBeenCalled()
    expect(failDispatch).not.toHaveBeenCalled()

    await expect(refreshInventory(targetId)).resolves.not.toBeNull()

    expect(runtime.verifyOrchestrationCompatibilityCaller(evidence)).not.toBeNull()
    expect(listProcesses).toHaveBeenCalledTimes(3)
  })

  it('passes cached view colors to background agent spawns for source-owned startup replies', async () => {
    setTerminalViewAttributes({
      foreground: [0xff, 0xff, 0xff],
      background: [0x28, 0x2c, 0x34],
      cursor: [0xff, 0xff, 0xff],
      ansi: Array.from({ length: 256 }, () => [0, 0, 0] as [number, number, number]),
      colorSchemeMode: 'dark',
      cursorStyle: 'block',
      cursorBlink: false
    })
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtime = new OrcaRuntimeService(store)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, { command: 'claude' })

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalColorQueryReplies: {
          foreground: '#ffffff',
          background: '#282c34'
        }
      })
    )
  })

  it('does not register or publish a PTY incarnation that exited before spawn resolved', async () => {
    const runtime = new OrcaRuntimeService(store)
    const tabId = '11111111-1111-4111-8111-111111111111'
    const leafId = '22222222-2222-4222-8222-222222222222'
    runtime.setPtyController({
      spawn: vi.fn(async () => {
        runtime.beginPtyRegistration('pty-exited-during-start', 'incarnation-exited-during-start')
        runtime.onPtyExit('pty-exited-during-start', 0, 'incarnation-exited-during-start')
        return {
          id: 'pty-exited-during-start',
          incarnationId: 'incarnation-exited-during-start'
        }
      }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await expect(
      runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
        command: 'claude',
        presentation: 'background',
        tabId,
        leafId
      })
    ).rejects.toThrow('agent_session_exited_during_start')
    await expect(runtime.listTerminals(`id:${TEST_WORKTREE_ID}`)).resolves.toMatchObject({
      terminals: []
    })
    await expect(runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)).resolves.toMatchObject({
      tabs: []
    })
    const internals = runtime as unknown as {
      handleByPtyId: Map<string, string>
      ptysById: Map<string, unknown>
    }
    expect(internals.handleByPtyId.has('pty-exited-during-start')).toBe(false)
    expect(internals.ptysById.has('pty-exited-during-start')).toBe(false)
  })

  it('adopts repeated structured resumes of the same provider session', async () => {
    let canonicalOwner:
      | {
          claim: AgentSessionExecutionClaim
          generation: string
          phase: 'live'
          ptyId: string
          surface: AgentSessionSurfaceBinding
        }
      | undefined
    const spawn = vi.fn(async (options) => {
      const ensure = options.agentSessionEnsure
      expect(ensure).toBeDefined()
      canonicalOwner ??= {
        claim: ensure!.claim,
        generation: 'generation-1',
        phase: 'live',
        ptyId: 'pty-claimed',
        surface: ensure!.surface
      }
      return {
        id: 'pty-claimed',
        agentSessionEnsure: {
          disposition: spawn.mock.calls.length === 1 ? ('created' as const) : ('adopted' as const),
          owner: canonicalOwner
        }
      }
    })
    const runtime = new OrcaRuntimeService(store)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    const request = {
      kind: 'explicit' as const,
      worktree: `id:${TEST_WORKTREE_ID}`,
      agent: 'claude' as const,
      providerSession: { key: 'session_id' as const, id: 'provider-session-1' }
    }
    const first = await runtime.ensureAgentSession(request)
    const second = await runtime.ensureAgentSession(request)

    expect(first.disposition).toBe('created')
    expect(second.disposition).toBe('adopted')
    expect(second.terminal).toMatchObject({
      handle: first.terminal.handle,
      tabId: first.terminal.tabId,
      paneKey: first.terminal.paneKey
    })
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringContaining("'--resume' 'provider-session-1'"),
        agentSessionEnsure: expect.objectContaining({
          claim: expect.objectContaining({ agent: 'claude' })
        })
      })
    )
  })

  it('builds structured fresh drafts with supported launch preferences on the host', async () => {
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-agent-draft' })
    const runtime = new OrcaRuntimeService({
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: { claude: 'host-claude' },
        agentDefaultArgs: { claude: '--host-default' },
        agentDefaultEnv: { claude: { HOST_PROFILE: 'true' } }
      })
    })
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createAgentSession(
      {
        clientOperationId: `${Date.now()}-${'ab'.repeat(16)}`,
        worktree: `id:${TEST_WORKTREE_ID}`,
        agent: 'claude',
        prompt: 'review before sending',
        promptDelivery: 'draft',
        agentArgs: '--permission-mode plan',
        launchPreferences: { model: 'opus', effort: 'high' }
      },
      { clientId: 'renderer-1', clientKind: 'runtime' }
    )

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringMatching(
          /^host-claude '--model' 'opus'.*'--permission-mode' 'plan'.*--prefill 'review before sending'/
        ),
        env: expect.objectContaining({ HOST_PROFILE: 'true' })
      })
    )
    expect(spawn.mock.calls[0]?.[0]?.command).not.toContain('--host-default')
  })

  it('applies Settings agent defaults to bare agent command terminal creates', async () => {
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtimeStore = {
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: {},
        agentDefaultArgs: { opencode: '--print-logs' },
        agentDefaultEnv: { opencode: { OPENCODE_PROFILE: 'captured' } }
      })
    }
    const runtime = new OrcaRuntimeService(runtimeStore)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
      command: 'opencode',
      title: 'worker'
    })

    const spawnCall = spawn.mock.calls[0]?.[0] as
      | { command?: string; env?: Record<string, string> }
      | undefined
    expect(spawnCall?.command).toBe("opencode '--print-logs'")
    expect(spawnCall?.env).toMatchObject({
      OPENCODE_PROFILE: 'captured',
      ORCA_WORKTREE_ID: TEST_WORKTREE_ID
    })
    expect(spawnCall?.env?.ORCA_AGENT_LAUNCH_TOKEN).toMatch(UUID_RE)
  })

  it('launches the configured agent CLI for a startupAgent id', async () => {
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtimeStore = {
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: {},
        agentDefaultArgs: { opencode: '--force' },
        agentDefaultEnv: { opencode: { OPENCODE_PROFILE: 'captured' } }
      })
    }
    const runtime = new OrcaRuntimeService(runtimeStore)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
      startupAgent: 'opencode',
      title: 'worker'
    })

    const spawnCall = spawn.mock.calls[0]?.[0] as
      | { command?: string; launchAgent?: string; env?: Record<string, string> }
      | undefined
    expect(spawnCall?.command).toBe("opencode '--force'")
    expect(spawnCall?.launchAgent).toBe('opencode')
    expect(spawnCall?.env).toMatchObject({ OPENCODE_PROFILE: 'captured' })
  })

  it('quotes a startupAgent launch for cmd.exe on Windows', async () => {
    setPlatform('win32')
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtimeStore = {
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        terminalWindowsShell: 'cmd.exe',
        agentCmdOverrides: {},
        // Why: pin the arg here rather than inherit the shared yolo default, so
        // this test tracks Windows quoting and not an unrelated default's value.
        agentDefaultArgs: { opencode: '--force' },
        agentDefaultEnv: {}
      })
    }
    const runtime = new OrcaRuntimeService(runtimeStore)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, { startupAgent: 'opencode' })

    const spawnCall = spawn.mock.calls[0]?.[0] as { command?: string } | undefined
    // Why: assert the cmd.exe double quoting too — a platform-insensitive prefix
    // match would pass on any OS and prove nothing about the reported platform.
    expect(spawnCall?.command).toBe('opencode "--force"')
  })

  // Why: claude-agent-teams is the only agent whose launcher name varies by
  // platform (launchCmdByPlatform), so it is what proves resolution is
  // platform-aware rather than a fixed string.
  it.each([
    { platform: 'win32' as const, expected: 'orca.cmd claude-teams' },
    { platform: 'linux' as const, expected: 'orca-ide claude-teams' },
    { platform: 'darwin' as const, expected: 'orca claude-teams' }
  ])(
    'resolves a startupAgent through the $platform launcher name',
    async ({ platform, expected }) => {
      setPlatform(platform)
      const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
      const runtime = new OrcaRuntimeService({
        ...store,
        getSettings: () => ({
          ...store.getSettings(),
          disabledTuiAgents: [],
          agentCmdOverrides: {},
          agentDefaultArgs: { 'claude-agent-teams': '' },
          agentDefaultEnv: {}
        })
      })
      runtime.setPtyController({
        spawn,
        write: () => true,
        kill: () => true,
        getForegroundProcess: async () => null
      })

      await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
        startupAgent: 'claude-agent-teams'
      })

      const spawnCall = spawn.mock.calls[0]?.[0] as { command?: string } | undefined
      expect(spawnCall?.command).toBe(expected)
    }
  )

  it('honors an agentCmdOverrides entry for a startupAgent', async () => {
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtime = new OrcaRuntimeService({
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: { opencode: 'opencode --beta' },
        agentDefaultArgs: { opencode: '--force' },
        agentDefaultEnv: {}
      })
    })
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, { startupAgent: 'opencode' })

    const spawnCall = spawn.mock.calls[0]?.[0] as { command?: string } | undefined
    expect(spawnCall?.command).toBe("opencode --beta '--force'")
  })

  // Why: with no selector the launch is never resolved, so a dropped startupAgent
  // would reach the renderer as a bare shell — the failure this option prevents.
  it('rejects a startupAgent create with no workspace selector', async () => {
    const runtime = new OrcaRuntimeService({
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: {}
      })
    })

    await expect(
      runtime.createTerminal(undefined, { startupAgent: 'opencode', rendererBacked: true })
    ).rejects.toThrow(/requires a workspace selector/)
  })

  // Why: folder workspaces have no repo, so command sniffing skipped them entirely
  // and spawned the bare string; an explicit agent must still resolve.
  it('resolves a startupAgent in a repo-less folder workspace', async () => {
    const folderPath = await mkdtemp(join(tmpdir(), 'orca-runtime-folder-startup-agent-'))
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const folderWorkspace = makeFolderWorkspace({ folderPath })
    const projectGroup = makeFolderProjectGroup({ parentPath: folderPath })
    const runtime = new OrcaRuntimeService({
      ...createFolderWorkspaceRuntimeStore(folderWorkspace, projectGroup),
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: {},
        agentDefaultArgs: { opencode: '--force' },
        agentDefaultEnv: {}
      })
    } as never)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`id:${TEST_FOLDER_WORKSPACE_KEY}`, { startupAgent: 'opencode' })

    const spawnCall = spawn.mock.calls[0]?.[0] as
      | { command?: string; launchAgent?: string }
      | undefined
    expect(spawnCall?.command).toBe("opencode '--force'")
    expect(spawnCall?.launchAgent).toBe('opencode')
  })

  // Why: silently returning the caller's opts would spawn a bare shell that can
  // only time out at agent readiness — the failure startupAgent exists to stop.
  it('rejects a startupAgent create that also supplies its own launch', async () => {
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtime = new OrcaRuntimeService({
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        agentCmdOverrides: {}
      })
    })
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    for (const conflicting of [
      { env: { SOME_VAR: 'set' } },
      // Why: a raw command would be silently overwritten by the built launch.
      { command: 'opencode --continue' },
      // Why: resume identity paired with a freshly built launch is incoherent.
      { resumeProviderSession: { key: 'session_id', id: 'prior-session' } as never },
      { launchAgent: 'opencode' as const },
      { launchConfig: { agentArgs: '', agentEnv: {} } as never },
      { startupCommandDelivery: 'provider' as never },
      { claudeAgentTeamsSourceCommand: 'claude' }
    ]) {
      await expect(
        runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
          startupAgent: 'opencode',
          ...conflicting
        })
      ).rejects.toThrow(/cannot combine/)
    }
    expect(spawn).not.toHaveBeenCalled()
  })

  it('rejects a startupAgent create for a disabled agent', async () => {
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtimeStore = {
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: ['opencode' as const],
        agentCmdOverrides: {}
      })
    }
    const runtime = new OrcaRuntimeService(runtimeStore)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await expect(
      runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, { startupAgent: 'opencode' })
    ).rejects.toThrow(/disabled/)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('quotes local Windows bare agent command defaults for cmd.exe terminal creates', async () => {
    setPlatform('win32')
    const spawn = vi.fn().mockResolvedValue({ id: 'pty-bg' })
    const runtimeStore = {
      ...store,
      getSettings: () => ({
        ...store.getSettings(),
        disabledTuiAgents: [],
        terminalWindowsShell: 'cmd.exe',
        agentCmdOverrides: {},
        agentDefaultArgs: { claude: '--dangerously-skip-permissions' },
        agentDefaultEnv: {}
      })
    }
    const runtime = new OrcaRuntimeService(runtimeStore)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })

    await runtime.createTerminal(`path:${TEST_WORKTREE_PATH}`, {
      command: 'claude',
      title: 'worker'
    })

    const spawnCall = spawn.mock.calls[0]?.[0] as { command?: string } | undefined
    expect(spawnCall?.command).toBe('claude "--dangerously-skip-permissions"')
  })
})
