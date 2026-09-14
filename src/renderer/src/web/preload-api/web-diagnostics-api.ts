import type { PreloadApi } from '../../../../preload/api-types'

export function createWebDiagnosticsApi(): Partial<PreloadApi> {
  return {
    diagnostics: {
      getStatus: () =>
        Promise.resolve({
          localFileEnabled: false,
          bundleEnabled: false,
          traceFilePath: '',
          traceFamilySize: 0
        }),
      collectBundle: () => Promise.reject(new Error('Review files are unavailable on web.')),
      openBundlePreview: () => Promise.reject(new Error('Review files are unavailable on web.')),
      discardBundlePreview: () => Promise.resolve()
    }
  }
}
