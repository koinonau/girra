import { describe, expect, it } from 'vitest'
import { pickRemoteCliEnv } from './remote-cli-env'

describe('pickRemoteCliEnv', () => {
  it('forwards SSH Girra terminal and worktree context for remote CLI calls', () => {
    expect(
      pickRemoteCliEnv({
        GIRRA_TERMINAL_HANDLE: 'term_ssh',
        GIRRA_WORKTREE_ID: 'repo::remote',
        GIRRA_PANE_KEY: 'pane-1',
        GIRRA_AGENT_LAUNCH_TOKEN: 'launch-secret',
        GIRRA_WORKSPACE_ID: 'workspace-1',
        GIRRA_USER_DATA_PATH: '/tmp/girra',
        PATH: '/usr/bin',
        SECRET_TOKEN: 'nope'
      })
    ).toEqual({
      GIRRA_TERMINAL_HANDLE: 'term_ssh',
      GIRRA_WORKTREE_ID: 'repo::remote',
      GIRRA_PANE_KEY: 'pane-1',
      GIRRA_AGENT_LAUNCH_TOKEN: 'launch-secret',
      GIRRA_WORKSPACE_ID: 'workspace-1',
      GIRRA_USER_DATA_PATH: '/tmp/girra',
      // Why the pairs: the shim on the host may predate the GIRRA_* rename.
      ORCA_TERMINAL_HANDLE: 'term_ssh',
      ORCA_WORKTREE_ID: 'repo::remote',
      ORCA_PANE_KEY: 'pane-1',
      ORCA_AGENT_LAUNCH_TOKEN: 'launch-secret',
      ORCA_WORKSPACE_ID: 'workspace-1',
      ORCA_USER_DATA_PATH: '/tmp/girra',
      PATH: '/usr/bin'
    })
  })

  // Why: an older client sends this context over the wire under the old names.
  it('takes the legacy value when the caller only has the old name', () => {
    expect(pickRemoteCliEnv({ ORCA_PANE_KEY: 'pane-1' })).toEqual({
      GIRRA_PANE_KEY: 'pane-1',
      ORCA_PANE_KEY: 'pane-1'
    })
  })
})
