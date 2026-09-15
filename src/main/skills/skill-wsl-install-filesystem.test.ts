import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runWslProcessMock } = vi.hoisted(() => ({ runWslProcessMock: vi.fn() }))

vi.mock('../wsl/wsl-runner', () => ({ runWslProcess: runWslProcessMock }))

import { WslSkillInstallFilesystem } from './skill-wsl-install-filesystem'

const WSL_ROOT = '\\\\wsl.localhost\\Ubuntu-24.04\\home\\jin\\.agents\\skills'

beforeEach(() => {
  runWslProcessMock.mockReset().mockResolvedValue({
    environmentResolved: true,
    code: 0,
    stdout: '',
    stderr: '',
    timedOut: false
  })
})

describe('WslSkillInstallFilesystem', () => {
  it('maps Windows workspace roots into the selected distro and rejects escapes', async () => {
    const filesystem = new WslSkillInstallFilesystem('Ubuntu-24.04', [
      'C:\\Users\\jin\\repo\\.agents\\skills'
    ])
    await filesystem.rename(
      'C:\\Users\\jin\\repo\\.agents\\skills\\.skill.orca-staging-1',
      'C:\\Users\\jin\\repo\\.agents\\skills\\skill'
    )
    expect(runWslProcessMock.mock.calls[0]?.[0].args).toEqual(
      expect.arrayContaining([
        '/mnt/c/Users/jin/repo/.agents/skills/.skill.orca-staging-1',
        '/mnt/c/Users/jin/repo/.agents/skills/skill'
      ])
    )
    await expect(filesystem.remove('C:\\Users\\jin\\repo\\unrelated')).rejects.toThrow(
      'skill-install-wsl-path-outside-root'
    )
    expect(runWslProcessMock).toHaveBeenCalledOnce()
  })

  it('rejects a path from another distro before spawning wsl.exe', async () => {
    const filesystem = new WslSkillInstallFilesystem('Ubuntu-24.04', [WSL_ROOT])
    await expect(
      filesystem.remove('\\\\wsl.localhost\\Debian\\home\\jin\\.agents\\skills\\skill')
    ).rejects.toThrow('skill-install-wsl-path-invalid')
    expect(runWslProcessMock).not.toHaveBeenCalled()
  })

  it('authorizes a historical provider root before update or removal', async () => {
    const filesystem = new WslSkillInstallFilesystem('Ubuntu-24.04', [WSL_ROOT])
    const historicalRoot =
      '\\\\wsl.localhost\\Ubuntu-24.04\\home\\jin\\.local\\share\\orca\\claude-accounts\\old\\auth\\skills'
    filesystem.authorizeRoots([historicalRoot])

    await filesystem.remove(`${historicalRoot}\\private-skill`)

    expect(runWslProcessMock).toHaveBeenCalledOnce()
    expect(runWslProcessMock.mock.calls[0]?.[0].args).toEqual(
      expect.arrayContaining([
        '/home/jin/.local/share/orca/claude-accounts/old/auth/skills/private-skill'
      ])
    )
  })

  it('surfaces a nonzero guest exit as a guest-operation failure', async () => {
    runWslProcessMock.mockResolvedValueOnce({
      code: 42,
      stdout: '',
      stderr: 'mode mismatch',
      timedOut: false
    })
    const filesystem = new WslSkillInstallFilesystem('Ubuntu-24.04', [WSL_ROOT])
    await expect(filesystem.remove(`${WSL_ROOT}\\private-skill`)).rejects.toThrow(
      'skill-install-wsl-guest-operation-failed'
    )
  })
})
