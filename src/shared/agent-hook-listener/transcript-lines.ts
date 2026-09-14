import { readLastAssistantFromTranscriptOnce } from './transcript-reader'

export function readLastAssistantFromTranscript(transcriptPath: unknown): string | undefined {
  if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) {
    return undefined
  }
  return readLastAssistantFromTranscriptOnce(transcriptPath)
}
