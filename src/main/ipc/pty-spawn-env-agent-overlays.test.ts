import { describe, expect, it, vi } from 'vitest'
import {
  readFileSyncMock,
  openCodeBuildPtyEnvMock,
  piBuildPtyEnvMock
} from './pty-ipc-mock-registry'
import { posixOnlyIt } from './pty-ipc-test-constants'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
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

describe('registerPtyHandlers', () => {
  const { spawnAndGetEnv } = setupPtyIpcSuite()

  describe('spawn environment', () => {
    it('injects the OpenCode hook env into Girra terminal PTYs', async () => {
      // Why: clear any ambient OPENCODE_CONFIG_DIR so the mock's value is used
      const env = await spawnAndGetEnv(undefined, { OPENCODE_CONFIG_DIR: undefined })
      expect(openCodeBuildPtyEnvMock).toHaveBeenCalledTimes(1)
      expect(openCodeBuildPtyEnvMock.mock.calls[0]?.[0]).toEqual(expect.any(String))
      expect(env.ORCA_OPENCODE_HOOK_PORT).toBe('4567')
      expect(env.ORCA_OPENCODE_HOOK_TOKEN).toBe('opencode-token')
      expect(env.ORCA_OPENCODE_PTY_ID).toBe('test-pty')
      expect(env.OPENCODE_CONFIG_DIR).toEqual(expect.any(String))
      expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe(env.OPENCODE_CONFIG_DIR)
    })
    it('mirrors the original OpenCode source dir when launched from a Girra overlay shell', async () => {
      const env = await spawnAndGetEnv({
        OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
        ORCA_OPENCODE_SOURCE_CONFIG_DIR: '/tmp/user-opencode-config'
      })
      expect(openCodeBuildPtyEnvMock).toHaveBeenCalledWith(
        expect.any(String),
        '/tmp/user-opencode-config'
      )
      expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
      expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
      expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBe('/tmp/user-opencode-config')
    })
    it('does not treat inherited Girra OpenCode config as user config without a source dir', async () => {
      const env = await spawnAndGetEnv({
        OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
        ORCA_OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay'
      })

      expect(openCodeBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), undefined)
      expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-config')
      expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-config')
      expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
    })
    it('restores user OpenCode config when agent status hooks are disabled in a nested Girra shell', async () => {
      const env = await spawnAndGetEnv(
        {
          OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
          ORCA_OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
          ORCA_OPENCODE_SOURCE_CONFIG_DIR: '/tmp/user-opencode-config'
        },
        undefined,
        () => ({ agentStatusHooksEnabled: false })
      )

      expect(openCodeBuildPtyEnvMock).not.toHaveBeenCalled()
      expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/user-opencode-config')
      expect(env.ORCA_OPENCODE_CONFIG_DIR).toBeUndefined()
      expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
    })
    it('strips inherited OpenCode overlay env when agent status hooks are disabled without a source dir', async () => {
      const env = await spawnAndGetEnv(
        {
          OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
          ORCA_OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay'
        },
        undefined,
        () => ({ agentStatusHooksEnabled: false })
      )

      expect(openCodeBuildPtyEnvMock).not.toHaveBeenCalled()
      expect(env.OPENCODE_CONFIG_DIR).toBeUndefined()
      expect(env.ORCA_OPENCODE_CONFIG_DIR).toBeUndefined()
      expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
    })
    posixOnlyIt(
      'reproduces issue #1534: GUI-launched Girra mirrors zshrc-only OpenCode config',
      async () => {
        // Why: the reporter's app didn't inherit OPENCODE_CONFIG_DIR; their interactive zsh later exported a company config repo.
        readFileSyncMock.mockImplementation((path: string) => {
          if (path.endsWith('.zshrc')) {
            return [
              '# Company-wide OpenCode config loaded by interactive shells',
              'export OPENCODE_CONFIG_DIR="$HOME/company/opencode-config"',
              ''
            ].join('\n')
          }
          return ''
        })

        const env = await spawnAndGetEnv(undefined, {
          HOME: '/home/pim',
          SHELL: '/bin/zsh',
          OPENCODE_CONFIG_DIR: undefined,
          ORCA_OPENCODE_SOURCE_CONFIG_DIR: undefined
        })

        expect(openCodeBuildPtyEnvMock).toHaveBeenCalledWith(
          expect.any(String),
          '/home/pim/company/opencode-config'
        )
        expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
        expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe('/tmp/orca-opencode-overlay')
        expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBe('/home/pim/company/opencode-config')
        expect(env.OPENCODE_CONFIG_DIR).not.toBe(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR)
      }
    )
    it('installs Pi managed extensions without redirecting Girra terminal PTY homes', async () => {
      const env = await spawnAndGetEnv(undefined, { PI_CODING_AGENT_DIR: '/tmp/user-pi-agent' })
      expect(piBuildPtyEnvMock).toHaveBeenCalledTimes(1)
      expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), '/tmp/user-pi-agent', {
        materializeDefaultHome: false
      })
      expect(env.PI_CODING_AGENT_DIR).toBe('/tmp/user-pi-agent')
      expect(env.ORCA_PI_CODING_AGENT_DIR).toBeUndefined()
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBe('/tmp/user-pi-agent')
    })
    it('does not materialize a missing Pi home when another agent mentions Pi', async () => {
      const env = await spawnAndGetEnv(
        undefined,
        undefined,
        undefined,
        'claude "ask about pi"',
        'claude'
      )

      expect(piBuildPtyEnvMock).toHaveBeenCalledTimes(1)
      expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), undefined, {
        materializeDefaultHome: false
      })
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBeUndefined()
    })
    it('materializes Pi home for an explicit Pi launch through a custom command', async () => {
      const env = await spawnAndGetEnv(undefined, undefined, undefined, 'custom-pi-wrapper', 'pi')

      expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), undefined, {
        materializeDefaultHome: true
      })
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBe('/tmp/default-pi-agent')
    })
    it('threads command: "pi" through to piBuildPtyEnv as an explicit launch', async () => {
      const env = await spawnAndGetEnv(
        undefined,
        { PI_CODING_AGENT_DIR: '/tmp/user-pi-agent' },
        undefined,
        'pi'
      )
      expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), '/tmp/user-pi-agent', {
        materializeDefaultHome: true
      })
      expect(env.PI_CODING_AGENT_DIR).toBe('/tmp/user-pi-agent')
      expect(env.ORCA_PI_CODING_AGENT_DIR).toBeUndefined()
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBe('/tmp/user-pi-agent')
    })
    it('uses sequenced startup env as the Pi launch hint when command is a wrapper', async () => {
      const env = await spawnAndGetEnv(
        {
          PI_CODING_AGENT_DIR: '/tmp/user-pi-agent',
          [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: 'pi --resume'
        },
        undefined,
        undefined,
        'powershell wait-wrapper'
      )

      expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), '/tmp/user-pi-agent', {
        materializeDefaultHome: true
      })
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBe('/tmp/user-pi-agent')
    })
    it('mirrors the original Pi source dir when launched from a Girra overlay shell', async () => {
      const env = await spawnAndGetEnv({
        PI_CODING_AGENT_DIR: '/tmp/parent-orca-pi-overlay',
        ORCA_PI_SOURCE_AGENT_DIR: '/tmp/user-pi-agent'
      })
      expect(piBuildPtyEnvMock).toHaveBeenCalledWith(expect.any(String), '/tmp/user-pi-agent', {
        materializeDefaultHome: false
      })
      expect(env.PI_CODING_AGENT_DIR).toBe('/tmp/parent-orca-pi-overlay')
      expect(env.ORCA_PI_CODING_AGENT_DIR).toBeUndefined()
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBe('/tmp/user-pi-agent')
    })
  })
})
