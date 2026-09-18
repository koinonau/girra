import { describe, expect, it } from 'vitest'
import { retargetCliOutputCommandName } from './cli-output-command-name'

const SSH_CALLER = { ORCA_CLI_COMMAND: 'orca' } as NodeJS.ProcessEnv
const LOCAL_CALLER = {} as NodeJS.ProcessEnv

describe('retargetCliOutputCommandName', () => {
  it('names the shim an SSH caller actually has', () => {
    expect(
      retargetCliOutputCommandName('Next step: Run `girra linear issue ENG-1 --json`.', SSH_CALLER)
    ).toBe('Next step: Run `orca linear issue ENG-1 --json`.')
  })

  it('leaves the canonical name alone for a local caller', () => {
    const text = "Run 'girra snapshot' to get fresh refs."
    expect(retargetCliOutputCommandName(text, LOCAL_CALLER)).toBe(text)
  })

  it('retargets every command in one message', () => {
    expect(
      retargetCliOutputCommandName(
        'Read its output with `girra terminal read` or `girra orchestration worker-read`.',
        SSH_CALLER
      )
    ).toBe('Read its output with `orca terminal read` or `orca orchestration worker-read`.')
  })

  it('rewrites the commands inside a rendered --json body', () => {
    const body = JSON.stringify({ error: { data: { nextSteps: ['Run `girra tab list`.'] } } })
    expect(retargetCliOutputCommandName(body, SSH_CALLER)).toContain('Run `orca tab list`.')
  })

  it('leaves the product name and a bare mention alone', () => {
    const text = 'Girra is not running. The girra CLI ships with the desktop app.'
    expect(retargetCliOutputCommandName(text, SSH_CALLER)).toBe(text)
  })

  it('follows a dev checkout', () => {
    expect(
      retargetCliOutputCommandName('Run `girra status`.', {
        ORCA_DEV_REPO_ROOT: '/repo'
      } as NodeJS.ProcessEnv)
    ).toBe('Run `girra-dev status`.')
  })
})
