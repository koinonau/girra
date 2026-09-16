import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Girra-managed agent status hooks are enabled',
    usage: 'girra agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['girra agent hooks status', 'girra agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Girra-managed agent status hooks and remove local hook entries',
    usage: 'girra agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['girra agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Girra-managed agent status hooks',
    usage: 'girra agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['girra agent hooks on']
  }
]
