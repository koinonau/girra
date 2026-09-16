export type OrchestrationCliCommand = 'girra' | 'girra-dev'

/** One name on every execution host since the rename; only the dev command still varies. */
export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  runtimeCliCommand?: OrchestrationCliCommand
}): OrchestrationCliCommand {
  // Why: an SSH pane runs the remote's own CLI, which has no dev build to reach.
  return args.connectionId ? 'girra' : (args.runtimeCliCommand ?? 'girra')
}
