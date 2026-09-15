import { describe, expect, it } from 'vitest'
import type {
  ClaudeUsageDailyPoint,
  ClaudeUsageScanState,
  ClaudeUsageSummary
} from '../../../../shared/claude-usage-types'
import type {
  OpenCodeUsageDailyPoint,
  OpenCodeUsageScanState,
  OpenCodeUsageSummary
} from '../../../../shared/opencode-usage-types'
import { getRecentUsageDays } from './usage-overview-daily-series'
import { buildUsageOverview, formatUsageCost, formatUsageTokens } from './usage-overview-model'

function enabledClaudeScanState(): ClaudeUsageScanState {
  return {
    enabled: true,
    isScanning: false,
    lastScanStartedAt: 100,
    lastScanCompletedAt: 200,
    lastScanError: null,
    hasAnyClaudeData: true
  }
}

function enabledOpenCodeScanState(): OpenCodeUsageScanState {
  return {
    enabled: true,
    isScanning: false,
    lastScanStartedAt: 500,
    lastScanCompletedAt: 600,
    lastScanError: null,
    hasAnyOpenCodeData: true
  }
}

describe('usage overview model', () => {
  it('combines provider totals without double-counting cached input', () => {
    const claudeSummary: ClaudeUsageSummary = {
      scope: 'orca',
      range: '30d',
      sessions: 2,
      turns: 4,
      zeroCacheReadTurns: 1,
      inputTokens: 1_000,
      outputTokens: 500,
      cacheReadTokens: 4_000,
      cacheWriteTokens: 500,
      cacheReuseRate: 0.8,
      estimatedCostUsd: 0.04,
      topModel: 'claude-sonnet-4-5',
      topProject: 'orca-main',
      hasAnyClaudeData: true
    }
    const openCodeSummary: OpenCodeUsageSummary = {
      scope: 'orca',
      range: '30d',
      sessions: 1,
      events: 2,
      inputTokens: 1_000,
      cachedInputTokens: 250,
      outputTokens: 500,
      reasoningOutputTokens: 100,
      totalTokens: 1_600,
      estimatedCostUsd: 0.03,
      topModel: 'anthropic/claude-sonnet-4-5',
      topProject: 'orca-third',
      hasAnyOpenCodeData: true
    }
    const claudeDaily: ClaudeUsageDailyPoint[] = [
      {
        day: '2026-05-13',
        inputTokens: 500,
        outputTokens: 500,
        cacheReadTokens: 2_500,
        cacheWriteTokens: 0
      },
      {
        day: '2026-05-14',
        inputTokens: 500,
        outputTokens: 0,
        cacheReadTokens: 1_500,
        cacheWriteTokens: 500
      }
    ]
    const openCodeDaily: OpenCodeUsageDailyPoint[] = [
      {
        day: '2026-05-14',
        inputTokens: 1_000,
        cachedInputTokens: 250,
        outputTokens: 500,
        reasoningOutputTokens: 100,
        totalTokens: 1_600
      }
    ]

    const overview = buildUsageOverview({
      claude: {
        scanState: enabledClaudeScanState(),
        summary: claudeSummary,
        daily: claudeDaily
      },
      opencode: {
        scanState: enabledOpenCodeScanState(),
        summary: openCodeSummary,
        daily: openCodeDaily
      }
    })

    expect(overview.totalTokens).toBe(7_600)
    expect(overview.newInputTokens).toBe(1_750)
    expect(overview.cacheTokens).toBe(4_750)
    expect(overview.outputTokens).toBe(1_000)
    expect(overview.reasoningTokens).toBe(100)
    expect(overview.sessions).toBe(3)
    expect(overview.activityCount).toBe(6)
    expect(overview.activeDays).toBe(2)
    expect(overview.estimatedCostUsd).toBeCloseTo(0.07)
    expect(overview.cacheShare).toBeCloseTo(4_750 / 6_500)
    expect(overview.bestDay).toMatchObject({
      day: '2026-05-14',
      totalTokens: 4_100,
      claudeTokens: 2_500,
      openCodeTokens: 1_600,
      intensity: 4
    })
    expect(overview.providers.find((provider) => provider.id === 'opencode')).toMatchObject({
      newInputTokens: 750,
      cacheTokens: 250,
      totalTokens: 1_600
    })
  })

  it('pads recent usage days with zero-token cells', () => {
    const recent = getRecentUsageDays(
      [
        {
          day: '2026-05-14',
          totalTokens: 4_500,
          claudeTokens: 2_500,
          openCodeTokens: 0,
          intensity: 4
        }
      ],
      3,
      new Date('2026-05-15T12:00:00')
    )

    expect(recent).toEqual([
      {
        day: '2026-05-13',
        totalTokens: 0,
        claudeTokens: 0,
        openCodeTokens: 0,
        intensity: 0
      },
      {
        day: '2026-05-14',
        totalTokens: 4_500,
        claudeTokens: 2_500,
        openCodeTokens: 0,
        intensity: 4
      },
      {
        day: '2026-05-15',
        totalTokens: 0,
        claudeTokens: 0,
        openCodeTokens: 0,
        intensity: 0
      }
    ])
  })

  it('reports disabled providers as an empty overview', () => {
    const overview = buildUsageOverview({
      claude: { scanState: null, summary: null, daily: [] },
      opencode: { scanState: null, summary: null, daily: [] }
    })

    expect(overview.hasAnyEnabledProvider).toBe(false)
    expect(overview.hasAnyData).toBe(false)
    expect(overview.totalTokens).toBe(0)
    expect(overview.estimatedCostUsd).toBeNull()
    expect(overview.cacheShare).toBeNull()
  })

  it('aggregates very large daily histories without spreading every day into Math.max', () => {
    const openCodeDaily: OpenCodeUsageDailyPoint[] = Array.from({ length: 130_000 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index))
      return {
        day: date.toISOString().slice(0, 10),
        inputTokens: index + 1,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        totalTokens: index + 1
      }
    })

    const overview = buildUsageOverview({
      claude: { scanState: null, summary: null, daily: [] },
      opencode: {
        scanState: enabledOpenCodeScanState(),
        summary: null,
        daily: openCodeDaily
      }
    })

    expect(overview.daily).toHaveLength(130_000)
    expect(overview.bestDay?.totalTokens).toBe(130_000)
    expect(overview.daily.at(-1)?.intensity).toBe(4)
  })

  it('formats token and cost values for compact UI labels', () => {
    expect(formatUsageTokens(999)).toBe('999')
    expect(formatUsageTokens(1_200)).toBe('1.2k')
    expect(formatUsageTokens(2_500_000)).toBe('2.5M')
    expect(formatUsageCost(null)).toBe('n/a')
    expect(formatUsageCost(0.0042)).toBe('$0.0042')
    expect(formatUsageCost(1.234)).toBe('$1.23')
  })
})
