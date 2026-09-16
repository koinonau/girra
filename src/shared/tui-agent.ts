/** All AI coding agents Girra knows how to launch. Used for the agent picker in the new-workspace
 *  flow and for the default-agent setting. Extend this union as new agents are added. */
export type TuiAgent =
  | 'claude' // Claude Code
  | 'claude-agent-teams' // Claude Code Agent Teams via Girra native panes
  | 'opencode' // OpenCode
  | 'pi' // Pi (pi.dev)
