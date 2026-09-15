import { describe, expect, it } from 'vitest'
import { buildFolderWorkspaceLinkedStartupPlan } from './folder-workspace-composer-submit'

describe('buildFolderWorkspaceLinkedStartupPlan', () => {
  it('uses cmd quoting for configured arguments on local Windows', () => {
    const plan = buildFolderWorkspaceLinkedStartupPlan({
      agent: 'opencode',
      linkedWorkItem: {
        provider: 'github',
        type: 'issue',
        number: 42,
        title: 'Restore linked quick-create',
        url: 'https://github.com/stablyai/orca/issues/42',
        repoId: 'repo-1'
      },
      note: '',
      agentCmdOverrides: {},
      agentArgs: '--provider "value with space"',
      platform: 'win32',
      shell: 'cmd',
      isRemote: false
    })

    expect(plan?.launchCommand).toBe('opencode "--provider" "value with space"')
  })
})
