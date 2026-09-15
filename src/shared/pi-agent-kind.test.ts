import { describe, expect, it } from 'vitest'
import { isPiLaunchCommand } from './pi-agent-kind'

describe('isPiLaunchCommand', () => {
  it('recognizes pi by bare name, path and Windows extension', () => {
    expect(isPiLaunchCommand('pi')).toBe(true)
    expect(isPiLaunchCommand('pi --resume')).toBe(true)
    expect(isPiLaunchCommand('/usr/local/bin/pi')).toBe(true)
    expect(isPiLaunchCommand('PI.CMD')).toBe(true)
  })

  it('reads only the first token', () => {
    expect(isPiLaunchCommand('claude "ask about pi"')).toBe(false)
    expect(isPiLaunchCommand('pi "compare claude"')).toBe(true)
  })

  it('does not confuse "pi" with substrings like pip / mpi / python', () => {
    expect(isPiLaunchCommand('pip install foo')).toBe(false)
    expect(isPiLaunchCommand('mpirun -n 4 ./app')).toBe(false)
    expect(isPiLaunchCommand('python3 script.py')).toBe(false)
  })

  it('returns false for missing or non-Pi commands', () => {
    expect(isPiLaunchCommand(undefined)).toBe(false)
    expect(isPiLaunchCommand('')).toBe(false)
    expect(isPiLaunchCommand('claude')).toBe(false)
  })
})
