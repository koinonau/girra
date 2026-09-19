import { describe, expect, it, vi } from 'vitest'
import { RemoteDesktopTerminalFloor } from './remote-desktop-terminal-floor'

// Why this exists: `claimHost` is how a host takes a PTY back from a remote desktop, reached from
// `pty:claimViewport` when the user types into a pane parked at `remote-desktop-fit`. It used to
// sit beside a second take-back path through `reclaimTerminalForDesktop`, which read a map the
// floor never wrote and so always reported nothing to reclaim. That path is deleted; this is the
// one that does the work, and nothing pinned it.
function makeFloor(hostTarget = { cols: 100, rows: 40 }) {
  const applyLayout = vi.fn().mockResolvedValue({ ok: true })
  const floor = new RemoteDesktopTerminalFloor({
    getTerminalSize: () => ({ cols: 80, rows: 24 }),
    resolveHostTarget: () => hostTarget,
    applyLayout
  })
  return { floor, applyLayout }
}

describe('a host taking a terminal back from a remote desktop', () => {
  it('drops the viewer owner and lays the PTY out at the host size', async () => {
    const { floor, applyLayout } = makeFloor()
    await floor.updateViewer('pty-1', 'sub-a', 'client-a', 90, 30)
    expect(floor.isResizeDriven('pty-1')).toBe(true)
    applyLayout.mockClear()

    await expect(floor.claimHost('pty-1', 120, 50)).resolves.toBe(true)

    expect(floor.isResizeDriven('pty-1')).toBe(false)
    expect(applyLayout).toHaveBeenCalledWith('pty-1', { kind: 'desktop', cols: 120, rows: 50 })
  })

  it('clamps the host viewport it reclaims to', async () => {
    const { floor, applyLayout } = makeFloor()
    await floor.updateViewer('pty-1', 'sub-a', 'client-a', 90, 30)
    applyLayout.mockClear()

    await floor.claimHost('pty-1', 5000, 1)

    expect(applyLayout).toHaveBeenCalledWith('pty-1', { kind: 'desktop', cols: 240, rows: 8 })
  })

  it('does nothing when no remote desktop owns the terminal', async () => {
    const { floor, applyLayout } = makeFloor()

    await expect(floor.claimHost('pty-untouched', 120, 50)).resolves.toBe(true)

    expect(applyLayout).not.toHaveBeenCalled()
  })

  // Why: a reclaim whose resize failed keeps its host geometry, so the next host input retries it
  // at the size the host actually measured rather than re-deriving one from a parked terminal.
  it('retries a failed reclaim at the geometry it first recorded', async () => {
    const { floor, applyLayout } = makeFloor()
    await floor.updateViewer('pty-1', 'sub-a', 'client-a', 90, 30)
    applyLayout.mockResolvedValueOnce({ ok: false })
    await expect(floor.claimHost('pty-1', 120, 50)).resolves.toBe(false)
    applyLayout.mockClear()

    await expect(floor.claimHost('pty-1', 130, 60)).resolves.toBe(true)

    expect(applyLayout).toHaveBeenCalledTimes(1)
    expect(applyLayout).toHaveBeenCalledWith('pty-1', { kind: 'desktop', cols: 120, rows: 50 })
  })

  // Why: a settled reclaim releases its target, so the next host input is a no-op rather than a
  // second desktop layout at whatever the pane happens to measure.
  it('does not lay out again once a reclaim has settled', async () => {
    const { floor, applyLayout } = makeFloor()
    await floor.updateViewer('pty-1', 'sub-a', 'client-a', 90, 30)
    await floor.claimHost('pty-1', 120, 50)
    applyLayout.mockClear()

    await expect(floor.claimHost('pty-1', 130, 60)).resolves.toBe(true)

    expect(applyLayout).not.toHaveBeenCalled()
  })
})
