import type { AgentHookSource } from '../agent-hook-relay'

// ─── URL routing ────────────────────────────────────────────────────

export const HOOK_SOURCE_BY_PATHNAME: Readonly<Record<string, AgentHookSource>> = Object.freeze({
  '/hook/claude': 'claude',
  '/hook/opencode': 'opencode',
  '/hook/pi': 'pi',
  '/hook/omp': 'omp',
  '/hook/prime-agent': 'prime-agent'
})

export function resolveHookSource(pathname: string): AgentHookSource | null {
  return HOOK_SOURCE_BY_PATHNAME[pathname] ?? null
}
