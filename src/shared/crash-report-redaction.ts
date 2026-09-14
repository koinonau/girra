const MAX_STRING_DETAIL_LENGTH = 240

const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g
]
const CREDENTIAL_URL_PATTERN = /\b[A-Za-z0-9._%+-]+:[A-Za-z0-9._%+-]+@(?=[^/\s]+)/g
const SECRET_ASSIGNMENT_PATTERN =
  /\b(token|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|secret|password|account[_-]?key)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^&\s,;]+)/gi

// Quoted paths retain spaces; unquoted paths stop at whitespace to preserve prose.
const PATH_PATTERNS = [
  /(["'`])\/[A-Za-z0-9._-]+\/(?:(?!\1)[^<>\n\r])+\1/g,
  /(["'`])[A-Za-z]:\\(?:(?!\1)[^<>\n\r])+\1/gi,
  /(["'`])\\\\[^\\\s"'`<>\n\r)]+\\(?:(?!\1)[^<>\n\r])+\1/gi,
  /(?<![A-Za-z0-9./])\/[A-Za-z0-9._-]+\/(?:\\ |[^\s"'`<>)]*)/g,
  /(?<![A-Za-z0-9])[A-Za-z]:\\(?:\\ |[^\s"'`<>\n\r)]*)/gi,
  /\\\\[^\\\s"'`<>\n\r)]+\\(?:\\ |[^\s"'`<>\n\r)]*)/gi,
  /%(?:USERPROFILE|APPDATA|LOCALAPPDATA|HOMEDRIVE|HOMEPATH)%[^\s"'`<>)]*/gi
]

export function sanitizeCrashReportString(
  value: string,
  maxLength = MAX_STRING_DETAIL_LENGTH
): string {
  let sanitized = value
  for (const pattern of PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted-path]')
  }
  sanitized = sanitized.replace(CREDENTIAL_URL_PATTERN, '[redacted-credential]@')
  sanitized = sanitized.replace(SECRET_ASSIGNMENT_PATTERN, (_match, key: string) => {
    return `${key}=[redacted]`
  })
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted-secret]')
  }
  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength)}...` : sanitized
}
