import { POSIX_HOOK_STDIN_DRAIN_COMMAND } from './hook-stdin-contract'

function quotePosixShellString(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

// Why: guard for a readable executable so a stale entry at a missing script becomes a silent no-op, not an exit-127 failure on every tool call.
export function wrapPosixHookCommand(scriptPath: string): string {
  // Why: single-quote escape so $, `, ", \ in scriptPath stay literal — avoids shell injection from an arbitrary path.
  const quoted = quotePosixShellString(scriptPath)
  const guards = [`[ -f ${quoted} ]`, `[ -r ${quoted} ]`, `[ -x ${quoted} ]`].join(' && ')
  return `if ${guards}; then /bin/sh ${quoted}; else ${POSIX_HOOK_STDIN_DRAIN_COMMAND}; fi`
}
