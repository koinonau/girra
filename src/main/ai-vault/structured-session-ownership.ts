import { agentSessionLeaseAdmitsWriter } from '../../shared/agent-session-lease-adjudication'
import type { AiVaultListResult, AiVaultSession } from '../../shared/ai-vault-types'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import {
  listStructuredProviderSessionOwnership,
  type StructuredProviderSessionOwnership
} from '../native-chat/agent-session-wire/structured-provider-session-ownership'

export function projectStructuredAiVaultSessions(
  result: AiVaultListResult,
  structuredSupported: boolean
): AiVaultListResult {
  const host = getStructuredAgentSessionHost()
  if (!host) {
    return result
  }
  const sessions = result.sessions.flatMap((session) => {
    const ownership = findSessionOwnership(session)
    if (!ownership) {
      return [session]
    }
    if (!structuredSupported) {
      return []
    }
    return [
      {
        ...session,
        structuredSession: {
          sessionId: ownership.sessionId,
          workspaceId: ownership.workspaceId
        }
      }
    ]
  })
  return sessions.length === result.sessions.length &&
    sessions.every((row, index) => row === result.sessions[index])
    ? result
    : { ...result, sessions }
}

export async function assertLegacyAiVaultResumeCommandAllowed(
  command: string,
  ensureHost: () => Promise<void>
): Promise<void> {
  if (!isPotentialStructuredResumeCommand(command)) {
    return
  }
  await ensureHost()
  const host = getStructuredAgentSessionHost()
  if (!host) {
    return
  }
  for (const ownership of listOwnership()) {
    if (isResumeCommandFor(command, ownership)) {
      refuseLegacyWriter(ownership)
    }
  }
}

function isPotentialStructuredResumeCommand(command: string): boolean {
  return parseResumeInvocation(command) !== null
}

function findSessionOwnership(session: AiVaultSession): StructuredProviderSessionOwnership | null {
  return session.agent === 'claude' ? findOwnership(session.sessionId) : null
}

function findOwnership(providerSessionId: string): StructuredProviderSessionOwnership | null {
  return (
    listOwnership().find(
      (ownership) =>
        ownership.provider === 'claude' && ownership.providerSessionId === providerSessionId
    ) ?? null
  )
}

function listOwnership(): StructuredProviderSessionOwnership[] {
  const host = getStructuredAgentSessionHost()
  return host ? listStructuredProviderSessionOwnership(host.deps.store.listRecords()) : []
}

function isResumeCommandFor(
  command: string,
  ownership: StructuredProviderSessionOwnership
): boolean {
  const invocation = parseResumeInvocation(command)
  if (!invocation || ownership.provider !== 'claude') {
    return false
  }
  // A target-less resume (--continue, or a bare --resume/-r) may pick
  // any provider session, so it cannot be admitted while one is structured.
  // Only an explicit target that differs from this owned session is safe.
  return invocation.target === null || invocation.target === ownership.providerSessionId
}

type ResumeInvocation = {
  target: string | null
}

function parseResumeInvocation(command: string): ResumeInvocation | null {
  // Keep this deliberately conservative: shell quoting is normalized only
  // enough to identify executable/flag tokens; an unrecognized shape is not
  // treated as proof that a different session is being resumed.
  const tokens = command.match(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^']*'|[^\s]+/g) ?? []
  const normalized = tokens.map((token) => token.replace(/^['"]|['"]$/g, ''))
  const executableIndex = normalized.findIndex((token) =>
    /(?:^|[\\/])claude(?:\.exe)?$/i.test(token)
  )
  if (executableIndex === -1) {
    return null
  }
  const args = normalized.slice(executableIndex + 1)
  // `--continue`/`-c` resume the most recent session and never take an id, so a
  // following token is a prompt, not a target — they are always target-less.
  if (args.some((token) => ['--continue', '-c'].includes(token.toLowerCase()))) {
    return { target: null }
  }
  const inlineIndex = args.findIndex(
    (token) => token.toLowerCase().startsWith('--resume=') || token.toLowerCase().startsWith('-r=')
  )
  if (inlineIndex !== -1) {
    const target = args[inlineIndex]!.slice(args[inlineIndex]!.indexOf('=') + 1)
    return { target: target.length > 0 ? target : null }
  }
  const markerIndex = args.findIndex((token) => ['--resume', '-r'].includes(token.toLowerCase()))
  if (markerIndex === -1) {
    return null
  }
  const candidate = args[markerIndex + 1]
  return { target: candidate && !candidate.startsWith('-') ? candidate : null }
}

function refuseLegacyWriter(ownership: StructuredProviderSessionOwnership): never {
  throw new Error(
    agentSessionLeaseAdmitsWriter(ownership.lease)
      ? 'agent_session_conflict'
      : 'agent_session_ownership_unknown'
  )
}
