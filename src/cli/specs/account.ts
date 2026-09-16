import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: the desktop "Add account" button is disabled when the UI drives a remote
// runtime (a headless server). These commands run `claude login` in the caller's
// own terminal on the host and register the captured account with the local
// runtime, giving headless hosts a way to manage Claude accounts.
export const ACCOUNT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['account', 'add'],
    summary: 'Add a managed Claude account by signing in on this Girra host',
    usage: 'girra account add [--agent claude] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent'],
    notes: [
      'Runs `claude login` in this terminal, then registers the account with the local Girra runtime.',
      'Sign in with the account you want to add (e.g. use a private/incognito browser window for a second account).',
      '--agent defaults to claude. Requires the Girra runtime to be running on this machine.'
    ],
    examples: ['girra account add']
  },
  {
    path: ['account', 'list'],
    summary: 'List managed Claude accounts on this Girra host',
    usage: 'girra account list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Lists the accounts on this machine. `--environment` / `--pairing-code` are rejected rather than ignored; run it on the host whose accounts you want to see.'
    ],
    examples: ['girra account list']
  }
]
