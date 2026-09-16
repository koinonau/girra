import { describe, expect, it } from 'vitest'
import {
  formatClientEnvironmentFooter,
  formatClientEnvironmentInfo,
  hasClientEnvironmentFooter
} from './client-environment-info'

const SAMPLE = {
  appVersion: '1.4.178-rc.2',
  platform: 'win32',
  osRelease: '10.0.22631',
  arch: 'x64',
  shell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
} as const

describe('formatClientEnvironmentInfo', () => {
  it('formats version, OS, and optional shell for copy-paste', () => {
    expect(formatClientEnvironmentInfo(SAMPLE)).toBe(
      [
        'Girra: 1.4.178-rc.2',
        'OS: win32 10.0.22631 (x64)',
        'Shell: C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
      ].join('\n')
    )
  })

  it('omits shell when unset and falls back unknown fields', () => {
    expect(
      formatClientEnvironmentInfo({
        appVersion: '',
        platform: 'darwin',
        osRelease: '',
        arch: 'arm64'
      })
    ).toBe(['Girra: unknown', 'OS: darwin (arm64)'].join('\n'))
  })

  it('keeps environment-controlled values on one line', () => {
    expect(
      formatClientEnvironmentInfo({
        appVersion: '1.2.3\nInjected: value',
        platform: 'linux',
        osRelease: '6.8\r\nExtra',
        arch: 'x64',
        shell: '/bin/zsh\nMore: data'
      })
    ).toBe(
      [
        'Girra: 1.2.3 Injected: value',
        'OS: linux 6.8 Extra (x64)',
        'Shell: /bin/zsh More: data'
      ].join('\n')
    )
  })
})

describe('environment footer helpers', () => {
  it('builds a marked footer and detects when one is already present', () => {
    const footer = formatClientEnvironmentFooter(SAMPLE)
    expect(footer.startsWith('---\nGirra:')).toBe(true)
    expect(hasClientEnvironmentFooter(`oops\n\n${footer}`)).toBe(true)
    expect(hasClientEnvironmentFooter('oops')).toBe(false)
  })

  it('detects a footer with authored text below it', () => {
    const footer = formatClientEnvironmentFooter(SAMPLE)
    expect(hasClientEnvironmentFooter(`\n\n${footer}\ntyped below`)).toBe(true)
  })

  it('still detects an edited footer block', () => {
    const editedFooter = ['---', 'Girra: locally-built', 'OS: edited by user'].join('\n')

    expect(hasClientEnvironmentFooter(editedFooter)).toBe(true)
  })

  it('reports no footer once it is deleted', () => {
    expect(hasClientEnvironmentFooter('Tabs hang after waking the laptop.')).toBe(false)
  })
})
