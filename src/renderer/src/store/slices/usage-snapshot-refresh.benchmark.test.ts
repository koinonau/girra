import { performance } from 'node:perf_hooks'
import { create } from 'zustand'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import type {
  OpenCodeUsageScanState,
  OpenCodeUsageSnapshot,
  OpenCodeUsageSummary
} from '../../../../shared/opencode-usage-types'
import { createOpenCodeUsageSlice } from './usage-provider-slices'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

async function flushImmediatePromises(): Promise<void> {
  for (let index = 0; index < 5; index++) {
    await Promise.resolve()
  }
}

function createOpenCodeOnlyStore() {
  return create<AppState>()((...args) => createOpenCodeUsageSlice(...args) as AppState)
}

function createScanState(overrides: Partial<OpenCodeUsageScanState> = {}): OpenCodeUsageScanState {
  return {
    enabled: true,
    isScanning: false,
    lastScanStartedAt: 100,
    lastScanCompletedAt: 200,
    lastScanError: null,
    hasAnyOpenCodeData: true,
    ...overrides
  }
}

function createSummary(totalTokens: number): OpenCodeUsageSummary {
  return {
    scope: 'orca',
    range: '30d',
    sessions: totalTokens / 100,
    events: totalTokens / 10,
    inputTokens: totalTokens / 2,
    cachedInputTokens: totalTokens / 10,
    outputTokens: totalTokens / 2,
    reasoningOutputTokens: 0,
    totalTokens,
    estimatedCostUsd: 1,
    topModel: 'gpt-5',
    topProject: 'orca',
    hasAnyOpenCodeData: true
  }
}

function createSnapshot(totalTokens: number, scanState = createScanState()): OpenCodeUsageSnapshot {
  return {
    scanState,
    summary: createSummary(totalTokens),
    daily: [
      {
        day: '2026-04-10',
        inputTokens: totalTokens / 2,
        cachedInputTokens: totalTokens / 10,
        outputTokens: totalTokens / 2,
        reasoningOutputTokens: 0,
        totalTokens
      }
    ],
    modelBreakdown: [],
    projectBreakdown: [],
    recentSessions: []
  }
}

describe('OpenCode usage cached snapshot benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders cached usage before a slow refresh completes', async () => {
    const slowRefresh = createDeferred<OpenCodeUsageScanState>()
    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot(100))
      .mockResolvedValueOnce(createSnapshot(200, createScanState({ lastScanCompletedAt: 300 })))
    const refresh = vi.fn(() => slowRefresh.promise)

    vi.stubGlobal('window', {
      api: {
        openCodeUsage: {
          getScanState: vi.fn(() => Promise.resolve(createScanState())),
          getSnapshot,
          refresh,
          setEnabled: vi.fn(),
          getSummary: vi.fn(),
          getDaily: vi.fn(),
          getBreakdown: vi.fn(),
          getRecentSessions: vi.fn()
        }
      }
    })

    const store = createOpenCodeOnlyStore()
    const startedAt = performance.now()
    const fetchPromise = store.getState().fetchOpenCodeUsage()

    await flushImmediatePromises()
    expect(store.getState().openCodeUsageSummary?.totalTokens).toBe(100)
    const cachedRenderMs = performance.now() - startedAt

    expect(cachedRenderMs).toBeLessThan(10)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(getSnapshot).toHaveBeenCalledTimes(1)

    slowRefresh.resolve(createScanState({ lastScanCompletedAt: 300 }))
    await fetchPromise

    expect(store.getState().openCodeUsageSummary?.totalTokens).toBe(200)
    expect(getSnapshot).toHaveBeenCalledTimes(2)
    expect(window.api.openCodeUsage.getSummary).not.toHaveBeenCalled()
    expect(window.api.openCodeUsage.getDaily).not.toHaveBeenCalled()
    expect(window.api.openCodeUsage.getBreakdown).not.toHaveBeenCalled()
    expect(window.api.openCodeUsage.getRecentSessions).not.toHaveBeenCalled()
  })
})
