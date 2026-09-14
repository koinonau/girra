import type { MemorySnapshot, StatsSummary } from '../../shared/process-stats-types'

export type StatsApi = {
  getSummary: () => Promise<StatsSummary>
}

// Diagnostics IPC payloads; mirror the runtime types in `src/main/observability/{index,bundle}.ts`.
export type DiagnosticsStatusPayload = {
  readonly localFileEnabled: boolean
  readonly bundleEnabled: boolean
  readonly traceFilePath: string
  readonly traceFamilySize: number
  readonly disabledReason?:
    | 'do_not_track'
    | 'orca_telemetry_disabled'
    | 'orca_diagnostics_disabled'
    | 'ci'
}
export type DiagnosticsBundlePayload = {
  readonly bundleSubmissionId: string
  readonly bytes: number
  readonly spanCount: number
}

export type MemoryApi = {
  getSnapshot: () => Promise<MemorySnapshot>
}

export type DiagnosticsApi = {
  getStatus: () => Promise<DiagnosticsStatusPayload>
  collectBundle: (lookbackMinutes?: number) => Promise<DiagnosticsBundlePayload>
  openBundlePreview: (bundleSubmissionId: string) => Promise<void>
  discardBundlePreview: (bundleSubmissionId: string) => Promise<void>
}
