// @ts-nocheck -- mechanically split from OrcaRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { OrcaRuntimeWithListManagedWorktrees } from './orca-runtime-list-managed-worktrees'
import type { RuntimeNavigationTarget } from '../../shared/runtime-navigation'
import { navigationTargetsClients, navigationTargetsHost } from '../../shared/runtime-navigation'
import type { Repo } from '../../shared/repo-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { WorktreeStartupLaunch } from '../../shared/worktree/launch-types'
import type {
  WorktreeStartupDraftPaste,
  WorktreeStartupFollowup
} from './runtime-worktree-agent-startup'
import {
  buildWorktreeStartupForAgent,
  buildWorktreeStartupForDraft
} from './runtime-worktree-agent-startup'
import type { AgentLaunchPreferences } from '../../shared/agent-session-host-authority'
import type { Worktree } from '../../shared/worktree/types'
import type { WorktreeLineageResolution } from './runtime-worktree-lineage-resolution'
import type {
  WorkspaceLineage,
  WorktreeLineage,
  WorktreeLineageWarning
} from '../../shared/worktree/lineage-types'
import { recordCreatedWorktreeLineage as recordCreatedWorktreeLineageState } from './runtime-worktree-lineage-recording'
import {
  pasteWorktreeStartupDraftWhenReady,
  sendWorktreeStartupFollowupWhenReady
} from './runtime-worktree-startup-readiness'
import type { CreateWorktreeResult } from '../../shared/worktree/create-types'
import { provisionWorktreeTerminals } from './runtime-worktree-terminal-provisioning'

export class OrcaRuntimeWithActivateManagedWorktree extends OrcaRuntimeWithListManagedWorktrees {
  async activateManagedWorktree(
    worktreeSelector: string,
    opts: {
      notifyClients?: boolean
      clientKind?: 'runtime'
      navigation?: RuntimeNavigationTarget
    } = {}
  ): Promise<{ repoId: string; worktreeId: string; activated: boolean }> {
    this.assertGraphReady()
    const worktree = await this.resolveWorktreeSelector(worktreeSelector)
    const repo = this.store?.getRepo(worktree.repoId)
    if (!repo) {
      throw new Error('repo_not_found')
    }
    const navigation = opts.navigation ?? (opts.notifyClients === false ? 'caller' : 'all')
    const targetsHost = navigationTargetsHost(navigation)
    const targetsClients = navigationTargetsClients(navigation)

    if (!targetsHost && this.store?.getWorktreeMeta(worktree.id)?.isUnread) {
      // Why: web session activation intentionally bypasses renderer selection, so
      // the runtime must acknowledge the unread state itself.
      this.store.setWorktreeMeta(worktree.id, { isUnread: false })
      this.notifyWorktreesChanged(repo.id)
    }

    if (targetsHost || targetsClients) {
      // Why: inactive worktree terminal panes are renderer-owned and may not have
      // live PTYs until the desktop activates the worktree and mounts them.
      if (targetsHost) {
        this.notifyHostActivateWorktree(repo.id, worktree.id)
      }
      if (targetsClients) {
        this.notifyClientsActivateWorktree(repo.id, worktree.id)
      }
    }
    if (!targetsHost) {
      // Why: web selection needs fresh session surfaces without forcing every
      // attached desktop renderer to navigate to the client's workspace.
      this.hydrateHeadlessMobileSessionTabsFromWorkspaceSession(worktree.id, {
        allowAttachedWindow: true
      })
      await this.refreshMobileSessionPtyRecords()
      this.notifyMobileSessionTabsChanged(worktree.id)
    }
    return { repoId: repo.id, worktreeId: worktree.id, activated: true }
  }

  protected async buildStartupForDraft(
    repo: Repo,
    draft: string,
    requestedAgent?: TuiAgent
  ): Promise<{
    agent: TuiAgent
    startup: WorktreeStartupLaunch
    draftPaste?: WorktreeStartupDraftPaste
  } | null> {
    if (!this.store) {
      return null
    }
    return buildWorktreeStartupForDraft({
      repo,
      draft,
      ...(requestedAgent ? { requestedAgent } : {}),
      settings: this.store.getSettings(),
      getLaunchPlatform: () => this.getAgentLaunchPlatformForRepo(repo)
    })
  }

  protected buildStartupForAgent(
    repo: Repo,
    agent: TuiAgent,
    prompt: string | undefined,
    launchPreferences?: AgentLaunchPreferences
  ): { agent: TuiAgent; startup: WorktreeStartupLaunch; followup?: WorktreeStartupFollowup } {
    if (!this.store) {
      throw new Error('runtime_unavailable')
    }
    return buildWorktreeStartupForAgent({
      repo,
      agent,
      ...(prompt !== undefined ? { prompt } : {}),
      ...(launchPreferences ? { launchPreferences } : {}),
      settings: this.store.getSettings(),
      getLaunchPlatform: () => this.getAgentLaunchPlatformForRepo(repo),
      toSessionOptions: (preferences) => this.toAgentSessionOptions(preferences)
    })
  }

  protected recordCreatedWorktreeLineage(
    worktree: Pick<Worktree, 'id' | 'instanceId'>,
    lineageResolution: WorktreeLineageResolution
  ): {
    lineage: WorktreeLineage | null
    workspaceLineage: WorkspaceLineage | null
    warnings: WorktreeLineageWarning[]
  } {
    return recordCreatedWorktreeLineageState(this.store, worktree, lineageResolution)
  }

  protected pasteStartupDraftWhenReady(handle: string, draft: WorktreeStartupDraftPaste): void {
    pasteWorktreeStartupDraftWhenReady(this.getWorktreeStartupReadinessHost(), handle, draft)
  }

  protected sendStartupFollowupWhenReady(handle: string, followup: WorktreeStartupFollowup): void {
    sendWorktreeStartupFollowupWhenReady(this.getWorktreeStartupReadinessHost(), handle, followup)
  }

  protected async provisionManagedWorktreeTerminals(args: {
    worktreeSelector: string
    worktreeId: string
    worktreePath: string
    setup?: CreateWorktreeResult['setup']
    defaultTabs?: CreateWorktreeResult['defaultTabs']
    primaryTerminalHandle?: string | null
    hasStartupTerminal: boolean
    setupCommandPlatform: 'windows' | 'posix'
    observeSetupCompletion?: boolean
    // Why: when the agent startup is sequenced to wait for setup
    // (waitForAgentStartup), the startup PTY runs a wrapper that already embeds
    // the setup command. Pass that wrapped command through so the Setup tab runs
    // the same script the agent is waiting on instead of a bare runner.
    wrappedSetupCommand?: string
    // Why: a workspace provisioned in the background must not pull the sidebar
    // to itself; the user never asked to look at these tabs.
    surfaceOwner?: false
  }): Promise<{ setupSpawned: boolean; setupTerminalHandle: string | null }> {
    return provisionWorktreeTerminals(this.getWorktreeTerminalProvisioningHost(), args)
  }
}
