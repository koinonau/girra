import { describe, expect, it } from 'vitest'
import {
  adoptLegacyOrcaEnvNames,
  withLegacyOrcaEnvAliases,
  type EnvRecord
} from './legacy-orca-env-aliases'

describe('adoptLegacyOrcaEnvNames', () => {
  it('mirrors a legacy name onto its Girra name', () => {
    const env: EnvRecord = { ORCA_CLI_COMMAND: 'orca' }
    adoptLegacyOrcaEnvNames(env)
    expect(env.GIRRA_CLI_COMMAND).toBe('orca')
    expect(env.ORCA_CLI_COMMAND).toBe('orca')
  })

  it('leaves an explicit Girra value alone', () => {
    const env: EnvRecord = { ORCA_CLI_COMMAND: 'orca', GIRRA_CLI_COMMAND: 'girra' }
    adoptLegacyOrcaEnvNames(env)
    expect(env.GIRRA_CLI_COMMAND).toBe('girra')
  })

  it('carries an empty value across, since unset and empty differ to a shell', () => {
    const env: EnvRecord = { ORCA_BACKGROUND_LAUNCH: '' }
    adoptLegacyOrcaEnvNames(env)
    expect(env.GIRRA_BACKGROUND_LAUNCH).toBe('')
  })

  it('ignores an undefined value rather than inventing a set variable', () => {
    const env: EnvRecord = { ORCA_CLI_COMMAND: undefined }
    adoptLegacyOrcaEnvNames(env)
    expect('GIRRA_CLI_COMMAND' in env).toBe(false)
  })

  it('leaves unrelated names, and the bare prefix, untouched', () => {
    const env: EnvRecord = { PATH: '/usr/bin', ORCA_: 'x', ORCAFIED: 'y' }
    adoptLegacyOrcaEnvNames(env)
    expect(env).toEqual({ PATH: '/usr/bin', ORCA_: 'x', ORCAFIED: 'y' })
  })
})

describe('withLegacyOrcaEnvAliases', () => {
  it('adds a legacy alias beside every Girra name', () => {
    expect(withLegacyOrcaEnvAliases({ GIRRA_AGENT_HOOK_PORT: '8231', PATH: '/usr/bin' })).toEqual({
      GIRRA_AGENT_HOOK_PORT: '8231',
      ORCA_AGENT_HOOK_PORT: '8231',
      PATH: '/usr/bin'
    })
  })

  it('does not overwrite a legacy name the caller set deliberately', () => {
    expect(
      withLegacyOrcaEnvAliases({ GIRRA_CLI_COMMAND: 'girra', ORCA_CLI_COMMAND: 'orca' })
    ).toEqual({ GIRRA_CLI_COMMAND: 'girra', ORCA_CLI_COMMAND: 'orca' })
  })

  it('leaves the caller\'s object unchanged', () => {
    const env = { GIRRA_TAB_ID: '7' }
    withLegacyOrcaEnvAliases(env)
    expect(env).toEqual({ GIRRA_TAB_ID: '7' })
  })
})
