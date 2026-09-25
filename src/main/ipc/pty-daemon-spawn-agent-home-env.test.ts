import { describe, expect, it, vi } from 'vitest'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import {
  type DaemonSpawnCall,
  createDaemonActiveProviderFixtures
} from './pty-ipc-daemon-provider-fixtures'
import { delimiter, join } from 'node:path'
import { LEGACY_TERMINAL_SHIM_REMOTE_ENV_KEYS } from '../pty/legacy-terminal-shim-dir'
import { wslHookRelayManager } from '../agent-hooks/wsl-hook-relay-manager'
import { registerPtyHandlers } from './pty'

vi.mock('electron', () => import('./pty-ipc-mock-registry').then((m) => m.electronModuleMock()))
vi.mock('fs', () => import('./pty-ipc-mock-registry').then((m) => m.fsModuleMock()))
vi.mock('node-pty', () => import('./pty-ipc-mock-registry').then((m) => m.nodePtyModuleMock()))
vi.mock('node:child_process', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).childProcessModuleMock(await importOriginal())
)
vi.mock('../opencode/hook-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.openCodeHookServiceModuleMock())
)
vi.mock('../agent-hooks/server', () =>
  import('./pty-ipc-mock-registry').then((m) => m.agentHookServerModuleMock())
)
vi.mock('../pi/titlebar-extension-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.piTitlebarExtensionModuleMock())
)
vi.mock('../pwsh', () => import('./pty-ipc-mock-registry').then((m) => m.pwshModuleMock()))
vi.mock('../wsl', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).wslModuleMock(await importOriginal())
)
vi.mock('../cli/linux-terminal-orca-cli-shim', () =>
  import('./pty-ipc-mock-registry').then((m) => m.linuxCliShimModuleMock())
)
vi.mock('../memory/pty-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.ptyRegistryModuleMock())
)
vi.mock('../agent-hooks/migration-unsupported-pty-state', () =>
  import('./pty-ipc-mock-registry').then((m) => m.migrationUnsupportedPtyModuleMock())
)

describe('registerPtyHandlers', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()

  describe('spawn environment', () => {
    describe('daemon-active provider (parity with LocalPtyProvider)', () => {
      const {
        setupDaemonAdapter,
        withWin32Platform,
        daemonSpawnAndGetOptions,
        daemonSpawnAndGetEnv
      } = createDaemonActiveProviderFixtures({ handlers, mainWindow })
      it('injects explicit proxy settings on the daemon path', async () => {
        const env = await daemonSpawnAndGetEnv({}, () => ({
          httpProxyUrl: 'http://proxy.example:8080',
          httpProxyBypassRules: 'localhost;*.internal'
        }))

        expect(env.HTTP_PROXY).toBe('http://proxy.example:8080')
        expect(env.HTTPS_PROXY).toBe('http://proxy.example:8080')
        expect(env.NO_PROXY).toBe('localhost,*.internal')
      })
      it('drops OPENCODE_CONFIG_DIR for a WSL daemon spawn until the guest overlay is known', async () => {
        await withWin32Platform(async () => {
          const env = await daemonSpawnAndGetEnv({}, undefined, undefined, {
            shellOverride: 'wsl.exe'
          })
          // Why: relay not connected yet → never cross the Windows overlay path into WSL.
          expect(env.OPENCODE_CONFIG_DIR).toBeUndefined()
          expect(env.GIRRA_OPENCODE_CONFIG_DIR).toBeUndefined()
          expect(env.GIRRA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
        })
      })
      it('points OPENCODE_CONFIG_DIR at the guest overlay when the WSL relay reports it', async () => {
        const guestDir = '/home/jin/.orca-relay/opencode-overlays/abc'
        const spy = vi.spyOn(wslHookRelayManager, 'getOpenCodeOverlayDir').mockReturnValue(guestDir)
        try {
          await withWin32Platform(async () => {
            const env = await daemonSpawnAndGetEnv(
              { GIRRA_OPENCODE_SOURCE_CONFIG_DIR: '/home/jin/.config/opencode' },
              undefined,
              undefined,
              { shellOverride: 'wsl.exe' }
            )
            expect(env.OPENCODE_CONFIG_DIR).toBe(guestDir)
            expect(env.GIRRA_OPENCODE_CONFIG_DIR).toBe(guestDir)
            // The Windows-side source pointer must not cross into the guest.
            expect(env.GIRRA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
          })
        } finally {
          spy.mockRestore()
        }
      })
      it('strips inherited Claude child-session stamps from daemon spawns', async () => {
        // Why: a daemon forked from inside a Claude Code session inherits these
        // stamps and would mark every terminal as a nested Claude child, which
        // silently disables transcript persistence for real user sessions.
        const spawnOptions = await daemonSpawnAndGetOptions(undefined, undefined, {
          CLAUDE_CODE_CHILD_SESSION: '1',
          CLAUDE_CODE_SESSION_ID: '85935aed-98a7-4094-89a8-85c75e1a5a95',
          CLAUDE_CODE_BRIDGE_SESSION_ID: 'session_01UCkWN5nDXNyD1V7cfamCxa'
        })
        expect(spawnOptions.envToDelete).toEqual(
          expect.arrayContaining([
            'CLAUDE_CODE_CHILD_SESSION',
            'CLAUDE_CODE_SESSION_ID',
            'CLAUDE_CODE_BRIDGE_SESSION_ID'
          ])
        )
      })
      it('preserves an explicitly requested Claude child-session stamp', async () => {
        // Why: only inherited values are poison; a caller deliberately spawning a
        // nested Claude child passes the stamp in args.env and must keep it.
        const spawnOptions = await daemonSpawnAndGetOptions(
          { CLAUDE_CODE_CHILD_SESSION: '1' },
          undefined,
          { CLAUDE_CODE_CHILD_SESSION: '1' }
        )
        expect(spawnOptions.envToDelete ?? []).not.toEqual(
          expect.arrayContaining(['CLAUDE_CODE_CHILD_SESSION'])
        )
        expect(spawnOptions.env.CLAUDE_CODE_CHILD_SESSION).toBe('1')
      })
      it('prepends the bare-orca CLI shim dir to PATH for packaged Linux spawns', async () => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', {
          configurable: true,
          value: 'linux'
        })
        try {
          // Why: overriding process.platform doesn't change the loaded node:path dialect; keep this synthetic PATH consistent.
          const env = await daemonSpawnAndGetEnv({
            PATH: ['/usr/local/bin', '/usr/bin'].join(delimiter)
          })
          const entries = env.PATH.split(delimiter)
          const shimDir = join('/tmp/orca-user-data', 'linux-orca-cli-shim')
          // Why: bare `orca` must resolve to the Girra CLI before /usr/bin/orca (the GNOME screen reader) in Girra terminals (#7904).
          expect(entries.indexOf(shimDir)).toBeGreaterThanOrEqual(0)
          expect(entries.indexOf(shimDir)).toBeLessThan(entries.indexOf('/usr/bin'))
          expect(env.GIRRA_CLI_COMMAND).toBeUndefined()
        } finally {
          Object.defineProperty(process, 'platform', {
            configurable: true,
            value: originalPlatform
          })
        }
      })
      it('prepends the bundled CLI dir to PATH for packaged macOS spawns', async () => {
        const resourcesPathDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
        Object.defineProperty(process, 'resourcesPath', {
          configurable: true,
          value: '/tmp/orca-resources'
        })
        try {
          const env = await daemonSpawnAndGetEnv({ PATH: '/usr/bin' })
          expect(env.PATH.split(delimiter)[0]).toBe(join('/tmp/orca-resources', 'bin'))
        } finally {
          if (resourcesPathDescriptor) {
            Object.defineProperty(process, 'resourcesPath', resourcesPathDescriptor)
          } else {
            Reflect.deleteProperty(process, 'resourcesPath')
          }
        }
      })
      it('injects the agent-hook receiver env on the daemon path', async () => {
        const env = await daemonSpawnAndGetEnv({})
        expect(env.GIRRA_AGENT_HOOK_PORT).toBe('5678')
        expect(env.GIRRA_AGENT_HOOK_TOKEN).toBe('agent-token')
      })
      it('deletes stale Claude scoped settings env from daemon-hosted PTYs', async () => {
        const spawnOptions = await daemonSpawnAndGetOptions({}, undefined, {
          GIRRA_CLAUDE_AGENT_STATUS_SETTINGS:
            '/tmp/orca/agent-hooks/claude-agent-status-settings.json'
        })
        expect(spawnOptions.env.GIRRA_CLAUDE_AGENT_STATUS_SETTINGS).toBeUndefined()
        expect(spawnOptions.envToDelete).toEqual(
          expect.arrayContaining(['GIRRA_CLAUDE_AGENT_STATUS_SETTINGS'])
        )
        expect(spawnOptions.env.GIRRA_AGENT_HOOK_PORT).toBe('5678')
        expect(spawnOptions.env.GIRRA_AGENT_HOOK_TOKEN).toBe('agent-token')
      })
      it('asks surviving pre-upgrade daemons to delete legacy attribution env', async () => {
        const spawnOptions = await daemonSpawnAndGetOptions({})

        expect(spawnOptions.envToDelete).toEqual(
          expect.arrayContaining([...LEGACY_TERMINAL_SHIM_REMOTE_ENV_KEYS])
        )
        expect(spawnOptions.envToDelete).not.toContain('GIRRA_REAL_GIT')
        expect(spawnOptions.envToDelete).not.toContain('GIRRA_REAL_GH')
      })
      it('deletes stale Claude scoped settings env from runtime-created daemon PTYs', async () => {
        type RuntimeSpawnController = {
          spawn(args: {
            cols: number
            rows: number
            worktreeId?: string
            env?: Record<string, string>
            envToDelete?: string[]
            command?: string
          }): Promise<{ id: string }>
        }
        const daemonSpawn = setupDaemonAdapter()
        const runtime = {
          setPtyController: vi.fn(),
          registerPty: vi.fn(),
          noteTerminalSpawnCommand: vi.fn(),
          onPtySpawned: vi.fn(),
          onPtyExit: vi.fn(),
          onPtyData: vi.fn()
        }
        process.env.GIRRA_CLAUDE_AGENT_STATUS_SETTINGS =
          '/tmp/orca/agent-hooks/claude-agent-status-settings.json'
        handlers.clear()
        registerPtyHandlers(mainWindow as never, runtime as never)
        const controller = runtime.setPtyController.mock.calls[0]?.[0] as RuntimeSpawnController

        await controller.spawn({ cols: 80, rows: 24, worktreeId: 'wt-runtime', env: {} })

        const spawnOptions = daemonSpawn.mock.calls.at(-1)?.[0] as DaemonSpawnCall
        expect(spawnOptions.env.GIRRA_CLAUDE_AGENT_STATUS_SETTINGS).toBeUndefined()
        expect(spawnOptions.envToDelete).toEqual(
          expect.arrayContaining(['GIRRA_CLAUDE_AGENT_STATUS_SETTINGS'])
        )
        expect(spawnOptions.env.GIRRA_AGENT_HOOK_PORT).toBe('5678')
        expect(spawnOptions.env.GIRRA_AGENT_HOOK_TOKEN).toBe('agent-token')
      })
      it('asks surviving pre-upgrade daemons to delete legacy attribution env for runtime PTYs', async () => {
        type RuntimeSpawnController = {
          spawn(args: {
            cols: number
            rows: number
            worktreeId?: string
            env?: Record<string, string>
          }): Promise<{ id: string }>
        }
        const daemonSpawn = setupDaemonAdapter()
        const runtime = {
          setPtyController: vi.fn(),
          registerPty: vi.fn(),
          noteTerminalSpawnCommand: vi.fn(),
          onPtySpawned: vi.fn(),
          onPtyExit: vi.fn(),
          onPtyData: vi.fn()
        }
        handlers.clear()
        registerPtyHandlers(mainWindow as never, runtime as never)
        const controller = runtime.setPtyController.mock.calls[0]?.[0] as RuntimeSpawnController

        await controller.spawn({ cols: 80, rows: 24, worktreeId: 'wt-runtime', env: {} })

        const spawnOptions = daemonSpawn.mock.calls.at(-1)?.[0] as DaemonSpawnCall
        expect(spawnOptions.envToDelete).toEqual(
          expect.arrayContaining([...LEGACY_TERMINAL_SHIM_REMOTE_ENV_KEYS])
        )
        expect(spawnOptions.envToDelete).not.toContain('GIRRA_REAL_GIT')
        expect(spawnOptions.envToDelete).not.toContain('GIRRA_REAL_GH')
      })
      it('strips inherited Claude child-session stamps from runtime-created PTYs', async () => {
        // Why: the runtime controller is the `orca` CLI / automation spawn path and
        // assembles envToDelete separately from the renderer's pty:spawn handler;
        // without its own case the two paths can silently drift apart.
        type RuntimeSpawnController = {
          spawn(args: {
            cols: number
            rows: number
            worktreeId?: string
            env?: Record<string, string>
          }): Promise<{ id: string }>
        }
        const daemonSpawn = setupDaemonAdapter()
        const runtime = {
          setPtyController: vi.fn(),
          registerPty: vi.fn(),
          noteTerminalSpawnCommand: vi.fn(),
          onPtySpawned: vi.fn(),
          onPtyExit: vi.fn(),
          onPtyData: vi.fn()
        }
        handlers.clear()
        registerPtyHandlers(mainWindow as never, runtime as never)
        const controller = runtime.setPtyController.mock.calls[0]?.[0] as RuntimeSpawnController

        await controller.spawn({ cols: 80, rows: 24, worktreeId: 'wt-runtime', env: {} })

        const spawnOptions = daemonSpawn.mock.calls.at(-1)?.[0] as DaemonSpawnCall
        expect(spawnOptions.envToDelete).toEqual(
          expect.arrayContaining([
            'CLAUDE_CODE_CHILD_SESSION',
            'CLAUDE_CODE_SESSION_ID',
            'CLAUDE_CODE_BRIDGE_SESSION_ID'
          ])
        )
      })
    })
  })
})
