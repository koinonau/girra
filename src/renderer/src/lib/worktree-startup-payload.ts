import type { TuiAgent } from '../../../shared/tui-agent'
import type { WorktreeStartupLaunch } from '../../../shared/worktree/launch-types'
import type { StartupCommandDelivery } from '../../../shared/startup-command-delivery'
import type {
  AgentProviderSessionMetadata,
  SleepingAgentLaunchConfig
} from '../../../shared/agent-session-resume'
import type { SessionOptionValue } from '../../../shared/native-chat-session-options'

/** Launch metadata threaded to `pty:spawn`; it answers terminal colour queries and guards focus. */
export type AgentLaunchMetadata = NonNullable<WorktreeStartupLaunch['telemetry']>

/** Startup command threaded onto a worktree's first terminal at activation. */
export type WorktreeStartupPayload = {
  command: string
  env?: Record<string, string>
  launchConfig?: SleepingAgentLaunchConfig
  resumeProviderSession?: AgentProviderSessionMetadata
  launchToken?: string
  launchAgent?: TuiAgent
  draftPrompt?: string
  /**
   * The unsent launch context, for the initial view-mode decision ONLY.
   *
   * Deliberately separate from `draftPrompt`, which drives the bracketed paste
   * in pty-connection: an argv-prefill launch already carries the draft inside
   * `command`, so reusing `draftPrompt` here would paste it a second time.
   * Set this on every draft launch; set `draftPrompt` only for paste delivery.
   */
  launchDraftText?: string
  startupCommandDelivery?: StartupCommandDelivery
  sessionOptions?: Record<string, SessionOptionValue>
  telemetry?: AgentLaunchMetadata
}

/**
 * The unsent launch context a startup payload carries, whichever way the agent
 * receives it: argv prefill sets only `launchDraftText`, post-ready paste sets
 * `draftPrompt`. Gating on `draftPrompt` alone silently misses every
 * argv-prefill launch.
 */
export function resolveStartupLaunchDraftText(
  startup: Pick<WorktreeStartupPayload, 'draftPrompt' | 'launchDraftText'> | undefined
): string | undefined {
  return startup?.draftPrompt ?? startup?.launchDraftText
}

/** Shared by both tab-creation sites so the draft gate can't drift between them. */
export function draftViewModeProps(draftText: string | undefined): {
  promptDelivery?: 'draft'
  launchDraftText?: string
} {
  return draftText == null ? {} : { promptDelivery: 'draft', launchDraftText: draftText }
}
