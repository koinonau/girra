import type { AgentHookSource } from '../../shared/agent-hook-relay'
import { GIRRA_HOOK_RAW_JSON_TRANSPORT } from '../../shared/agent-hook-types'

export function buildPosixAgentHookPostCommand(
  source: AgentHookSource,
  options: { curlCommand?: string; indent?: string } = {}
): string[] {
  const curlCommand = options.curlCommand ?? 'curl'
  const indent = options.indent ?? '  '
  return [
    `if [ "\${GIRRA_AGENT_HOOK_TRANSPORT:-}" = "${GIRRA_HOOK_RAW_JSON_TRANSPORT}" ] && command -v base64 >/dev/null 2>&1 && command -v tr >/dev/null 2>&1; then`,
    `  orca_hook_metadata=$(printf '%s\\037%s\\037%s\\037%s\\037%s\\037%s' "$GIRRA_PANE_KEY" "$GIRRA_TAB_ID" "$GIRRA_AGENT_LAUNCH_TOKEN" "$GIRRA_WORKTREE_ID" "$GIRRA_AGENT_HOOK_ENV" "$GIRRA_AGENT_HOOK_VERSION" | base64 | tr -d '\\n') && \\`,
    `  [ -n "$orca_hook_metadata" ] && \\`,
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${GIRRA_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/json" \\`,
    `  ${indent}-H "X-Orca-Agent-Hook-Token: \${GIRRA_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}-H "X-Orca-Agent-Hook-Meta-Encoding: base64" \\`,
    `  ${indent}-H "X-Orca-Agent-Hook-Meta: \${orca_hook_metadata}" \\`,
    `  ${indent}--data-binary @-`,
    'else',
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${GIRRA_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  ${indent}-H "X-Orca-Agent-Hook-Token: \${GIRRA_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}--data-urlencode "paneKey=\${GIRRA_PANE_KEY}" \\`,
    `  ${indent}--data-urlencode "tabId=\${GIRRA_TAB_ID}" \\`,
    `  ${indent}--data-urlencode "launchToken=\${GIRRA_AGENT_LAUNCH_TOKEN}" \\`,
    `  ${indent}--data-urlencode "worktreeId=\${GIRRA_WORKTREE_ID}" \\`,
    `  ${indent}--data-urlencode "env=\${GIRRA_AGENT_HOOK_ENV}" \\`,
    `  ${indent}--data-urlencode "version=\${GIRRA_AGENT_HOOK_VERSION}" \\`,
    `  ${indent}--data-urlencode "payload@-"`,
    'fi'
  ]
}
