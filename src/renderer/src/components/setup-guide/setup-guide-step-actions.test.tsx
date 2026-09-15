// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SETUP_GUIDE_PROJECT_PROMPT,
  WorkspacesAction,
  getSetupGuideGitRepo,
  promptForSetupGuideProject
} from './setup-guide-step-actions'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import type { Repo } from '../../../../shared/repo-types'

vi.mock('sonner', () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mountedRoots: Root[] = []

function makeRepo(id: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/tmp/${id}`,
    displayName: id,
    badgeColor: '#000000',
    addedAt: 1,
    kind: 'git',
    ...overrides
  }
}

describe('setup guide workflow actions', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of mountedRoots.splice(0)) {
        root.unmount()
      }
    })
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    useAppStore.setState({
      activeModal: 'none',
      modalData: {},
      activeWorktreeId: null,
      worktreesByRepo: {},
      tabsByWorktree: {},
      activeTabId: null,
      activeGroupIdByWorktree: {},
      terminalLayoutsByTabId: {},
      repos: [],
      activeRepoId: null
    })
  })

  it('prompts for a project before setup-guide actions that need one', () => {
    const openModal = vi.fn()

    promptForSetupGuideProject(openModal)

    expect(openModal).toHaveBeenCalledWith('add-repo')
    expect(toast.message).toHaveBeenCalledWith(SETUP_GUIDE_PROJECT_PROMPT)
  })

  it('chooses the active git repo for setup-guide workspace creation', () => {
    const active = makeRepo('active')

    expect(getSetupGuideGitRepo([makeRepo('first'), active], 'active')).toBe(active)
  })

  it('falls back to the first git repo when the active project is a folder', () => {
    const gitRepo = makeRepo('git')

    expect(getSetupGuideGitRepo([makeRepo('folder', { kind: 'folder' }), gitRepo], 'folder')).toBe(
      gitRepo
    )
  })

  it('returns no setup-guide repo when only folders exist', () => {
    expect(getSetupGuideGitRepo([makeRepo('folder', { kind: 'folder' })], 'folder')).toBeNull()
  })

  it('opens the workspace composer on the setup-guide repo from Multi-task', async () => {
    useAppStore.setState({
      activeModal: 'none',
      modalData: {},
      repos: [makeRepo('repo-1')],
      activeRepoId: 'repo-1'
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mountedRoots.push(root)

    await act(async () => {
      root.render(<WorkspacesAction done={false} />)
    })
    const button = container.querySelector('button')
    expect(button?.textContent).toContain('Try it out')

    await act(async () => {
      button?.click()
    })

    expect(useAppStore.getState().activeModal).toBe('new-workspace-composer')
    expect(useAppStore.getState().modalData).toEqual({ initialRepoId: 'repo-1' })
  })
})
