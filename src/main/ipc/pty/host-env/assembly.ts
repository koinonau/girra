import { resolveSetupAgentSequenceLaunchCommand } from '../../../../shared/setup-agent-sequencing'
import { isPiLaunchCommand } from '../../../../shared/pi-agent-kind'
import { applyTerminalGitCredentialPromptGuard } from '../../terminal-git-credential-guard'
import { openCodeHookService } from '../../../opencode/hook-service'
import { agentHookServer } from '../../../agent-hooks/server'
import { wslHookRelayManager } from '../../../agent-hooks/wsl-hook-relay-manager'
import { piTitlebarExtensionService } from '../../../pi/titlebar-extension-service'
import { prependOrcaCliDirToChildPath } from '../../../cli/orca-cli-child-path'
import { stripLegacyTerminalShimEnv } from '../../../pty/legacy-terminal-shim-dir'
import { mergePersistedWindowsPath } from '../../../pty/windows-environment-path'
import { buildConfiguredProxyEnv } from '../../../../shared/network-proxy'
import type { BuildPtyHostEnvOptions } from './types'
import {
  exposePiManagedExtensionEnv,
  resolveOpenCodeSourceConfigDir,
  resolvePiAgentSourceDir,
  restoreOrStripOverlayEnv
} from './pi-agent'
import { AGENT_HOOK_RUNTIME_ENV_KEYS } from './spawn-env-keys'
import { legacyOrcaEnvName } from '../../../../shared/legacy-orca-env-aliases'

/**
 * Mutates `baseEnv` in place with all host-local PTY env vars and returns it.
 *
 * Do NOT call when `args.connectionId` is set (SSH): every injection is host-loopback
 * or references local filesystem paths meaningless to a remote shell.
 */
export function buildPtyHostEnv(
  id: string,
  baseEnv: Record<string, string>,
  opts: BuildPtyHostEnvOptions
): Record<string, string> {
  mergePersistedWindowsPath(baseEnv)
  Object.assign(baseEnv, buildConfiguredProxyEnv(opts.networkProxySettings))

  // Why: local path's baseEnv includes process.env but the daemon path doesn't (fork inheritance, not IPC); check both sources so guards stay in lock-step across spawn paths.
  const preexistingOpenCodeConfigDir = resolveOpenCodeSourceConfigDir(baseEnv)
  const launchCommandHint = resolveSetupAgentSequenceLaunchCommand(baseEnv, opts.launchCommand)
  const isExplicitPiLaunch =
    opts.launchAgent === undefined
      ? isPiLaunchCommand(launchCommandHint)
      : opts.launchAgent === 'pi'

  // Why: unattended agents must fail instead of looping on OS credential prompts; user terminals keep normal Git behavior.
  applyTerminalGitCredentialPromptGuard(baseEnv, {
    launchCommand: launchCommandHint,
    isUnattended: opts.launchAgent !== undefined,
    deferGitConfigGuardToHost: opts.deferGitConfigGuardToDaemon
  })

  const preexistingPiAgentDir = resolvePiAgentSourceDir(baseEnv)

  if (opts.agentStatusHooksEnabled) {
    // Why: OPENCODE_CONFIG_DIR is a single path, not a colon-list; mirror the user's value into an overlay so their plugins and Girra's status plugin coexist. See docs/opencode-config-dir-collision.md.
    Object.assign(baseEnv, openCodeHookService.buildPtyEnv(id, preexistingOpenCodeConfigDir))
    if (baseEnv.OPENCODE_CONFIG_DIR) {
      // Why: ~/.zshrc can re-export the user's default after spawn; shell-ready wrappers restore this PTY-scoped value.
      baseEnv.GIRRA_OPENCODE_CONFIG_DIR = baseEnv.OPENCODE_CONFIG_DIR
      if (preexistingOpenCodeConfigDir) {
        // Why: nested Girra terminals inherit the overlay as OPENCODE_CONFIG_DIR; keep the real source so overlays don't mirror overlays.
        baseEnv.GIRRA_OPENCODE_SOURCE_CONFIG_DIR = preexistingOpenCodeConfigDir
      } else {
        delete baseEnv.GIRRA_OPENCODE_SOURCE_CONFIG_DIR
      }
    }
  } else {
    restoreOrStripOverlayEnv(baseEnv, {
      primary: 'OPENCODE_CONFIG_DIR',
      overlay: 'GIRRA_OPENCODE_CONFIG_DIR',
      source: 'GIRRA_OPENCODE_SOURCE_CONFIG_DIR'
    })
  }

  // Why: strip inherited hook coordinates before injecting this PTY's fresh loopback receiver, so nested-terminal callbacks route to the owning pane.
  for (const key of AGENT_HOOK_RUNTIME_ENV_KEYS) {
    delete baseEnv[key]
    const legacy = legacyOrcaEnvName(key)
    if (legacy !== null) {
      delete baseEnv[legacy]
    }
  }
  if (opts.agentStatusHooksEnabled) {
    Object.assign(baseEnv, agentHookServer.buildPtyEnv())
    if (opts.isWsl === true) {
      // Why: hook POSTs to 127.0.0.1 die inside WSL's NAT namespace; use the guest-resident relay's endpoint instead of the Windows one.
      const distro = opts.wslDistro ?? null
      wslHookRelayManager.ensureForDistro(distro)
      const guestEndpoint = wslHookRelayManager.getGuestEndpointFilePath(distro)
      if (guestEndpoint) {
        baseEnv.GIRRA_AGENT_HOOK_ENDPOINT = guestEndpoint
      }
      // Why: OpenCode loads its status plugin from a guest config overlay, so point OPENCODE_CONFIG_DIR at the guest dir the relay materialized.
      const opencodeOverlayDir = wslHookRelayManager.getOpenCodeOverlayDir(distro)
      if (opencodeOverlayDir) {
        baseEnv.OPENCODE_CONFIG_DIR = opencodeOverlayDir
        baseEnv.GIRRA_OPENCODE_CONFIG_DIR = opencodeOverlayDir
        delete baseEnv.GIRRA_OPENCODE_SOURCE_CONFIG_DIR
      } else {
        // Why: relay not connected yet (or older guest bundle) — never cross the Windows overlay path into WSL; drop it so in-guest OpenCode uses its own config (pre-fix behavior, no status but no regression).
        delete baseEnv.OPENCODE_CONFIG_DIR
        delete baseEnv.GIRRA_OPENCODE_CONFIG_DIR
        delete baseEnv.GIRRA_OPENCODE_SOURCE_CONFIG_DIR
      }
    }
  }

  // Why: PI_CODING_AGENT_DIR is the user's config/session root; install only Girra-owned extension files, don't override it.
  if (opts.agentStatusHooksEnabled) {
    // Why: bare shells used to create ~/.pi/agent even when the user never
    // launched Pi (#10196). Only an explicit Pi launch creates the default
    // home; otherwise install only into an existing agent dir.
    const piEnv = piTitlebarExtensionService.buildPtyEnv(id, preexistingPiAgentDir, {
      materializeDefaultHome: isExplicitPiLaunch
    })
    Object.assign(baseEnv, piEnv)
    exposePiManagedExtensionEnv(baseEnv, piEnv)
  } else {
    // Why: nested PTYs must not inherit stale source or overlay state from another agent.
    restoreOrStripOverlayEnv(baseEnv, {
      primary: 'PI_CODING_AGENT_DIR',
      overlay: 'GIRRA_PI_CODING_AGENT_DIR',
      source: 'GIRRA_PI_SOURCE_AGENT_DIR'
    })
  }

  // Why: WSL shells need the managed userData root for shell-ready wrappers; dev-mode terminals need the same export so `girra` targets the live dev instance.
  if (opts.isWsl) {
    baseEnv.GIRRA_USER_DATA_PATH = opts.userDataPath
    // Why: exposing the managed WSL registration's own name scopes agent guidance to WSL without a bare-name shim.
    baseEnv.GIRRA_CLI_COMMAND = opts.isPackaged ? 'girra' : 'girra-dev'
  } else {
    if (!opts.isPackaged) {
      baseEnv.GIRRA_USER_DATA_PATH ??= opts.userDataPath
    }
    delete baseEnv.GIRRA_CLI_COMMAND
  }
  prependOrcaCliDirToChildPath(baseEnv, {
    isPackaged: opts.isPackaged,
    userDataPath: opts.userDataPath,
    resourcesPath: opts.resourcesPath
  })

  if (
    opts.routeBrowserOpensToClient === true &&
    baseEnv.BROWSER === undefined &&
    process.env.BROWSER === undefined
  ) {
    const cliCommand = opts.isWsl ? (opts.isPackaged ? 'orca-ide' : 'orca-dev') : 'orca'
    baseEnv.BROWSER = `${cliCommand} open-url --url %s`
  }

  // Why: must run after the prepends above — they re-read PATH from the unscrubbed
  // process.env when baseEnv carries none, which is the daemon path's normal shape.
  stripLegacyTerminalShimEnv(baseEnv, process.platform)

  return baseEnv
}
