import type { ExpectedTeardownScope } from './process-gone-classification'

let systemSessionEnded = false

export function markSystemSessionEnding(): void {
  systemSessionEnded = true
}

// Why latched: a native dialog or a recovery verdict is never right once the OS is tearing the
// session down, however long the process outlives the signal.
export function isSystemSessionEnding(): boolean {
  return systemSessionEnded
}

export function resolveExpectedTeardownScope({
  isQuitting,
  isExpectedRendererReload
}: {
  isQuitting: boolean
  isExpectedRendererReload: boolean
}): ExpectedTeardownScope {
  if (isQuitting) {
    return 'app-shutdown'
  }
  return isExpectedRendererReload ? 'renderer-reload' : 'none'
}

export function resetExpectedTeardownStateForTest(): void {
  systemSessionEnded = false
}
