import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import type {
  ComputerUsePermissionSetupResult,
  ComputerUsePermissionStatusResult
} from '../../../../shared/computer-use-permissions-types'
import {
  COMPUTER_USE_SKILL_NAME,
  GIRRA_LINEAR_SKILL_NAME,
  GIRRA_CLI_SKILL_NAME,
  ORCHESTRATION_SKILL_NAME,
  buildAgentFeatureSkillInstallCommand
} from '@/lib/agent-feature-install-commands'
import { BROWSER_USE_ENABLED_STORAGE_KEY } from '@/lib/browser-use-setup-state'
import { showOrcaCliRegistrationPromptToast } from '@/lib/agent-skill-cli-prerequisite'
import type { ProjectAgentSkillRuntime } from '@/lib/project-skill-runtime'
import type { AgentFeatureSetupRuntimeContext } from './agent-feature-setup-runtime'
import {
  buildSkillCommandForRuntime,
  getWslCliDistroRequest
} from '../settings/CliSkillRuntimeSetup'
import {
  ORCHESTRATION_ENABLED_STORAGE_KEY,
  ORCHESTRATION_SETUP_DISMISSED_STORAGE_KEY,
  notifyOrchestrationSetupStateChanged
} from '@/lib/orchestration-setup-state'

export type AgentFeatureSetupId = 'browserUse' | 'computerUse' | 'orchestration' | 'linearTickets'

export type AgentFeatureSetupSelection = Record<AgentFeatureSetupId, boolean>

export const DEFAULT_AGENT_FEATURE_SETUP_SELECTION: AgentFeatureSetupSelection = {
  browserUse: true,
  computerUse: true,
  orchestration: true,
  linearTickets: false
}

export const AGENT_FEATURE_SETUP_IDS: readonly AgentFeatureSetupId[] = [
  'browserUse',
  'computerUse',
  'orchestration',
  'linearTickets'
]

const FEATURE_SKILL_NAMES: Record<AgentFeatureSetupId, string> = {
  browserUse: GIRRA_CLI_SKILL_NAME,
  computerUse: COMPUTER_USE_SKILL_NAME,
  orchestration: ORCHESTRATION_SKILL_NAME,
  linearTickets: GIRRA_LINEAR_SKILL_NAME
}

export type AgentFeatureSetupWarning = {
  featureId: AgentFeatureSetupId | 'cli' | 'skills'
  message: string
}

export type AgentFeatureSetupResult = {
  selectedIds: AgentFeatureSetupId[]
  cliTouched: boolean
  skillCommandsCopied: boolean
  skillInstallCommand: string | null
  computerUsePermissionsOpened: boolean
  warnings: AgentFeatureSetupWarning[]
}

export type AgentFeatureSetupDeps = {
  getCliStatus: () => Promise<CliInstallStatus>
  showCliRegistrationPrompt?: () => Promise<void>
  installCli: () => Promise<CliInstallStatus>
  writeClipboardText: (text: string) => Promise<void>
  getComputerUsePermissionStatus: () => Promise<ComputerUsePermissionStatusResult>
  openComputerUsePermissionSetup: () => Promise<ComputerUsePermissionSetupResult>
  setStorageItem: (key: string, value: string) => void
  removeStorageItem: (key: string) => void
  notifyOrchestrationStateChanged: () => void
}

export function hasSelectedAgentFeatureSetup(selection: AgentFeatureSetupSelection): boolean {
  return AGENT_FEATURE_SETUP_IDS.some((id) => selection[id])
}

export function selectedAgentFeatureSetupIds(
  selection: AgentFeatureSetupSelection
): AgentFeatureSetupId[] {
  return AGENT_FEATURE_SETUP_IDS.filter((id) => selection[id])
}

export function buildAgentFeatureSetupClipboardText(
  selection: AgentFeatureSetupSelection,
  agentRuntime?: ProjectAgentSkillRuntime
): string | null {
  const command = buildAgentFeatureSetupSkillCommand(selection)
  // Keep clipboard and terminal commands on the same runtime (#12103).
  return command === null ? null : buildSkillCommandForRuntime(command, agentRuntime)
}

export function buildAgentFeatureSetupSkillCommand(
  selection: AgentFeatureSetupSelection
): string | null {
  const skillNames = selectedAgentFeatureSetupIds(selection).map((id) => FEATURE_SKILL_NAMES[id])
  if (skillNames.length === 0) {
    return null
  }
  return buildAgentFeatureSkillInstallCommand(skillNames)
}

export function createAgentFeatureSetupDeps(
  agentRuntime?: ProjectAgentSkillRuntime
): AgentFeatureSetupDeps {
  // Register `orca` on the same PATH used by the skill install (#12103).
  const wslDistroRequest =
    agentRuntime?.runtime === 'wsl' ? getWslCliDistroRequest(agentRuntime) : undefined
  const isWsl = agentRuntime?.runtime === 'wsl'
  return {
    getCliStatus: () =>
      isWsl
        ? window.api.cli.getWslInstallStatus(wslDistroRequest)
        : window.api.cli.getInstallStatus(),
    showCliRegistrationPrompt: showOrcaCliRegistrationPromptToast,
    installCli: () =>
      isWsl ? window.api.cli.installWsl(wslDistroRequest) : window.api.cli.install(),
    writeClipboardText: (text) => window.api.ui.writeClipboardText(text),
    getComputerUsePermissionStatus: () => window.api.computerUsePermissions.getStatus(),
    openComputerUsePermissionSetup: () => window.api.computerUsePermissions.openSetup(),
    setStorageItem: (key, value) => localStorage.setItem(key, value),
    removeStorageItem: (key) => localStorage.removeItem(key),
    notifyOrchestrationStateChanged: notifyOrchestrationSetupStateChanged
  }
}

export async function runAgentFeatureSetup(
  selection: AgentFeatureSetupSelection,
  explicitDeps?: AgentFeatureSetupDeps,
  runtimeContext?: AgentFeatureSetupRuntimeContext
): Promise<AgentFeatureSetupResult> {
  const agentRuntime = runtimeContext?.installDisabledReason
    ? undefined
    : runtimeContext?.agentRuntime
  const deps = explicitDeps ?? createAgentFeatureSetupDeps(agentRuntime)
  const selectedIds = selectedAgentFeatureSetupIds(selection)
  const warnings: AgentFeatureSetupWarning[] = []
  let cliTouched = false
  let skillCommandsCopied = false
  const skillInstallCommand = buildAgentFeatureSetupSkillCommand(selection)
  let computerUsePermissionsOpened = false

  deps.setStorageItem(BROWSER_USE_ENABLED_STORAGE_KEY, selection.browserUse ? '1' : '0')
  deps.setStorageItem(ORCHESTRATION_ENABLED_STORAGE_KEY, selection.orchestration ? '1' : '0')
  if (selection.orchestration) {
    deps.removeStorageItem(ORCHESTRATION_SETUP_DISMISSED_STORAGE_KEY)
  }
  deps.notifyOrchestrationStateChanged()

  if (selectedIds.length === 0) {
    return {
      selectedIds,
      cliTouched,
      skillCommandsCopied,
      skillInstallCommand,
      computerUsePermissionsOpened,
      warnings
    }
  }

  try {
    const status = await deps.getCliStatus()
    if (!status.supported) {
      warnings.push({
        featureId: 'cli',
        message: status.detail ?? 'Girra CLI registration is not available on this platform.'
      })
    } else if (status.pathConfigured === null) {
      // Why: an unknown registry read cannot safely drive a PATH read-modify-write.
      warnings.push({
        featureId: 'cli',
        message: status.detail ?? 'Girra could not check your Windows user PATH.'
      })
    } else if (status.state !== 'installed' || status.pathConfigured === false) {
      await deps.showCliRegistrationPrompt?.()
      const next = await deps.installCli()
      cliTouched = true
      if (next.state !== 'installed') {
        warnings.push({
          featureId: 'cli',
          message: next.detail ?? 'Girra CLI registration needs attention.'
        })
      } else if (next.pathConfigured !== true && next.detail) {
        warnings.push({ featureId: 'cli', message: next.detail })
      }
    }
  } catch (error) {
    warnings.push({ featureId: 'cli', message: formatFeatureSetupError(error) })
  }

  if (selection.computerUse) {
    try {
      const status = await deps.getComputerUsePermissionStatus()
      // Why: when the macOS helper app is missing (e.g. dev builds without
      // `pnpm build:computer-macos`), the status reports all permissions as
      // not-granted alongside a helperUnavailableReason. Without this guard we
      // would call openSetup, which throws an IPC handler error instead of
      // degrading gracefully.
      if (status.helperUnavailableReason) {
        warnings.push({
          featureId: 'computerUse',
          message: status.helperUnavailableReason
        })
      } else {
        const needsMacPermissions =
          status.platform === 'darwin' &&
          status.permissions.some((permission) => permission.status !== 'granted')
        if (needsMacPermissions) {
          await deps.openComputerUsePermissionSetup()
          computerUsePermissionsOpened = true
        }
      }
    } catch (error) {
      warnings.push({
        featureId: 'computerUse',
        message: formatFeatureSetupError(error)
      })
    }
  }

  skillCommandsCopied = await copySkillCommands(selection, deps, warnings, agentRuntime)

  return {
    selectedIds,
    cliTouched,
    skillCommandsCopied,
    skillInstallCommand,
    computerUsePermissionsOpened,
    warnings
  }
}

function formatFeatureSetupError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function copySkillCommands(
  selection: AgentFeatureSetupSelection,
  deps: AgentFeatureSetupDeps,
  warnings: AgentFeatureSetupWarning[],
  agentRuntime?: ProjectAgentSkillRuntime
): Promise<boolean> {
  const clipboardText = buildAgentFeatureSetupClipboardText(selection, agentRuntime)
  if (!clipboardText) {
    return false
  }
  try {
    await deps.writeClipboardText(clipboardText)
    return true
  } catch (error) {
    warnings.push({ featureId: 'skills', message: formatFeatureSetupError(error) })
    return false
  }
}
