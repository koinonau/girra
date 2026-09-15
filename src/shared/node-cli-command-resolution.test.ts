import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getVersionManagerBinPaths,
  withCliRuntimeOnPath,
  resolveClaudeCommand,
  resolveCliCommand,
  resolveCliCommands
} from './node-cli-command-resolution'

function makeExecutable(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '')
  if (process.platform !== 'win32') {
    chmodSync(path, 0o755)
  }
}

function makeNonExecutableFile(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '')
  if (process.platform !== 'win32') {
    chmodSync(path, 0o644)
  }
}

describe('resolveCliCommand', () => {
  afterEach(() => {
    delete process.env.PATH
    delete process.env.Path
  })

  it('prefers OpenCode already present on PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const pathDir = join(root, 'bin')
    const commandPath = join(pathDir, 'opencode')
    makeExecutable(commandPath)

    expect(
      resolveCliCommand('opencode', { platform: 'darwin', pathEnv: pathDir, homePath: root })
    ).toBe(commandPath)
  })

  it.skipIf(process.platform === 'win32')(
    'skips non-runnable PATH entries and keeps scanning',
    () => {
      const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
      const badDir = join(root, 'bad-bin')
      const goodDir = join(root, 'good-bin')
      const badCommandPath = join(badDir, 'opencode')
      const goodCommandPath = join(goodDir, 'opencode')
      makeNonExecutableFile(badCommandPath)
      makeExecutable(goodCommandPath)

      expect(
        resolveCliCommand('opencode', {
          platform: 'linux',
          pathEnv: [badDir, goodDir].join(delimiter),
          homePath: root
        })
      ).toBe(goodCommandPath)
    }
  )

  it('skips PATH directories named like the command', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const badDir = join(root, 'bad-bin')
    const goodDir = join(root, 'good-bin')
    mkdirSync(join(badDir, 'opencode'), { recursive: true })
    const goodCommandPath = join(goodDir, 'opencode')
    makeExecutable(goodCommandPath)

    expect(
      resolveCliCommand('opencode', {
        platform: 'linux',
        pathEnv: [badDir, goodDir].join(delimiter),
        homePath: root
      })
    ).toBe(goodCommandPath)
  })

  it('falls back to the newest nvm-installed OpenCode when PATH misses it', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const v22Path = join(root, '.nvm', 'versions', 'node', 'v22.14.0', 'bin', 'opencode')
    const v24Path = join(root, '.nvm', 'versions', 'node', 'v24.13.0', 'bin', 'opencode')
    makeExecutable(v22Path)
    makeExecutable(v24Path)

    expect(resolveCliCommand('opencode', { platform: 'darwin', pathEnv: '', homePath: root })).toBe(
      v24Path
    )
  })

  it('finds OpenCode in pnpm global bin on macOS', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const pnpmPath = join(root, 'Library', 'pnpm', 'opencode')
    makeExecutable(pnpmPath)

    expect(resolveCliCommand('opencode', { platform: 'darwin', pathEnv: '', homePath: root })).toBe(
      pnpmPath
    )
  })

  it('finds OpenCode in pnpm global bin on Linux', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const pnpmPath = join(root, '.local', 'share', 'pnpm', 'opencode')
    makeExecutable(pnpmPath)

    expect(resolveCliCommand('opencode', { platform: 'linux', pathEnv: '', homePath: root })).toBe(
      pnpmPath
    )
  })

  it('finds OpenCode in pnpm global bin on Windows', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const pnpmPath = join(root, 'AppData', 'Local', 'pnpm', 'opencode.cmd')
    makeExecutable(pnpmPath)

    expect(resolveCliCommand('opencode', { platform: 'win32', pathEnv: '', homePath: root })).toBe(
      pnpmPath
    )
  })

  it('finds OpenCode in yarn global bin on macOS', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const yarnPath = join(root, '.yarn', 'bin', 'opencode')
    makeExecutable(yarnPath)

    expect(resolveCliCommand('opencode', { platform: 'darwin', pathEnv: '', homePath: root })).toBe(
      yarnPath
    )
  })

  it('finds OpenCode in yarn global bin on Windows', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const yarnPath = join(root, 'AppData', 'Local', 'Yarn', 'bin', 'opencode.cmd')
    makeExecutable(yarnPath)

    expect(resolveCliCommand('opencode', { platform: 'win32', pathEnv: '', homePath: root })).toBe(
      yarnPath
    )
  })

  it('finds OpenCode in bun global bin', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const bunPath = join(root, '.bun', 'bin', 'opencode')
    makeExecutable(bunPath)

    expect(resolveCliCommand('opencode', { platform: 'linux', pathEnv: '', homePath: root })).toBe(
      bunPath
    )
  })

  it('finds OpenCode in bun global bin on Windows', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const bunPath = join(root, '.bun', 'bin', 'opencode.exe')
    makeExecutable(bunPath)

    expect(resolveCliCommand('opencode', { platform: 'win32', pathEnv: '', homePath: root })).toBe(
      bunPath
    )
  })

  it('finds OpenCode in mise shims directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))
    const misePath = join(root, '.local', 'share', 'mise', 'shims', 'opencode')
    makeExecutable(misePath)

    expect(resolveCliCommand('opencode', { platform: 'linux', pathEnv: '', homePath: root })).toBe(
      misePath
    )
  })

  it('returns the bare command when no filesystem candidate exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-command-'))

    expect(resolveCliCommand('opencode', { platform: 'linux', pathEnv: '', homePath: root })).toBe(
      'opencode'
    )
  })
})

describe('resolveClaudeCommand', () => {
  afterEach(() => {
    delete process.env.PATH
    delete process.env.Path
  })

  it('prefers claude already present on PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))
    const pathDir = join(root, 'bin')
    const commandPath = join(pathDir, 'claude')
    makeExecutable(commandPath)

    expect(resolveClaudeCommand({ platform: 'darwin', pathEnv: pathDir, homePath: root })).toBe(
      commandPath
    )
  })

  it('falls back to the newest nvm-installed claude when PATH misses it', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))
    const v22Path = join(root, '.nvm', 'versions', 'node', 'v22.14.0', 'bin', 'claude')
    const v24Path = join(root, '.nvm', 'versions', 'node', 'v24.13.0', 'bin', 'claude')
    makeExecutable(v22Path)
    makeExecutable(v24Path)

    expect(resolveClaudeCommand({ platform: 'darwin', pathEnv: '', homePath: root })).toBe(v24Path)
  })

  it('finds claude in pnpm global bin on macOS', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))
    const pnpmPath = join(root, 'Library', 'pnpm', 'claude')
    makeExecutable(pnpmPath)

    expect(resolveClaudeCommand({ platform: 'darwin', pathEnv: '', homePath: root })).toBe(pnpmPath)
  })

  it('finds claude in yarn global bin', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))
    const yarnPath = join(root, '.yarn', 'bin', 'claude')
    makeExecutable(yarnPath)

    expect(resolveClaudeCommand({ platform: 'linux', pathEnv: '', homePath: root })).toBe(yarnPath)
  })

  it('finds claude in bun global bin', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))
    const bunPath = join(root, '.bun', 'bin', 'claude')
    makeExecutable(bunPath)

    expect(resolveClaudeCommand({ platform: 'darwin', pathEnv: '', homePath: root })).toBe(bunPath)
  })

  it('finds native Windows claude.exe in user-local bin', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))
    const nativePath = join(root, '.local', 'bin', 'claude.exe')
    makeExecutable(nativePath)

    expect(resolveClaudeCommand({ platform: 'win32', pathEnv: '', homePath: root })).toBe(
      nativePath
    )
  })

  it('returns the bare command when no filesystem candidate exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-claude-command-'))

    expect(resolveClaudeCommand({ platform: 'linux', pathEnv: '', homePath: root })).toBe('claude')
  })
})

describe('resolveCliCommands', () => {
  afterEach(() => {
    delete process.env.PATH
    delete process.env.Path
  })

  it('resolves a batch from PATH and install directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-commands-'))
    const pathDir = join(root, 'bin')
    const pathClaude = join(pathDir, 'claude')
    const nvmPi = join(root, '.nvm', 'versions', 'node', 'v24.13.0', 'bin', 'pi')
    const pnpmOpencode = join(root, 'Library', 'pnpm', 'opencode')
    makeExecutable(pathClaude)
    makeExecutable(nvmPi)
    makeExecutable(pnpmOpencode)

    const resolved = resolveCliCommands(['claude', 'pi', 'opencode', 'missing'], {
      platform: 'darwin',
      pathEnv: pathDir,
      homePath: root
    })

    expect(resolved.get('claude')).toBe(pathClaude)
    expect(resolved.get('pi')).toBe(nvmPi)
    expect(resolved.get('opencode')).toBe(pnpmOpencode)
    expect(resolved.get('missing')).toBe('missing')
  })

  it('deduplicates command names in the returned map', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cli-commands-'))
    const pathDir = join(root, 'bin')
    const pathClaude = join(pathDir, 'claude')
    makeExecutable(pathClaude)

    const resolved = resolveCliCommands(['claude', 'claude'], {
      platform: 'linux',
      pathEnv: pathDir,
      homePath: root
    })

    expect([...resolved.keys()]).toEqual(['claude'])
    expect(resolved.get('claude')).toBe(pathClaude)
  })
})

describe('getVersionManagerBinPaths', () => {
  it('includes volta, asdf, fnm, mise, pnpm, yarn, and bun directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-vm-paths-'))
    const paths = getVersionManagerBinPaths({ platform: 'darwin', pathEnv: '', homePath: root })

    expect(paths).toContain(join(root, '.volta', 'bin'))
    expect(paths).toContain(join(root, '.asdf', 'shims'))
    expect(paths).toContain(join(root, '.fnm', 'aliases', 'default', 'bin'))
    expect(paths).toContain(join(root, '.local', 'share', 'mise', 'shims'))
    expect(paths).toContain(join(root, 'Library', 'pnpm'))
    expect(paths).toContain(join(root, '.yarn', 'bin'))
    expect(paths).toContain(join(root, '.bun', 'bin'))
  })

  it('includes nvm bin dir when node versions exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-vm-paths-'))
    const nodeBin = join(root, '.nvm', 'versions', 'node', 'v22.14.0', 'bin', 'node')
    makeExecutable(nodeBin)

    const paths = getVersionManagerBinPaths({ platform: 'darwin', pathEnv: '', homePath: root })
    expect(paths).toContain(join(root, '.nvm', 'versions', 'node', 'v22.14.0', 'bin'))
  })

  it('uses platform-specific pnpm path on Linux', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-vm-paths-'))
    const paths = getVersionManagerBinPaths({ platform: 'linux', pathEnv: '', homePath: root })

    expect(paths).toContain(join(root, '.local', 'share', 'pnpm'))
    expect(paths).not.toContain(join(root, 'Library', 'pnpm'))
  })

  it('includes Windows user-local bin for native CLI installers', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-vm-paths-'))
    const paths = getVersionManagerBinPaths({ platform: 'win32', pathEnv: '', homePath: root })

    expect(paths).toContain(join(root, '.local', 'bin'))
    expect(paths).toContain(join(root, 'AppData', 'Roaming', 'npm'))
  })
})

describe('withCliRuntimeOnPath', () => {
  it('pairs a version-manager CLI with its sibling node (stablyai/orca#10932)', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pair-'))
    const v20 = join(root, '.nvm', 'versions', 'node', 'v20.11.0', 'bin')
    const v22 = join(root, '.nvm', 'versions', 'node', 'v22.9.0', 'bin')
    makeExecutable(join(v20, 'node'))
    makeExecutable(join(v20, 'opencode'))
    makeExecutable(join(v22, 'node'))

    // default is v22, but opencode only exists under v20
    const env = { PATH: [v22, '/usr/bin'].join(delimiter) }
    const opencode = resolveCliCommand('opencode', {
      platform: 'darwin',
      pathEnv: env.PATH,
      homePath: root
    })
    expect(opencode).toBe(join(v20, 'opencode'))

    const paired = withCliRuntimeOnPath(opencode, env, { platform: 'darwin' })
    // the shebang's `node` must now come from v20, not v22
    expect(paired.PATH.split(delimiter)[0]).toBe(v20)
  })

  it('leaves PATH untouched for a CLI whose directory ships no node', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pair-'))
    const brew = join(root, 'opt', 'homebrew', 'bin')
    makeExecutable(join(brew, 'opencode'))
    const env = { PATH: '/usr/bin' }

    expect(withCliRuntimeOnPath(join(brew, 'opencode'), env, { platform: 'darwin' })).toBe(env)
  })

  it('leaves PATH untouched for a bare command name', () => {
    const env = { PATH: '/usr/bin' }
    expect(withCliRuntimeOnPath('opencode', env, { platform: 'darwin' })).toBe(env)
  })

  it('is a no-op when the runtime directory already leads PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pair-'))
    const v20 = join(root, '.nvm', 'versions', 'node', 'v20.11.0', 'bin')
    makeExecutable(join(v20, 'node'))
    makeExecutable(join(v20, 'opencode'))
    const env = { PATH: [v20, '/usr/bin'].join(delimiter) }

    expect(withCliRuntimeOnPath(join(v20, 'opencode'), env, { platform: 'darwin' })).toBe(env)
  })

  it('reads the Windows path key the child will actually use, whatever its casing', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pair-'))
    const v20 = join(root, '.nvm', 'versions', 'node', 'v20.11.0', 'bin')
    makeExecutable(join(v20, 'node.exe'))
    makeExecutable(join(v20, 'opencode.cmd'))
    // Why: win32 resolves env names case-insensitively, so a block may spell it
    // any way. Reading a narrower set than the twin-dedupe deletes would drop
    // this entry unread and hand the child a PATH containing only our directory.
    const env = { path: 'C:\\Windows;C:\\Windows\\System32', HOME: 'x' }

    const paired = withCliRuntimeOnPath(join(v20, 'opencode.cmd'), env, { platform: 'win32' })
    expect(paired.path).toBe([v20, 'C:\\Windows', 'C:\\Windows\\System32'].join(';'))
    expect(Object.keys(paired).filter((key) => key.toLowerCase() === 'path')).toEqual(['path'])
  })

  it('writes the Windows Path key without leaving a differently-cased twin', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pair-'))
    const v20 = join(root, '.nvm', 'versions', 'node', 'v20.11.0', 'bin')
    makeExecutable(join(v20, 'node.exe'))
    makeExecutable(join(v20, 'opencode.cmd'))
    // Why both keys: with only `Path` seeded the assertion is vacuous — the
    // helper cannot invent a `PATH` key, so the dedupe loop could be deleted
    // wholesale and this test would still pass.
    const env = { Path: 'C:\\Windows;C:\\Windows\\System32', PATH: 'C:\\Stale' }

    const paired = withCliRuntimeOnPath(join(v20, 'opencode.cmd'), env, { platform: 'win32' })
    expect(Object.keys(paired)).toEqual(['Path'])
    // Why the whole string: splitting on the host delimiter while joining on ';'
    // shredded every drive letter into `C;\\Windows`.
    expect(paired.Path).toBe([v20, 'C:\\Windows', 'C:\\Windows\\System32'].join(';'))
  })
})
