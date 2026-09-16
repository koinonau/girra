/**
 * The host-local signal that says a paired client is streaming this page. The host renderer needs
 * it because Chromium stops painting a display:none guest, so without this signal a remote viewer
 * has nothing keeping its own stream alive.
 * The renderer half of the chain lives in tests/e2e/host-guest-paint-retention-remote-viewer.
 */
import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from './orca-runtime'
import {
  createScreencastHarness,
  HARNESS_PAGE_ID as PAGE
} from './browser-screencast-subscriber-test-harness'

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), removeListener: vi.fn(), handle: vi.fn(), removeHandler: vi.fn() },
  webContents: { fromId: vi.fn() }
}))

describe('browser screencast remote viewer signal', () => {
  it('marks the page watched while a desktop-scoped subscriber streams', async () => {
    const { runtime, subscribe } = createScreencastHarness()
    expect(runtime.getBrowserRemoteViewerPages()).toEqual([])

    const desktop = subscribe({ connectionId: 'conn-desktop' })
    await desktop.streaming()
    expect(runtime.getBrowserRemoteViewerPages()).toEqual([PAGE])

    desktop.stop()
    await desktop.done
    expect(runtime.getBrowserRemoteViewerPages()).toEqual([])
  })

  it('holds the signal until the last subscriber leaves', async () => {
    const { runtime, subscribe } = createScreencastHarness()
    const first = subscribe({ connectionId: 'conn-a' })
    await first.streaming()
    const desktop = subscribe({ connectionId: 'conn-desktop' })
    await desktop.streaming()

    first.stop()
    await first.done
    expect(runtime.getBrowserRemoteViewerPages()).toEqual([PAGE])

    desktop.stop()
    await desktop.done
    expect(runtime.getBrowserRemoteViewerPages()).toEqual([])
  })

  it('notifies the host renderer on the first arrival and the last departure only', async () => {
    const { runtime, subscribe } = createScreencastHarness()
    const browserRemoteViewersChanged = vi.fn()
    runtime.setNotifier({
      browserRemoteViewersChanged
    } as unknown as Parameters<OrcaRuntimeService['setNotifier']>[0])

    const first = subscribe({ connectionId: 'conn-a' })
    await first.streaming()
    const second = subscribe({ connectionId: 'conn-b' })
    await second.streaming()
    expect(browserRemoteViewersChanged.mock.calls).toEqual([[PAGE, true]])

    first.stop()
    await first.done
    expect(browserRemoteViewersChanged.mock.calls).toEqual([[PAGE, true]])

    second.stop()
    await second.done
    expect(browserRemoteViewersChanged.mock.calls).toEqual([
      [PAGE, true],
      [PAGE, false]
    ])
  })
})
