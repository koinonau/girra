import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { createTestStore, makeWorktree } from './store-test-helpers'

const worktreeActivation = vi.hoisted(() => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('../../lib/worktree-activation', () => ({
  activateAndRevealWorktree: worktreeActivation.activateAndRevealWorktree
}))

const reposAdd = vi.fn()
const worktreesList = vi.fn()

beforeEach(() => {
  reposAdd.mockReset()
  worktreesList.mockReset()
  worktreeActivation.activateAndRevealWorktree.mockReset()
  vi.stubGlobal('window', {
    api: {
      repos: { add: reposAdd },
      worktrees: { list: worktreesList }
    }
  })
})

describe('repo slice folder add', () => {
  it('reveals the added folder without seeding a default agent', async () => {
    reposAdd.mockResolvedValueOnce({
      repo: { id: 'folder-1', path: '/first', displayName: 'First', addedAt: 1 }
    })
    worktreesList.mockImplementation(({ repoId }: { repoId: string }) => [
      makeWorktree({ id: `${repoId}::/folder`, repoId })
    ])
    const store = createTestStore()
    store.setState({
      settings: {
        ...getDefaultSettings('/tmp/orca-workspaces'),
        defaultTuiAgent: 'opencode'
      }
    })

    await store.getState().addNonGitFolder('/first')

    expect(worktreeActivation.activateAndRevealWorktree).toHaveBeenCalledTimes(1)
    expect(worktreeActivation.activateAndRevealWorktree).toHaveBeenCalledWith('folder-1::/folder', {
      sidebarRevealBehavior: 'auto'
    })
  })
})
