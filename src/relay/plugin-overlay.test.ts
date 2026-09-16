import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { PluginOverlayManager } from './plugin-overlay'
import { resolvePiSourceAgentDir } from './plugin-overlay-env'

describe('PluginOverlayManager', () => {
  let homeDir: string
  let manager: PluginOverlayManager

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'plugin-overlay-'))
    manager = new PluginOverlayManager({ homeDir })
  })

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true })
  })

  it('reports no source until install runs', () => {
    expect(manager.hasOpenCodeSource()).toBe(false)
    expect(manager.hasPiSource()).toBe(false)
    expect(manager.materializeOpenCode('tab-1:0')).toBeNull()
    expect(manager.materializePi('tab-1:0')).toBeNull()
  })

  it('materializes OpenCode plugin into <overlay>/plugins/<file>', () => {
    manager.setSources({ opencodePluginSource: 'export const X = 1' })
    const dir = manager.materializeOpenCode('tab-1:0')
    expect(dir).not.toBeNull()
    const expected = join(dir!, 'plugins', 'orca-opencode-status.js')
    expect(existsSync(expected)).toBe(true)
    expect(readFileSync(expected, 'utf8')).toBe('export const X = 1')
  })

  it('mirrors a preexisting remote OpenCode config dir before adding Girra plugin', () => {
    const userConfigDir = join(homeDir, 'company-opencode')
    mkdirSync(join(userConfigDir, 'plugins'), { recursive: true })
    writeFileSync(join(userConfigDir, 'opencode.json'), '{"provider":"custom"}')
    writeFileSync(join(userConfigDir, 'plugins', 'user-plugin.js'), 'user plugin')
    writeFileSync(join(userConfigDir, 'plugins', 'orca-opencode-status.js'), 'user same-name')

    manager.setSources({ opencodePluginSource: 'orca plugin' })
    const dir = manager.materializeOpenCode('tab-opencode:0', userConfigDir)

    expect(dir).not.toBeNull()
    expect(readFileSync(join(dir!, 'opencode.json'), 'utf8')).toBe('{"provider":"custom"}')
    expect(readFileSync(join(dir!, 'plugins', 'user-plugin.js'), 'utf8')).toBe('user plugin')
    expect(readFileSync(join(dir!, 'plugins', 'orca-opencode-status.js'), 'utf8')).toBe(
      'orca plugin'
    )
    expect(readFileSync(join(userConfigDir, 'plugins', 'orca-opencode-status.js'), 'utf8')).toBe(
      'user same-name'
    )
  })

  it('does not override a missing preexisting OpenCode config dir', () => {
    manager.setSources({ opencodePluginSource: 'orca plugin' })

    expect(manager.materializeOpenCode('tab-missing:0', join(homeDir, 'missing'))).toBeNull()
  })

  it('installs Pi extension into the real agent extensions dir', () => {
    manager.setSources({ piExtensionSource: '// pi extension' })
    const result = manager.materializePi('tab-2:0')
    expect(result?.sourceAgentDir).toBeDefined()
    const file = join(result!.sourceAgentDir, 'extensions', 'orca-agent-status.ts')
    expect(result?.statusExtensionPath).toBe(file)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf8')).toContain('@orca-managed-pi-extension')
  })

  it("does not overwrite a user's same-named remote Pi extension file", () => {
    const piAgentDir = join(homeDir, '.pi', 'agent')
    const extensionFile = join(piAgentDir, 'extensions', 'orca-agent-status.ts')
    mkdirSync(join(piAgentDir, 'extensions'), { recursive: true })
    writeFileSync(extensionFile, 'user-owned remote status extension')

    manager.setSources({ piExtensionSource: '// pi extension' })
    expect(manager.materializePi('tab-user-owned-pi:0')).toBeNull()
    expect(readFileSync(extensionFile, 'utf8')).toBe('user-owned remote status extension')
  })

  it('installs Girra status extension into the remote default Pi agent dir', () => {
    const piAgentDir = join(homeDir, '.pi', 'agent')
    mkdirSync(join(piAgentDir, 'skills', 'my-skill'), { recursive: true })
    mkdirSync(join(piAgentDir, 'extensions', 'user-ext'), { recursive: true })
    writeFileSync(join(piAgentDir, 'auth.json'), 'secret token')
    writeFileSync(join(piAgentDir, 'skills', 'my-skill', 'SKILL.md'), 'critical user skill')
    writeFileSync(join(piAgentDir, 'extensions', 'user-ext', 'ext.ts'), 'user extension')
    writeFileSync(
      join(piAgentDir, 'settings.json'),
      JSON.stringify({
        defaultProvider: 'amazon-bedrock',
        hideThinkingBlock: false,
        terminal: {
          showImages: false,
          clearOnShrink: false
        }
      })
    )

    manager.setSources({ piExtensionSource: '// pi extension' })
    const result = manager.materializePi('tab-pi:0')
    const dir = result?.sourceAgentDir

    expect(dir).toBeDefined()
    expect(readFileSync(join(dir!, 'auth.json'), 'utf8')).toBe('secret token')
    expect(readFileSync(join(dir!, 'skills', 'my-skill', 'SKILL.md'), 'utf8')).toBe(
      'critical user skill'
    )
    expect(readFileSync(join(dir!, 'extensions', 'user-ext', 'ext.ts'), 'utf8')).toBe(
      'user extension'
    )
    expect(readdirSync(join(dir!, 'extensions')).sort()).toEqual([
      'orca-agent-status.ts',
      'user-ext'
    ])
    expect(JSON.parse(readFileSync(join(dir!, 'settings.json'), 'utf8'))).toEqual({
      defaultProvider: 'amazon-bedrock',
      hideThinkingBlock: false,
      terminal: {
        showImages: false,
        clearOnShrink: false
      }
    })
    expect(JSON.parse(readFileSync(join(piAgentDir, 'settings.json'), 'utf8'))).toEqual({
      defaultProvider: 'amazon-bedrock',
      hideThinkingBlock: false,
      terminal: {
        showImages: false,
        clearOnShrink: false
      }
    })
  })

  it('mirrors a preexisting remote Pi agent dir instead of the default', () => {
    const defaultAgentDir = join(homeDir, '.pi', 'agent')
    const customAgentDir = join(homeDir, 'custom-pi-agent')
    mkdirSync(defaultAgentDir, { recursive: true })
    mkdirSync(join(customAgentDir, 'extensions'), { recursive: true })
    writeFileSync(join(defaultAgentDir, 'auth.json'), 'default token')
    writeFileSync(join(customAgentDir, 'auth.json'), 'custom token')
    writeFileSync(join(customAgentDir, 'extensions', 'custom.ts'), 'custom extension')

    manager.setSources({ piExtensionSource: '// pi extension' })
    const result = manager.materializePi('tab-custom-pi:0', customAgentDir)
    const dir = result?.sourceAgentDir

    expect(dir).toBeDefined()
    expect(readFileSync(join(dir!, 'auth.json'), 'utf8')).toBe('custom token')
    expect(readFileSync(join(dir!, 'extensions', 'custom.ts'), 'utf8')).toBe('custom extension')
    expect(readFileSync(join(dir!, 'extensions', 'orca-agent-status.ts'), 'utf8')).toContain(
      '// pi extension'
    )
  })

  it('bare-shell prep does not create a missing remote Pi home (#10196)', () => {
    manager.setSources({ piExtensionSource: '// pi extension' })

    expect(
      manager.materializePi('tab-bare-pi:0', undefined, { materializeDefaultHome: false })
    ).toBeNull()
    expect(existsSync(join(homeDir, '.pi'))).toBe(false)
  })

  it('does not override a missing preexisting Pi agent dir', () => {
    manager.setSources({ piExtensionSource: '// pi extension' })

    expect(manager.materializePi('tab-missing-pi:0', join(homeDir, 'missing-pi'))).toBeNull()
  })

  it('clearOverlay removes OpenCode overlays without deleting the real Pi home', () => {
    manager.setSources({ opencodePluginSource: 'opencode', piExtensionSource: 'pi' })
    const opencodeDir = manager.materializeOpenCode('tab-3:0')!
    const piDir = manager.materializePi('tab-3:0')!.sourceAgentDir
    expect(existsSync(opencodeDir)).toBe(true)
    expect(existsSync(piDir)).toBe(true)

    manager.clearOverlay('tab-3:0')

    expect(existsSync(opencodeDir)).toBe(false)
    expect(existsSync(piDir)).toBe(true)
  })

  it.skipIf(process.platform === 'win32')(
    'clearOverlay removes OpenCode overlay symlinks without deleting their targets',
    () => {
      const userConfigDir = join(homeDir, 'company-opencode')
      const linkedTarget = join(homeDir, 'linked-plugin-target')
      mkdirSync(join(userConfigDir, 'plugins'), { recursive: true })
      mkdirSync(linkedTarget, { recursive: true })
      writeFileSync(join(linkedTarget, 'keep.js'), 'do not delete')
      symlinkSync(linkedTarget, join(userConfigDir, 'plugins', 'linked-plugin'), 'dir')

      manager.setSources({ opencodePluginSource: 'orca plugin' })
      const dir = manager.materializeOpenCode('tab-opencode-symlink:0', userConfigDir)!
      expect(existsSync(join(dir, 'plugins', 'linked-plugin'))).toBe(true)

      manager.clearOverlay('tab-opencode-symlink:0')

      expect(existsSync(dir)).toBe(false)
      expect(readFileSync(join(linkedTarget, 'keep.js'), 'utf8')).toBe('do not delete')
    }
  )

  it('produces stable overlay dirs for a given id (idempotent re-materialization)', () => {
    manager.setSources({ opencodePluginSource: 'first' })
    const dirA = manager.materializeOpenCode('tab-stable:0')!
    manager.setSources({ opencodePluginSource: 'second' })
    const dirB = manager.materializeOpenCode('tab-stable:0')!
    expect(dirA).toBe(dirB)
    expect(readFileSync(join(dirA, 'plugins', 'orca-opencode-status.js'), 'utf8')).toBe('second')
  })

  it('hashes unsafe pane ids into portable overlay directory names', () => {
    manager.setSources({ opencodePluginSource: 'plugin' })
    const dir = manager.materializeOpenCode('tab/with\\unsafe:chars\n0')

    expect(dir).not.toBeNull()
    expect(basename(dir!)).toMatch(/^[a-f0-9]{32}$/)
    expect(dir).not.toContain('tab/with')
    expect(existsSync(join(dir!, 'plugins', 'orca-opencode-status.js'))).toBe(true)
  })
})

describe('resolvePiSourceAgentDir', () => {
  it('prefers the source shadow and ignores an inherited Girra overlay', () => {
    const env = {
      HOME: mkdtempSync(join(tmpdir(), 'plugin-overlay-env-')),
      PI_CODING_AGENT_DIR: '/tmp/parent-orca-pi-overlay',
      ORCA_PI_CODING_AGENT_DIR: '/tmp/parent-orca-pi-overlay'
    }
    try {
      expect(
        resolvePiSourceAgentDir({ ...env, ORCA_PI_SOURCE_AGENT_DIR: '/user/.pi/agent' }, undefined)
      ).toBe('/user/.pi/agent')
      expect(resolvePiSourceAgentDir(env, undefined)).toBeUndefined()
    } finally {
      rmSync(env.HOME, { recursive: true, force: true })
    }
  })

  it('keeps explicit PI_CODING_AGENT_DIR values when they are not Girra overlays', () => {
    const env = {
      HOME: mkdtempSync(join(tmpdir(), 'plugin-overlay-env-')),
      PI_CODING_AGENT_DIR: '/user/custom-pi-agent'
    }
    try {
      expect(resolvePiSourceAgentDir(env, undefined)).toBe('/user/custom-pi-agent')
    } finally {
      rmSync(env.HOME, { recursive: true, force: true })
    }
  })
})
