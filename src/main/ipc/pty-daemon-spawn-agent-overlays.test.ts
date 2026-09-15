import { describe, expect, it, vi } from 'vitest'
import { openCodeBuildPtyEnvMock, piBuildPtyEnvMock } from './pty-ipc-mock-registry'
import { expectedOmpStatusExtension, TEST_CODEX_HOME } from './pty-ipc-test-constants'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import { createDaemonActiveProviderFixtures } from './pty-ipc-daemon-provider-fixtures'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../shared/setup-agent-sequencing'

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
vi.mock('../codex/codex-state-db-backfill-recovery', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexBackfillRecoveryModuleMock())
)

describe('registerPtyHandlers', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()

  describe('spawn environment', () => {
    describe('daemon-active provider (parity with LocalPtyProvider)', () => {
      const { daemonSpawnAndGetEnv } = createDaemonActiveProviderFixtures({
        handlers,
        mainWindow
      })

      // Why: under the daemon, LocalPtyProvider.buildSpawnEnv never runs, so host-local env injection must happen in the pty:spawn handler instead.
      it('injects OpenCode plugin env (OPENCODE_CONFIG_DIR) on the daemon path', async () => {
        const env = await daemonSpawnAndGetEnv({}, undefined, undefined, {
          OPENCODE_CONFIG_DIR: undefined
        })
        expect(openCodeBuildPtyEnvMock).toHaveBeenCalled()
        expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-config')
        expect(env.ORCA_OPENCODE_HOOK_PORT).toBe('4567')
      })
      it('mirrors a user-provided OPENCODE_CONFIG_DIR into a source-scoped overlay on the daemon path', async () => {
        const env = await daemonSpawnAndGetEnv({ OPENCODE_CONFIG_DIR: '/user/custom/opencode' })
        // Why: OpenCode loads config from a single dir, so the user's path is mirrored into a source-scoped overlay, not passed through.
        expect(openCodeBuildPtyEnvMock).toHaveBeenCalledWith(
          expect.any(String),
          '/user/custom/opencode'
        )
        expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
        expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
        expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBe('/user/custom/opencode')
      })
      it('uses source OpenCode config env instead of remirroring a parent overlay', async () => {
        const env = await daemonSpawnAndGetEnv({
          OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
          ORCA_OPENCODE_SOURCE_CONFIG_DIR: '/user/custom/opencode'
        })
        expect(openCodeBuildPtyEnvMock).toHaveBeenCalledWith(
          expect.any(String),
          '/user/custom/opencode'
        )
        expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
        expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
        expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBe('/user/custom/opencode')
      })
      it('installs Pi managed extensions without redirecting homes on the daemon path', async () => {
        const env = await daemonSpawnAndGetEnv({ PI_CODING_AGENT_DIR: '/user/.pi/agent' })
        expect(piBuildPtyEnvMock).toHaveBeenCalledWith(
          expect.any(String),
          '/user/.pi/agent',
          'pi',
          {
            materializeDefaultHome: false
          }
        )
        expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), undefined, 'omp', {
          materializeDefaultHome: false
        })
        expect(env.PI_CODING_AGENT_DIR).toBe('/user/.pi/agent')
        expect(env.ORCA_PI_CODING_AGENT_DIR).toBeUndefined()
        expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBe('/user/.pi/agent')
        expect(env.ORCA_OMP_CODING_AGENT_DIR).toBeUndefined()
        expect(env.ORCA_OMP_STATUS_EXTENSION).toBe(expectedOmpStatusExtension)
      })
      it('does not materialize agent homes when another daemon agent mentions OMP', async () => {
        const env = await daemonSpawnAndGetEnv(undefined, undefined, undefined, undefined, {
          command: 'codex "ask about omp"',
          launchAgent: 'codex'
        })

        expect(piBuildPtyEnvMock).toHaveBeenCalledTimes(1)
        expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), undefined, 'pi', {
          materializeDefaultHome: false
        })
        expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBeUndefined()
      })
      it('threads command: "omp" through to piBuildPtyEnv on the daemon path with OMP status metadata', async () => {
        // Why: mirror of the local-spawn OMP threading assertion; the daemon path's `command` forwarding could silently regress otherwise.
        const env = await daemonSpawnAndGetEnv(
          { PI_CODING_AGENT_DIR: '/user/.omp/agent' },
          undefined,
          undefined,
          undefined,
          { command: 'omp' }
        )
        expect(piBuildPtyEnvMock).toHaveBeenCalledWith(
          expect.any(String),
          '/user/.omp/agent',
          'omp',
          { materializeDefaultHome: true }
        )
        expect(env.PI_CODING_AGENT_DIR).toBe('/user/.omp/agent')
        expect(env.ORCA_OMP_CODING_AGENT_DIR).toBeUndefined()
        expect(env.ORCA_OMP_STATUS_EXTENSION).toBe(
          '/user/.omp/agent/extensions/orca-agent-status.ts'
        )
        expect(env.ORCA_OMP_SOURCE_AGENT_DIR).toBe('/user/.omp/agent')
        expect(env.ORCA_PI_CODING_AGENT_DIR).toBeUndefined()
        expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBeUndefined()
      })
      it('uses sequenced startup env as the daemon OMP launch hint when command is a wrapper', async () => {
        const env = await daemonSpawnAndGetEnv(
          {
            PI_CODING_AGENT_DIR: '/user/.omp/agent',
            [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: 'omp --resume'
          },
          undefined,
          undefined,
          undefined,
          { command: 'powershell wait-wrapper' }
        )

        expect(piBuildPtyEnvMock).toHaveBeenCalledWith(
          expect.any(String),
          '/user/.omp/agent',
          'omp',
          { materializeDefaultHome: true }
        )
        expect(env.ORCA_OMP_STATUS_EXTENSION).toBe(
          '/user/.omp/agent/extensions/orca-agent-status.ts'
        )
        expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBeUndefined()
      })
      it('injects the selected Codex home on the daemon path', async () => {
        const env = await daemonSpawnAndGetEnv({}, () => TEST_CODEX_HOME)
        expect(env.CODEX_HOME).toBe(TEST_CODEX_HOME)
        expect(env.ORCA_CODEX_HOME).toBe(TEST_CODEX_HOME)
      })
    })
  })
})
