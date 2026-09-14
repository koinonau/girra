import { describe, expect, it, vi } from 'vitest'
import { registerSystemResumeBroadcast, SYSTEM_RESUMED_CHANNEL } from './system-resume-broadcast'
import { subscribeSystemPowerLifecycle } from './system-power-lifecycle'

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  powerMonitor: { on: vi.fn(), off: vi.fn() }
}))

type ResumeListener = () => void
type PowerLifecycleEvent = 'suspend' | 'resume'

function createResumeSource() {
  const listeners = new Map<PowerLifecycleEvent, ResumeListener>()
  const source = {
    on: vi.fn((event: PowerLifecycleEvent, callback: ResumeListener) => {
      listeners.set(event, callback)
    }),
    // Why: match on identity so detaching a different closure than the one
    // registered still leaves a live listener, as it would on real powerMonitor.
    off: vi.fn((event: PowerLifecycleEvent, callback: ResumeListener) => {
      if (listeners.get(event) === callback) {
        listeners.delete(event)
      }
    })
  }
  return {
    source,
    fireSuspend: () => listeners.get('suspend')?.(),
    fireResume: () => listeners.get('resume')?.()
  }
}

function createWindow(destroyed = false): {
  isDestroyed: () => boolean
  webContents: { send: ReturnType<typeof vi.fn<(channel: string) => void>> }
} {
  return {
    isDestroyed: () => destroyed,
    webContents: { send: vi.fn<(channel: string) => void>() }
  }
}

describe('registerSystemResumeBroadcast', () => {
  it('publishes suspend and resume to main-process lifecycle consumers', () => {
    const { source, fireSuspend, fireResume } = createResumeSource()
    const listener = { onSuspend: vi.fn(), onResume: vi.fn() }
    const unsubscribe = subscribeSystemPowerLifecycle(listener)
    listener.onResume.mockClear()
    const stopBroadcast = registerSystemResumeBroadcast({
      resumeSource: source,
      getWindows: () => []
    })

    fireSuspend()
    fireResume()
    unsubscribe()
    fireSuspend()
    fireResume()
    stopBroadcast()

    expect(listener.onSuspend).toHaveBeenCalledOnce()
    expect(listener.onResume).toHaveBeenCalledOnce()
  })

  it('broadcasts the resume channel to every live window', () => {
    const { source, fireResume } = createResumeSource()
    const liveWindow = createWindow()
    const destroyedWindow = createWindow(true)
    registerSystemResumeBroadcast({
      resumeSource: source,
      getWindows: () => [liveWindow, destroyedWindow]
    })

    fireResume()

    expect(liveWindow.webContents.send).toHaveBeenCalledWith(SYSTEM_RESUMED_CHANNEL)
    expect(destroyedWindow.webContents.send).not.toHaveBeenCalled()
  })

  it('stops broadcasting after unsubscribe', () => {
    const { source, fireResume } = createResumeSource()
    const window = createWindow()
    const unsubscribe = registerSystemResumeBroadcast({
      resumeSource: source,
      getWindows: () => [window]
    })

    unsubscribe()
    fireResume()

    // Why: detaching a different closure than the one registered leaks a real
    // powerMonitor listener, and for 'suspend' that leak is otherwise unobservable.
    expect(source.off.mock.calls).toEqual(source.on.mock.calls)
    expect(window.webContents.send).not.toHaveBeenCalled()
  })
})
