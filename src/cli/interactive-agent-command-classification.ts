function tokenizeLeadingShellWords(command: string, limit: number): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i]
    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current)
        if (tokens.length >= limit) {
          return tokens
        }
        current = ''
      }
      continue
    }
    current += ch
  }

  if (current && tokens.length < limit) {
    tokens.push(current)
  }
  return tokens
}

function commandBasename(command: string): string {
  const normalized = command.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase()
}

function isClaudeExecutable(command: string): boolean {
  return command === 'claude' || command === 'claude.exe' || command === 'claude.cmd'
}

function isShellAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
}

function stripShellLaunchPrefix(tokens: string[]): string[] {
  const remaining = [...tokens]
  while (remaining[0] && isShellAssignment(remaining[0])) {
    remaining.shift()
  }
  if (remaining[0] && commandBasename(remaining[0]) === 'env') {
    remaining.shift()
    while (remaining[0]) {
      const token = remaining[0]
      if (isShellAssignment(token)) {
        remaining.shift()
        continue
      }
      if (token === '-u' || token === '--unset') {
        remaining.splice(0, 2)
        continue
      }
      if (token.startsWith('--unset=')) {
        remaining.shift()
        continue
      }
      if (token.startsWith('-')) {
        remaining.shift()
        continue
      }
      break
    }
  }
  return remaining
}

function isOneShotClaudeFlag(token: string): boolean {
  const separatorIndex = token.indexOf('=')
  const optionName = separatorIndex === -1 ? token : token.slice(0, separatorIndex)
  return ['--help', '-h', '--version', '-V', '-p', '--print'].includes(optionName)
}

export function shouldUseRendererBackedInteractiveTerminal(command: string | undefined): boolean {
  if (!command) {
    return false
  }

  const tokens = stripShellLaunchPrefix(
    tokenizeLeadingShellWords(command.trim(), 32).filter((token) => token.length > 0)
  )

  const executable = tokens[0] ? commandBasename(tokens[0]) : ''
  return isClaudeExecutable(executable) && !tokens.slice(1).some(isOneShotClaudeFlag)
}
