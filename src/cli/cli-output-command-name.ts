import { resolveOrchestrationCliExecutable } from './runtime/orchestration-recovery-command'

// Why: the runtime writes `girra <verb>` because that is the command on the machine it runs on,
// but the caller may reach it through the SSH relay shim, which is installed as `orca` and only
// gains a `girra` alias when the best-effort refresh in ssh-relay-session succeeds. The CLI
// process formatting this output knows which name its own caller has, so it is the last place
// the name can be made true.
const CANONICAL_COMMAND = /\bgirra (?=(?:[a-z][a-z-]*)\b)/g

export function retargetCliOutputCommandName(
  text: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const executable = resolveOrchestrationCliExecutable(env)
  return executable === 'girra' ? text : text.replaceAll(CANONICAL_COMMAND, `${executable} `)
}
