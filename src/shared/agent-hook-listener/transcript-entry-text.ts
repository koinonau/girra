import { parseAgentHookJson } from './request-body'

export function extractAssistantTextFromLine(line: string): string | undefined {
  let entry: unknown
  try {
    entry = parseAgentHookJson(line)
  } catch {
    return undefined
  }
  if (typeof entry !== 'object' || entry === null) {
    return undefined
  }
  const record = entry as Record<string, unknown>
  const nestedMessage = record.message as Record<string, unknown> | undefined
  const role =
    record.role ?? nestedMessage?.role ?? (record.type === 'assistant' ? 'assistant' : undefined)
  if (role !== 'assistant') {
    return undefined
  }
  const content = (nestedMessage ?? record).content
  return extractAssistantContentText(content)
}

function extractAssistantContentText(content: unknown): string | undefined {
  if (typeof content === 'string' && content.trim().length > 0) {
    return content
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'object' && part !== null) {
        const text = (part as Record<string, unknown>).text
        if (typeof text === 'string' && text.trim().length > 0) {
          return text
        }
      }
    }
  }
  return undefined
}
