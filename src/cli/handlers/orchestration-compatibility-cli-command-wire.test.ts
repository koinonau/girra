import { describe, expect, it } from 'vitest'
import { AskParams, CheckParams } from '../../shared/rpc-contract/orchestration-params'

// Why this exists: the CLI still normalises `girra` down to a pre-rename alias before sending,
// because a host built before this enum was widened rejects the new spelling and fails the whole
// call. These assertions are what lets that normalisation be dropped later.
describe('orchestration compatibility CLI command', () => {
  it.each(['girra', 'girra-dev', 'orca', 'orca-ide', 'orca-dev'])('check accepts %s', (command) => {
    expect(CheckParams.parse({ compatibilityCliCommand: command }).compatibilityCliCommand).toBe(
      command
    )
  })

  it.each(['girra', 'girra-dev', 'orca', 'orca-ide', 'orca-dev'])('ask accepts %s', (command) => {
    const parsed = AskParams.parse({ question: 'ready?', compatibilityCliCommand: command })
    expect(parsed.compatibilityCliCommand).toBe(command)
  })

  it.each(['girra', 'orca', 'orca-ide'])('ask accepts %s as the Windows command', (command) => {
    const parsed = AskParams.parse({ question: 'ready?', compatibilityWindowsCommand: command })
    expect(parsed.compatibilityWindowsCommand).toBe(command)
  })

  it('still rejects a command it does not know', () => {
    expect(() => CheckParams.parse({ compatibilityCliCommand: 'whale' })).toThrow()
  })
})
