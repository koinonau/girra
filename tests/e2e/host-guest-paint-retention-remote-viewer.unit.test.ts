/**
 * Composes the real chain a host guest's paint retention depends on, across the main/renderer
 * boundary that neither side's own suite can see:
 *
 *   runtime subscriber set
 *     -> the IPC snapshot the renderer hydrates from on reload
 *        (`runtime:getBrowserRemoteViewerPages`)
 *     -> isBrowserPagePanePaintable, which decides display:none on the guest.
 *
 * Chromium never paints inside a display:none subtree, so a guest parked that way stops emitting
 * the frames its subscriber asked for. Without the remote-viewer term a paired desktop/web/CLI
 * viewer receives frames only while the host operator happens to be looking at the same page.
 */
import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../src/main/runtime/orca-runtime'
import {
  createScreencastHarness,
  HARNESS_PAGE_ID as PAGE
} from '../../src/main/runtime/browser-screencast-subscriber-test-harness'
import {
  hasRemoteViewerForAnyBrowserPage,
  hydrateBrowserRemoteViewerPages
} from '../../src/renderer/src/lib/pane-manager/browser-remote-viewer-state'
import { isBrowserPagePanePaintable } from '../../src/renderer/src/components/browser-pane/host-guest/browser-page-paintability'

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), removeListener: vi.fn(), handle: vi.fn(), removeHandler: vi.fn() },
  webContents: { fromId: vi.fn() }
}))

function hostGuestIsPaintable(
  runtime: OrcaRuntimeService,
  hostIsLookingAtThisPage: boolean
): boolean {
  hydrateBrowserRemoteViewerPages(runtime.getBrowserRemoteViewerPages())
  return isBrowserPagePanePaintable({
    isActive: hostIsLookingAtThisPage,
    // No agent command is in flight, so no automation bootstrap lease is held. That lease is what
    // mounts a cold guest; it is released as soon as the command returns and cannot retain one.
    isAutomationVisible: false,
    hasRemoteViewer: hasRemoteViewerForAnyBrowserPage([PAGE])
  })
}

describe('host guest paint retention for a remote screencast subscriber', () => {
  it('keeps the guest painting for a paired desktop or web subscriber while the host looks elsewhere', async () => {
    const { runtime, subscribe } = createScreencastHarness()
    const desktop = subscribe({ connectionId: 'conn-desktop' })
    await desktop.streaming()
    expect(hostGuestIsPaintable(runtime, false)).toBe(true)
    desktop.stop()
    await desktop.done
  })

  it('keeps a co-viewing desktop client painting after another viewer leaves', async () => {
    const { runtime, subscribe } = createScreencastHarness()
    const first = subscribe({ connectionId: 'conn-first' })
    await first.streaming()
    const second = subscribe({ connectionId: 'conn-second' })
    await second.streaming()

    first.stop()
    await first.done
    expect(hostGuestIsPaintable(runtime, false)).toBe(true)

    second.stop()
    await second.done
  })

  it('parks the guest once nothing is watching and the host looks elsewhere', async () => {
    const { runtime, subscribe } = createScreencastHarness()
    const desktop = subscribe({ connectionId: 'conn-desktop' })
    await desktop.streaming()
    desktop.stop()
    await desktop.done

    // Presence: the same call still reports true while the host looks at the page, so the false
    // below is a real park and not an oracle that never returns true.
    expect(hostGuestIsPaintable(runtime, true)).toBe(true)
    expect(hostGuestIsPaintable(runtime, false)).toBe(false)
  })
})
