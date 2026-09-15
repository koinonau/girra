import { describe, expect, it } from 'vitest'
import {
  isAgentForegroundWrapperProcess,
  isExpectedAgentProcess,
  isRecognizedAgentType,
  recognizeAgentProcess,
  recognizeAgentProcessFromCommandLine
} from './agent-process-recognition'

describe('agent process recognition', () => {
  it('recognizes packaged Codex foreground process names', () => {
    expect(recognizeAgentProcess('codex-aarch64-ap')).toEqual({
      agent: 'codex',
      processName: 'codex-aarch64-ap'
    })
    expect(isRecognizedAgentType('codex-aarch64-ap')).toBe(true)
  })

  it('recognizes the OpenClaude foreground process', () => {
    expect(recognizeAgentProcess('/usr/local/bin/openclaude')).toEqual({
      agent: 'openclaude',
      processName: 'openclaude'
    })
    expect(isRecognizedAgentType('openclaude')).toBe(true)
    expect(isExpectedAgentProcess('/usr/local/bin/openclaude', 'claude')).toBe(false)
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

  it('recognizes Trae by its traecli binary, not the ambiguous trae-cli name', () => {
    expect(recognizeAgentProcess('traecli')).toEqual({
      agent: 'trae',
      processName: 'traecli'
    })
    expect(recognizeAgentProcess('/Users/dev/.local/bin/traecli')).toEqual({
      agent: 'trae',
      processName: 'traecli'
    })
    expect(isExpectedAgentProcess('/Users/dev/.local/bin/traecli', 'traecli')).toBe(true)
    expect(isRecognizedAgentType('traecli')).toBe(true)
    // Why: `trae-cli` and `trae-agent` both name the unrelated open-source bytedance/trae-agent.
    expect(recognizeAgentProcess('trae-cli')).toBeNull()
    expect(recognizeAgentProcess('trae-agent')).toBeNull()
  })

  it('recognizes Mistral Vibe by its installed executable and legacy alias', () => {
    expect(recognizeAgentProcess('/home/dev/.local/bin/vibe')).toEqual({
      agent: 'mistral-vibe',
      processName: 'vibe'
    })
    expect(recognizeAgentProcess('mistral-vibe')).toEqual({
      agent: 'mistral-vibe',
      processName: 'mistral-vibe'
    })
    expect(isRecognizedAgentType('vibe')).toBe(true)
  })

  it('recognizes Kimi Code by the kimi-code process its launcher becomes', () => {
    expect(recognizeAgentProcess('/home/dev/.kimi-code/bin/kimi')).toEqual({
      agent: 'kimi',
      processName: 'kimi'
    })
    expect(recognizeAgentProcess('kimi-code')).toEqual({
      agent: 'kimi',
      processName: 'kimi-code'
    })
    expect(isExpectedAgentProcess('/home/dev/.kimi-code/bin/kimi', 'kimi')).toBe(true)
    expect(isRecognizedAgentType('kimi-code')).toBe(true)
  })

  it('recognizes Qwen Code by its installed qwen executable', () => {
    expect(recognizeAgentProcess('/home/dev/.local/bin/qwen')).toEqual({
      agent: 'qwen-code',
      processName: 'qwen'
    })
    expect(recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\qwen.cmd`)).toEqual({
      agent: 'qwen-code',
      processName: 'qwen'
    })
    expect(isExpectedAgentProcess('/usr/local/bin/qwen', 'qwen')).toBe(true)
    expect(isRecognizedAgentType('qwen')).toBe(true)
  })

  it('recognizes agent CLIs launched through interpreter wrappers', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.nvm/versions/node/bin/codex')
    ).toEqual({ agent: 'codex', processName: 'codex' })
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
        String.raw`node C:\Users\dev\AppData\Roaming\npm\codex.cmd`
      )
    ).toEqual({ agent: 'codex', processName: 'codex' })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js`
      )
    ).toEqual({ agent: 'codex', processName: 'codex' })
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
        String.raw`node C:\repo\server.js --plugin C:\tmp\codex.js`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\codex.js`)).toBeNull()
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

  it('recognizes the Antigravity CLI from bare, POSIX and Windows command lines', () => {
    const agy = { agent: 'antigravity', processName: 'agy' }

    expect(recognizeAgentProcess('agy')).toEqual(agy)
    expect(recognizeAgentProcess('/Users/dev/.local/bin/agy')).toEqual(agy)
    expect(recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Local\agy\bin\agy.exe`)).toEqual(
      agy
    )
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`"C:\Users\dev\AppData\Local\agy\bin\agy.exe" --dangerously-skip-permissions`
      )
    ).toEqual(agy)
    expect(recognizeAgentProcessFromCommandLine('agy --dangerously-skip-permissions')).toEqual(agy)
  })
})
