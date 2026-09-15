import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { getConnectionIdFromState } from '@/lib/connection-owner-resolution'
import { runQuickCommandInNewTab } from '@/lib/run-quick-command-in-new-tab'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { getCurrentPlatform } from '@/components/sidebar/linear-agent-skill-runtime'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import { toSshExecutionHostId } from '../../../../shared/execution-host'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { KOTHAR_INSTALL_WIZARD_COMMAND } from '../../../../shared/agent-feature-install-commands'

export type KotharSshInstallTarget = {
  targetId: string
  label: string
  workspaceId: string | null
  disabledReason: string | null
}

type WorkspaceOwnerState = Pick<
  AppState,
  'folderWorkspaces' | 'projectGroups' | 'repos' | 'worktreesByRepo'
>

function windowsUnsupportedReason(): string {
  return translate(
    'auto.components.skills.SkillsPage.installKotharWindowsUnsupported',
    'The kothar installer needs macOS or Linux.'
  )
}

// Why: an SSH terminal needs a workspace on that host; the Skills page itself has none.
function findSshHostWorkspaceId(state: WorkspaceOwnerState, targetId: string): string | null {
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    const worktree = worktrees.find(
      (entry) => !entry.isArchived && getConnectionIdFromState(state, entry.id) === targetId
    )
    if (worktree) {
      return worktree.id
    }
  }
  const folder = state.folderWorkspaces.find(
    (entry) =>
      !entry.isArchived &&
      getConnectionIdFromState(state, folderWorkspaceKey(entry.id)) === targetId
  )
  return folder ? folderWorkspaceKey(folder.id) : null
}

/** Why the page-host install is unavailable; the platform stays unknown until the host reports it. */
export function useKotharInstallDisabledReason(target: RuntimeClientTarget | null): {
  disabled: boolean
  reason: string | null
} {
  const environmentPlatform = useAppStore((state) => {
    if (target?.kind !== 'environment') {
      return null
    }
    const status = state.runtimeStatusByEnvironmentId.get(target.environmentId)
    return status?.status?.hostPlatform ?? status?.snapshot?.status?.hostPlatform ?? null
  })
  if (!target) {
    return { disabled: true, reason: null }
  }
  const platform = target.kind === 'local' ? getCurrentPlatform() : environmentPlatform
  return platform === 'win32'
    ? { disabled: true, reason: windowsUnsupportedReason() }
    : { disabled: false, reason: null }
}

export function useKotharSshInstallTargets(): KotharSshInstallTarget[] {
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const settings = useAppStore((s) => s.settings)
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const projectGroups = useAppStore((s) => s.projectGroups)
  return useMemo(() => {
    const labelOverrides = getHostDisplayLabelOverrides(settings)
    const ownerState = { folderWorkspaces, projectGroups, repos, worktreesByRepo }
    return [...sshConnectionStates]
      .filter(([, connection]) => connection.status === 'connected')
      .map(([targetId, connection]) => {
        const workspaceId = findSshHostWorkspaceId(ownerState, targetId)
        const disabledReason =
          connection.remotePlatform === 'win32'
            ? windowsUnsupportedReason()
            : workspaceId
              ? null
              : translate(
                  'auto.components.skills.SkillsPage.installKotharNeedsWorkspace',
                  'Open a repository or folder on this host first.'
                )
        return {
          targetId,
          label:
            labelOverrides.get(toSshExecutionHostId(targetId)) ??
            sshTargetLabels.get(targetId) ??
            targetId,
          workspaceId,
          disabledReason
        }
      })
  }, [
    folderWorkspaces,
    projectGroups,
    repos,
    settings,
    sshConnectionStates,
    sshTargetLabels,
    worktreesByRepo
  ])
}

export function openKotharInstallOnSshHost(target: KotharSshInstallTarget): void {
  if (!target.workspaceId || target.disabledReason) {
    return
  }
  // Why: activate first; the new tab's terminal type is recorded against the active workspace.
  if (activateAndRevealWorkspace(target.workspaceId) === false) {
    return
  }
  runQuickCommandInNewTab({
    command: {
      id: 'kothar-install-wizard',
      label: translate('auto.components.skills.SkillsPage.installKotharTitle', 'Install kothar'),
      command: KOTHAR_INSTALL_WIZARD_COMMAND,
      appendEnter: true
    },
    worktreeId: target.workspaceId
  })
}
