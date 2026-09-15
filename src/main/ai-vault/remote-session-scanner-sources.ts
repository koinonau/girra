import type { AiVaultAgent, AiVaultSession } from '../../shared/ai-vault-types'
import type { RemoteHostPlatform } from '../ssh/ssh-remote-platform'
import { joinRemotePath } from '../ssh/ssh-remote-platform'
import { parseMessageGraphSessionContent } from './session-scanner-graph-parsers'
import { parseClaudeSessionContent } from './session-scanner-primary-parsers'
import { partitionSubagentTranscriptPaths } from './session-scanner-subagent-transcripts'
import type { FileWithMtime } from './session-scanner-types'
import { normalizeAgentSessionsDir } from './session-scanner-values'
import type {
  RemoteParserOptions,
  RemoteScannerContext,
  RemoteSessionSource
} from './remote-session-scanner-types'

type RemoteContentParser = (
  file: FileWithMtime,
  content: string,
  platform: NodeJS.Platform,
  options: RemoteParserOptions,
  signal?: AbortSignal
) => Promise<AiVaultSession | null> | AiVaultSession | null

export function remoteSessionSources(
  remoteHome: string,
  hostPlatform: RemoteHostPlatform
): RemoteSessionSource[] {
  return [
    {
      ...jsonlSource(
        'claude',
        remoteHome,
        hostPlatform,
        ['.claude', 'projects'],
        parseClaudeSessionContent
      ),
      // The remote host owns the transcript disk, so the local readdir in the
      // Claude parser is skipped; the walked listing supplies the sibling
      // subagent counts instead. Partitioning also prunes the subagent
      // transcripts themselves, which would otherwise list as phantom
      // top-level sessions carrying the parent's sessionId.
      partitionSubagentTranscripts: partitionSubagentTranscriptPaths
    },
    jsonlSource(
      'pi',
      remoteHome,
      hostPlatform,
      remotePiSessionsSegments(),
      parseMessageGraphSessionContent
    )
  ]
}

function jsonlSource(
  agent: AiVaultAgent,
  remoteHome: string,
  hostPlatform: RemoteHostPlatform,
  segments: readonly string[],
  parseContent: RemoteContentParser
): RemoteSessionSource {
  return {
    agent,
    rootDir: joinRemotePath(hostPlatform, remoteHome, ...segments),
    extensions: ['.jsonl'],
    parse: (file, content, context) =>
      Promise.resolve(
        parseContent(file, content, context.hostPlatform.os, parserOptions(context), context.signal)
      )
  }
}

function parserOptions(context: RemoteScannerContext): RemoteParserOptions {
  return {
    executionHostId: context.executionHostId,
    executionHostPlatform: context.hostPlatform.os
  }
}

function remotePiSessionsSegments(): string[] {
  return normalizeAgentSessionsDir('/.pi/agent/sessions', '.pi').split('/').filter(Boolean)
}
