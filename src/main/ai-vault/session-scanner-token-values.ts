import { asRecord } from './session-scanner-record-value'

export function tokenTotal(value: unknown): number {
  const usage = asRecord(value)
  if (!usage) {
    return 0
  }
  const explicitTotal =
    numberValue(usage.total) || numberValue(usage.totalTokens) || numberValue(usage.total_tokens)
  if (explicitTotal > 0) {
    return explicitTotal
  }

  const fields: unknown[] = [
    usage.input,
    usage.inputTokens,
    usage.input_tokens,
    usage.output,
    usage.outputTokens,
    usage.output_tokens,
    usage.cacheRead,
    usage.cacheReadTokens,
    usage.cache_read_input_tokens,
    usage.cacheWrite,
    usage.cacheWriteTokens,
    usage.cache_creation_input_tokens,
    usage.cached,
    usage.cachedInputTokens,
    usage.cached_input_tokens,
    usage.reasoning,
    usage.reasoningOutputTokens,
    usage.reasoning_output_tokens
  ]
  return fields.reduce<number>((total, current) => total + numberValue(current), 0)
}

export function claudeUsageTotal(value: unknown): number {
  const usage = asRecord(value)
  if (!usage) {
    return 0
  }
  return (
    numberValue(usage.input_tokens) +
    numberValue(usage.output_tokens) +
    numberValue(usage.cache_read_input_tokens) +
    numberValue(usage.cache_creation_input_tokens)
  )
}

export function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
