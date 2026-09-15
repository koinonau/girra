import { describe, expect, it } from 'vitest'
import {
  isAgentForegroundWrapperProcess,
  isExpectedAgentProcess,
  isRecognizedAgentType,
  recognizeAgentProcess,
  recognizeAgentProcessFromCommandLine
} from './agent-process-recognition'

describe('agent process recognition', () => {
  it('does not recognize a claude-prefixed binary as the Claude agent', () => {
    expect(recognizeAgentProcess('/usr/local/bin/claudette')).toBeNull()
    expect(isRecognizedAgentType('claudette')).toBe(false)
    expect(isExpectedAgentProcess('/usr/local/bin/claudette', 'claude')).toBe(false)
  })

  it('recognizes the Pi foreground process on Windows', () => {
    expect(recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\pi.cmd`)).toEqual({
      agent: 'pi',
      processName: 'pi'
    })
  })

  it('matches expected agents from platform-specific foreground process paths', () => {
    expect(recognizeAgentProcess('claude')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    expect(
      isExpectedAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\claude.exe`, 'claude')
    ).toBe(true)
    expect(isExpectedAgentProcess('/usr/local/bin/claude', 'claude')).toBe(true)
    expect(isExpectedAgentProcess('powershell.exe', 'claude')).toBe(false)
  })

  it('does not recognize Claude print-mode hook subprocesses as interactive agents', () => {
    expect(
      recognizeAgentProcessFromCommandLine(
        'claude --print --model haiku "Analyze this conversation and determine: Does the assistant have more autonomous work to do RIGHT NOW?"'
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`/home/dev/.local/bin/claude -p "Context: This summary will be shown in a list"`
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`C:\Users\dev\AppData\Roaming\npm\claude.exe --output-format=json "hook prompt"`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('claude --resume abc123')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
  })

  it('recognizes OpenCode without classifying Windows cmd.exe as an agent', () => {
    expect(recognizeAgentProcess('opencode')).toEqual({
      agent: 'opencode',
      processName: 'opencode'
    })
    expect(
      recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\opencode.cmd`)
    ).toEqual({
      agent: 'opencode',
      processName: 'opencode'
    })
    expect(isRecognizedAgentType('opencode')).toBe(true)
    expect(isRecognizedAgentType('cmd.exe')).toBe(false)
    expect(recognizeAgentProcess('cmd.exe')).toBeNull()
  })

  it('recognizes Pi without classifying pi-prefixed path fragments as the agent', () => {
    expect(recognizeAgentProcess('pi')).toEqual({
      agent: 'pi',
      processName: 'pi'
    })
    expect(recognizeAgentProcess('/Users/dev/.pi/bin/pi')).toEqual({
      agent: 'pi',
      processName: 'pi'
    })
    expect(isExpectedAgentProcess('/Users/dev/.pi/bin/pi', 'pi')).toBe(true)
    expect(isRecognizedAgentType('pi')).toBe(true)
    // Why: 'pi' is a common token in directory and binary names; only the
    // exact normalized basename may classify as the agent.
    expect(recognizeAgentProcess('pi-mono')).toBeNull()
    expect(recognizeAgentProcess('pipenv')).toBeNull()
    expect(isExpectedAgentProcess('pi-mono', 'pi')).toBe(false)
  })

  it('recognizes a detect-command alias, not a lookalike name', () => {
    expect(recognizeAgentProcess('/Users/dev/.local/bin/orca-ide')).toEqual({
      agent: 'claude-agent-teams',
      processName: 'orca-ide'
    })
    expect(isRecognizedAgentType('orca-dev')).toBe(true)
    expect(recognizeAgentProcess('orca-helper')).toBeNull()
  })

  it('recognizes agent CLIs launched through interpreter wrappers', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.nvm/versions/node/bin/pi')
    ).toEqual({ agent: 'pi', processName: 'pi' })
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.nvm/versions/node/bin/opencode')
    ).toEqual({ agent: 'opencode', processName: 'opencode' })
    expect(
      recognizeAgentProcessFromCommandLine('python3 /opt/homebrew/bin/claude --resume')
    ).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    expect(
      recognizeAgentProcessFromCommandLine('python3.12 /opt/homebrew/bin/claude --resume')
    ).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    expect(recognizeAgentProcessFromCommandLine('python -m opencode')).toEqual({
      agent: 'opencode',
      processName: 'opencode'
    })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`python C:\Users\dev\AppData\Roaming\Python\Python312\Scripts\opencode.py`
      )
    ).toEqual({ agent: 'opencode', processName: 'opencode' })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\claude.cmd`
      )
    ).toEqual({ agent: 'claude', processName: 'claude' })
  })

  it.each(['earendil-works', 'mariozechner'])('recognizes the @%s Pi npm entrypoint', (scope) => {
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node.exe C:\Users\dev\AppData\Roaming\npm\node_modules\@${scope}\pi-coding-agent\dist\cli.js`
      )
    ).toEqual({ agent: 'pi', processName: 'pi' })
  })

  it('recognizes only the agent subcommand of the generic Orca CLI', () => {
    expect(recognizeAgentProcessFromCommandLine('orca claude-teams')).toEqual({
      agent: 'claude-agent-teams',
      processName: 'orca'
    })
    expect(recognizeAgentProcessFromCommandLine('orca status')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('orca-dev terminal list')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('node /usr/local/bin/orca claude-teams')).toEqual({
      agent: 'claude-agent-teams',
      processName: 'orca'
    })
    expect(recognizeAgentProcessFromCommandLine('node /usr/local/bin/orca status')).toBeNull()
  })

  it('does not classify prompt text as a wrapped agent command', () => {
    expect(
      recognizeAgentProcessFromCommandLine(
        'node /tmp/not-an-agent.js "compare opencode vs orca in Claude Code"'
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\tmp\not-an-agent.js`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\repo\server.js --plugin C:\tmp\claude.js`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\claude.js`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\opencode.mjs`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\repo\node_modules\@example\pi-coding-agent\dist\cli.js`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`python C:\repo\opencode.py`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('python -m not_opencode')).toBeNull()
  })

  it('identifies only foreground processes that can wrap agent entrypoints', () => {
    expect(isAgentForegroundWrapperProcess('node.exe')).toBe(true)
    expect(isAgentForegroundWrapperProcess('/usr/bin/python3')).toBe(true)
    expect(isAgentForegroundWrapperProcess('python3.12.exe')).toBe(true)
    expect(isAgentForegroundWrapperProcess('bash')).toBe(false)
    expect(isAgentForegroundWrapperProcess('vim.exe')).toBe(false)
  })

  it('recognizes the OpenCode CLI from bare, POSIX and Windows command lines', () => {
    const opencode = { agent: 'opencode', processName: 'opencode' }

    expect(recognizeAgentProcess('/Users/dev/.local/bin/opencode')).toEqual(opencode)
    expect(
      recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Local\opencode\bin\opencode.exe`)
    ).toEqual(opencode)
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`"C:\Users\dev\AppData\Local\opencode\bin\opencode.exe" --model build`
      )
    ).toEqual(opencode)
    expect(recognizeAgentProcessFromCommandLine('opencode --model build')).toEqual(opencode)
  })
})
