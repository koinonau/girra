// Line-window primitive over a newline-joined terminal tail, used by the wait-blocked prompt rules.

function isTerminalWaitWhitespace(value: string, index: number): boolean {
  const code = value.charCodeAt(index)
  return code === 32 || (code >= 9 && code <= 13)
}

/** Offset where the last `count` non-blank lines begin (0 when the tail is shorter). */
// Why: the visible-screen probe joins raw rows, so blank spacer rows must not eat a dialog's window.
export function startOfLastNonBlankLines(value: string, count: number): number {
  let seen = 0
  let lineEnd = value.length
  for (;;) {
    const lineStart = value.lastIndexOf('\n', lineEnd - 1) + 1
    if (hasNonWhitespaceBetween(value, lineStart, lineEnd)) {
      seen += 1
      if (seen >= count) {
        return lineStart
      }
    }
    if (lineStart === 0) {
      return 0
    }
    lineEnd = lineStart - 1
  }
}

function hasNonWhitespaceBetween(value: string, start: number, end: number): boolean {
  for (let index = start; index < end; index += 1) {
    if (!isTerminalWaitWhitespace(value, index)) {
      return true
    }
  }
  return false
}
