export const AGENT_HOOK_RUNTIME_ENV_KEYS = [
  'GIRRA_AGENT_HOOK_PORT',
  'GIRRA_AGENT_HOOK_TOKEN',
  'GIRRA_AGENT_HOOK_ENV',
  'GIRRA_AGENT_HOOK_VERSION',
  'GIRRA_AGENT_HOOK_TRANSPORT',
  'GIRRA_AGENT_HOOK_ENDPOINT',
  // Why: PR 2778 briefly exported this path; keep deleting stale inherited values so older PTYs can't leak the reverted path.
  'GIRRA_CLAUDE_AGENT_STATUS_SETTINGS'
] as const

// Why: Girra never sets these, so an inherited value means a pty host launched from inside a Claude session — Claude reads it as a nested child and silently stops persisting the transcript.
export const CLAUDE_CHILD_SESSION_STAMP_ENV_KEYS = [
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_BRIDGE_SESSION_ID'
] as const
