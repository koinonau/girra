// @vitest-environment happy-dom

// Reproduces the production lazy-chunk failure on 1.4.171–1.4.175: guard 'not-attempted'
// -> reload requested -> the reload never lands -> recovery gives up. Without a
// LazyChunkLoadError the boundary receives the raw SyntaxError instead of containing it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GIRRA_RENDERER_UNLOAD_PREVENTED_EVENT } from '../../../shared/renderer-shutdown-events'
import {
  isLazyChunkLoadError,
  loadLazyWithRetry,
  resetLazyChunkReloadRequestsForTest
} from './lazy-with-retry'

const RELOAD_GUARD_KEY = 'orca:lazy-chunk-reload-attempted'
const RELOAD_SETTLE_GRACE_MS = 10_000

// The dominant crash-time message across the shipped bundles (7/9 reports).
const CORRUPT_CHUNK_ERROR = (): SyntaxError => new SyntaxError("Unexpected token '}'")

describe('loadLazyWithRetry when the recovery reload never lands', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
    resetLazyChunkReloadRequestsForTest()
    // Production truth: location.reload() produced zero navigations.
    vi.spyOn(window.location, 'reload').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    resetLazyChunkReloadRequestsForTest()
  })

  it('surfaces a recognizable LazyChunkLoadError so the boundary can contain it', async () => {
    const settled = loadLazyWithRetry(() => Promise.reject(CORRUPT_CHUNK_ERROR()), {
      retries: 0,
      reloadKey: 'right-sidebar'
    }).then(
      () => ({ ok: true }) as const,
      (error: unknown) => ({ ok: false, error }) as const
    )

    // Let the reload request run, then expire the settle grace window.
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(RELOAD_SETTLE_GRACE_MS + 1)

    const result = await settled
    expect(result.ok).toBe(false)

    // The boundary treats LazyChunkLoadError as a contained chunk failure.
    expect(isLazyChunkLoadError((result as { error: unknown }).error)).toBe(true)
  })

  it('does not strand a sibling lazy import that fails while a reload is pending', async () => {
    const first = loadLazyWithRetry(() => Promise.reject(CORRUPT_CHUNK_ERROR()), {
      retries: 0,
      reloadKey: 'app.root'
    }).catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(0)

    // A second surface resolves its lazy chunk while the first reload is still in
    // flight — observed 250 ms / 95 ms after the reload request in the field.
    const sibling = loadLazyWithRetry(() => Promise.reject(CORRUPT_CHUNK_ERROR()), {
      retries: 0,
      reloadKey: 'app.root.sibling'
    }).catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(RELOAD_SETTLE_GRACE_MS + 1)

    expect(isLazyChunkLoadError(await first)).toBe(true)
    expect(isLazyChunkLoadError(await sibling)).toBe(true)
  })

  it('contains an unload-vetoed reload', async () => {
    vi.spyOn(window.location, 'reload').mockImplementation(() => {
      window.dispatchEvent(new Event(GIRRA_RENDERER_UNLOAD_PREVENTED_EVENT))
    })

    const settled = loadLazyWithRetry(() => Promise.reject(CORRUPT_CHUNK_ERROR()), {
      retries: 0
    }).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(0)

    // A veto is still an attempted-and-failed recovery, so it is contained too.
    expect(isLazyChunkLoadError(await settled)).toBe(true)
  })

  it('leaves no guard behind that would block a later document from recovering', async () => {
    const settled = loadLazyWithRetry(() => Promise.reject(CORRUPT_CHUNK_ERROR()), {
      retries: 0
    }).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(RELOAD_SETTLE_GRACE_MS + 1)

    expect(isLazyChunkLoadError(await settled)).toBe(true)
    expect(window.sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull()
  })

  it('still surfaces ordinary evaluation bugs after a never-landed reload attempt', async () => {
    const error = new Error('render bug from lazy module evaluation')
    const settled = loadLazyWithRetry(() => Promise.reject(error), { retries: 0 }).catch(
      (rejection: unknown) => rejection
    )
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(RELOAD_SETTLE_GRACE_MS + 1)

    // Containment is only for known dynamic-import failures; real bugs must still report.
    expect(await settled).toBe(error)
    expect(isLazyChunkLoadError(error)).toBe(false)
  })
})
