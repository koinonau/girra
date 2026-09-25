import type { TuiAgent } from './tui-agent'
import { getOrcaCliCommandNameForPlatform } from './orca-cli-command-name'

export type AgentPromptInjectionMode = 'argv' | 'flag-prompt' | 'stdin-after-start'

export type DraftPasteReadySignal =
  | 'render-quiet-after-bracketed-paste'
  | 'render-cursor-after-bracketed-paste'

export type TuiAgentDetectionRuntime = NodeJS.Platform | 'wsl'

export type TuiAgentConfig = {
  detectCmd: string
  /** Additional executable names that identify the same agent on PATH. */
  detectCmdAliases?: readonly string[]
  /** Other commands that must also be present before this agent counts as installed. */
  detectRequiredCommands?: readonly string[]
  /** Detection runtimes where this launch mode is not available as a detected agent. */
  detectUnsupportedRuntimes?: readonly TuiAgentDetectionRuntime[]
  launchCmd: string
  /** Platform-specific launch command when the public binary name differs. */
  launchCmdByPlatform?: Partial<Record<NodeJS.Platform, string>>
  expectedProcess: string
  promptInjectionMode: AgentPromptInjectionMode
  /** Native CLI flag that seeds the input without submitting (e.g. Claude's `--prefill <text>`); preferred over the paste-after-ready path. */
  draftPromptFlag?: string
  /** Startup env var that seeds the input without submitting, for agents with no `--prefill`-style flag (e.g. pi); avoids the paste-after-ready race. */
  draftPromptEnvVar?: string
  /** Agent-specific signal that the composer is ready for paste, stronger than the default quiet-render window. */
  draftPasteReadySignal?: DraftPasteReadySignal
  /** Windows Shift+Enter encoding override; omitted agents keep the legacy Esc+CR path. */
  windowsShiftEnterEncoding?: 'csi-u'
}

/** Authoring form: `launchCmd` and `expectedProcess` default to `detectCmd` (true for most agents). */
type TuiAgentConfigSource = Omit<TuiAgentConfig, 'launchCmd' | 'expectedProcess'> & {
  launchCmd?: string
  expectedProcess?: string
}

function resolveTuiAgentConfig(source: TuiAgentConfigSource): TuiAgentConfig {
  return {
    ...source,
    launchCmd: source.launchCmd ?? source.detectCmd,
    expectedProcess: source.expectedProcess ?? source.detectCmd
  }
}

const TUI_AGENT_CONFIG_SOURCE: Record<TuiAgent, TuiAgentConfigSource> = {
  claude: {
    detectCmd: 'claude',
    promptInjectionMode: 'argv',
    // Why: `claude --prefill <text>` seeds the input without submitting, avoiding the paste-after-ready race (PR https://github.com/stablyai/orca/pull/926).
    draftPromptFlag: '--prefill'
  },
  'claude-agent-teams': {
    // Why: a Girra-provided launch mode, not a separate binary; detection follows the Girra CLI.
    detectCmd: 'girra',
    detectCmdAliases: ['girra-dev', 'orca', 'orca-dev', 'orca-ide'],
    // Why: require Claude too so fresh installs (Girra shim always present) don't report Agent Teams without an agent CLI.
    detectRequiredCommands: ['claude'],
    // Why: Windows/WSL use Claude's in-process Agent Teams fallback, not this Girra native-pane/tmux-shim wrapper.
    detectUnsupportedRuntimes: ['win32', 'wsl'],
    launchCmd: 'girra claude-teams',
    launchCmdByPlatform: {
      linux: `${getOrcaCliCommandNameForPlatform('linux')} claude-teams`,
      win32: `${getOrcaCliCommandNameForPlatform('win32')} claude-teams`
    },
    expectedProcess: 'claude',
    promptInjectionMode: 'stdin-after-start'
  },
  opencode: {
    detectCmd: 'opencode',
    promptInjectionMode: 'flag-prompt',
    // Why: opencode enables bracketed paste before its composer mounts; wait for the post-\x1b[?2004h show-cursor so paste lands.
    draftPasteReadySignal: 'render-cursor-after-bracketed-paste'
  },
  pi: {
    detectCmd: 'pi',
    promptInjectionMode: 'argv',
    // Why: pi has no `--prefill` and paste-after-ready races its long startup; the orca-prefill extension seeds this env var instead.
    draftPromptEnvVar: 'GIRRA_PI_PREFILL',
    // Why: Pi decodes CSI-u; Esc+CR submits after tool subprocesses reset live KKP state (#9703).
    windowsShiftEnterEncoding: 'csi-u'
  }
}

export const TUI_AGENT_CONFIG: Record<TuiAgent, TuiAgentConfig> = Object.fromEntries(
  Object.entries(TUI_AGENT_CONFIG_SOURCE).map(([agent, source]) => [
    agent,
    resolveTuiAgentConfig(source)
  ])
) as Record<TuiAgent, TuiAgentConfig>

export function isTuiAgent(value: unknown): value is TuiAgent {
  return typeof value === 'string' && Object.hasOwn(TUI_AGENT_CONFIG, value)
}

export function getTuiAgentDetectCommands(config: TuiAgentConfig): string[] {
  return [config.detectCmd, ...(config.detectCmdAliases ?? [])]
}

export function getTuiAgentLaunchCommand(
  config: TuiAgentConfig,
  platform: NodeJS.Platform,
  opts?: { isRemote?: boolean }
): string {
  // Why: local-only orca-ide rename (avoids GNOME Orca clash) must not leak to Linux remotes, whose relay shim is always `girra`.
  if (opts?.isRemote && platform === 'linux') {
    return config.launchCmd
  }
  return config.launchCmdByPlatform?.[platform] ?? config.launchCmd
}
