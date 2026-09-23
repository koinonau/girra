// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GIRRA_APP_RESTART_ABORTED_EVENT,
  GIRRA_APP_RESTART_STARTED_EVENT
} from '../../../shared/app-restart-events'
import {
  GIRRA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT,
  GIRRA_RENDERER_UNLOAD_PREVENTED_EVENT
} from '../../../shared/renderer-shutdown-events'
import { prepareRendererForAppRestart } from '../../../shared/renderer-restart-preparation'
import {
  createShutdownCheckpointBeforeUnloadHandler,
  createShutdownCheckpointGuard
} from '../lib/shutdown-checkpoint-guard'
import {
  isIntentionalAppRestartInProgress,
  registerAppRestartBeforeUnloadBypass
} from '../lib/app-restart-beforeunload'
import {
  createShutdownCheckpointPersist,
  type ShutdownCheckpointPersistDeps
} from './shutdown-checkpoint-persist'

type LifecycleHarness = {
  cleanup: () => void
  prepare: () => Promise<void>
  stageBeforeUnloadSync: ReturnType<typeof vi.fn>
}

type LifecycleHarnessOverrides = Partial<
  Pick<ShutdownCheckpointPersistDeps, 'buildSessionSnapshots' | 'hasDirtyOpenFiles'>
>

function createLifecycleHarness(
  startedEventName: string,
  abortedEventName: string,
  overrides: LifecycleHarnessOverrides = {}
): LifecycleHarness {
  const stageBeforeUnloadSync = vi.fn((args: { sessions: unknown[] }) => {
    if (args.sessions.length > 0) {
      throw new Error('deterministic full-stage failure')
    }
  })
  const persist = createShutdownCheckpointPersist({
    shouldCaptureSession: () => true,
    captureTerminalBuffers: vi.fn(),
    captureSleepingAgentSessions: vi.fn(),
    buildSessionSnapshots: () => [{ state: { activeTabId: 't1' } }] as never,
    buildUiPatch: () => ({ activeView: 'workspace' }) as never,
    hasDirtyOpenFiles: () => false,
    isDegradableShutdownInProgress: isIntentionalAppRestartInProgress,
    stageBeforeUnloadSync,
    ...overrides
  })
  const guard = createShutdownCheckpointGuard(persist.run, persist.abandonAttempt)
  const checkpoint = createShutdownCheckpointBeforeUnloadHandler(guard)
  const cleanupRestartTracking = registerAppRestartBeforeUnloadBypass()
  window.addEventListener('beforeunload', checkpoint)
  window.addEventListener(
    GIRRA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT,
    guard.abortAfterCheckpointFailure
  )
  window.addEventListener(abortedEventName, guard.abandonAttempt)
  window.addEventListener(GIRRA_RENDERER_UNLOAD_PREVENTED_EVENT, guard.abandonAttempt)
  return {
    stageBeforeUnloadSync,
    prepare: () =>
      prepareRendererForAppRestart(window, {
        startedEventName,
        abortedEventName,
        awaitCheckpoint: () => Promise.resolve()
      }),
    cleanup: () => {
      cleanupRestartTracking()
      window.removeEventListener('beforeunload', checkpoint)
      window.removeEventListener(
        GIRRA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT,
        guard.abortAfterCheckpointFailure
      )
      window.removeEventListener(abortedEventName, guard.abandonAttempt)
      window.removeEventListener(GIRRA_RENDERER_UNLOAD_PREVENTED_EVENT, guard.abandonAttempt)
    }
  }
}

describe('shutdown checkpoint restart lifecycle', () => {
  const cleanupFns: (() => void)[] = []

  afterEach(() => {
    cleanupFns.splice(0).forEach((cleanup) => cleanup())
    vi.restoreAllMocks()
  })

  it.each([
    {
      lifecycle: 'app restart',
      startedEventName: GIRRA_APP_RESTART_STARTED_EVENT,
      abortedEventName: GIRRA_APP_RESTART_ABORTED_EVENT
    }
  ])(
    'preserves retry-then-degrade across a checkpoint-caused $lifecycle abort',
    async ({ startedEventName, abortedEventName }) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const harness = createLifecycleHarness(startedEventName, abortedEventName)
      cleanupFns.push(harness.cleanup)

      await expect(harness.prepare()).rejects.toThrow('deterministic full-stage failure')
      expect(isIntentionalAppRestartInProgress()).toBe(false)
      await expect(harness.prepare()).resolves.toBeUndefined()

      expect(harness.stageBeforeUnloadSync).toHaveBeenCalledTimes(3)
      expect(harness.stageBeforeUnloadSync).toHaveBeenLastCalledWith({
        sessions: [],
        ui: { activeView: 'workspace' }
      })
    }
  )

  it('abandons retry state when a later restart attempt is independently canceled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createLifecycleHarness(
      GIRRA_APP_RESTART_STARTED_EVENT,
      GIRRA_APP_RESTART_ABORTED_EVENT
    )
    cleanupFns.push(harness.cleanup)

    await expect(harness.prepare()).rejects.toThrow('deterministic full-stage failure')
    window.dispatchEvent(new Event(GIRRA_APP_RESTART_STARTED_EVENT))
    window.dispatchEvent(new Event(GIRRA_APP_RESTART_ABORTED_EVENT))
    await expect(harness.prepare()).rejects.toThrow('deterministic full-stage failure')

    expect(harness.stageBeforeUnloadSync).toHaveBeenCalledTimes(2)
  })

  it('names the snapshot-build cause when dirty drafts block the checkpoint', async () => {
    const snapshotFailure = "Cannot read properties of null (reading 'toLowerCase')"
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createLifecycleHarness(
      GIRRA_APP_RESTART_STARTED_EVENT,
      GIRRA_APP_RESTART_ABORTED_EVENT,
      {
        buildSessionSnapshots: () => {
          throw new Error(snapshotFailure)
        },
        hasDirtyOpenFiles: () => true
      }
    )
    cleanupFns.push(harness.cleanup)

    await expect(harness.prepare()).rejects.toThrow(
      new Error(`Renderer shutdown checkpoint was not completed: ${snapshotFailure}`)
    )
    // Dirty drafts must block before any durable-only degrade stages over them.
    expect(harness.stageBeforeUnloadSync).not.toHaveBeenCalled()
  })
})
