import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('main-process fatal error guards (issue #9441)', () => {
  it('logs unhandled rejections and keeps the process alive', async () => {
    vi.resetModules()
    const { installUnhandledRejectionLogging } = await import('./main-process-error-guards')
    const before = process.listeners('unhandledRejection').length
    installUnhandledRejectionLogging()
    const listeners = process.listeners('unhandledRejection')
    expect(listeners.length).toBe(before + 1)
    const listener = listeners.at(-1) as (reason: unknown, promise: Promise<unknown>) => void
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      // Why: invoking the listener directly must not throw — a throwing handler would still kill main.
      expect(() =>
        listener(Object.assign(new Error('spawn EAGAIN'), { code: 'EAGAIN' }), Promise.resolve())
      ).not.toThrow()
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringMatching(/^\[main_unhandled_rejection\][\s\S]*spawn EAGAIN/)
      )
    } finally {
      process.removeListener('unhandledRejection', listener as never)
    }
  })

  it('never throws when the console sink fails', async () => {
    vi.resetModules()
    const { recordFatalMainProcessError } = await import('./main-process-error-guards')
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('sink offline')
    })

    expect(() =>
      recordFatalMainProcessError('main_uncaught_exception', 'not-an-error')
    ).not.toThrow()
  })

  it('bounds and isolates console formatting for hostile rejection values', async () => {
    vi.resetModules()
    const { recordFatalMainProcessError } = await import('./main-process-error-guards')
    const hostileReason = {
      toString(): never {
        throw new Error('toString failed')
      },
      [Symbol.for('nodejs.util.inspect.custom')](): never {
        throw new Error('inspect failed')
      }
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
      if (values.some((value) => typeof value !== 'string')) {
        throw new Error('unsafe console formatting')
      }
    })

    expect(() =>
      recordFatalMainProcessError('main_unhandled_rejection', hostileReason)
    ).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith(
      '[main_unhandled_rejection] object: [unprintable value]'
    )
  })

  it('caps oversized rejection diagnostics before logging', async () => {
    vi.resetModules()
    const { recordFatalMainProcessError } = await import('./main-process-error-guards')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new Error('m'.repeat(100_000)), { code: 'c'.repeat(100_000) })
    error.name = 'n'.repeat(100_000)
    error.stack = Array.from({ length: 100 }, () => 's'.repeat(1_000)).join('\n')

    recordFatalMainProcessError('main_unhandled_rejection', error)

    expect(String(consoleError.mock.calls[0]?.[0]).length).toBeLessThan(5_000)
  })

  it('caps a rejection storm and reopens in the next window', async () => {
    vi.resetModules()
    const { recordFatalMainProcessError } = await import('./main-process-error-guards')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    for (let i = 0; i < 25; i++) {
      recordFatalMainProcessError('main_unhandled_rejection', new Error(`storm ${i}`))
    }
    expect(consoleError).toHaveBeenCalledTimes(20)

    now += 60_000
    recordFatalMainProcessError('main_unhandled_rejection', new Error('after window'))
    expect(consoleError).toHaveBeenCalledTimes(21)
  })

  it('reopens the window when the wall clock jumps backwards after exhaustion', async () => {
    vi.resetModules()
    const { recordFatalMainProcessError } = await import('./main-process-error-guards')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    for (let i = 0; i < 25; i++) {
      recordFatalMainProcessError('main_unhandled_rejection', new Error(`storm ${i}`))
    }
    expect(consoleError).toHaveBeenCalledTimes(20)

    // Why: a backward jump must not trap the exhausted window and suppress every later record.
    now -= 3_600_000
    recordFatalMainProcessError('main_unhandled_rejection', new Error('after backward jump'))
    expect(consoleError).toHaveBeenCalledTimes(21)
  })

  it('never suppresses the fatal uncaught-exception record after a rejection storm', async () => {
    vi.resetModules()
    const { recordFatalMainProcessError } = await import('./main-process-error-guards')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    for (let i = 0; i < 25; i++) {
      recordFatalMainProcessError('main_unhandled_rejection', new Error(`storm ${i}`))
    }
    expect(consoleError).toHaveBeenCalledTimes(20)

    // Why: this record precedes the re-throw that kills main; losing it would recreate issue #9441.
    recordFatalMainProcessError('main_uncaught_exception', new Error('fatal after storm'))
    expect(consoleError).toHaveBeenCalledTimes(21)
    expect(consoleError).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\[main_uncaught_exception\][\s\S]*fatal after storm/)
    )
  })

  it('keeps uncaught pipe errors swallowed without a record', async () => {
    vi.resetModules()
    const { installUncaughtPipeErrorGuard } = await import('./main-process-error-guards')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = process.listeners('uncaughtException').length
    installUncaughtPipeErrorGuard()
    const listeners = process.listeners('uncaughtException')
    expect(listeners.length).toBe(before + 1)
    const listener = listeners.at(-1) as (error: unknown) => void
    try {
      listener(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
    } finally {
      process.removeListener('uncaughtException', listener as never)
    }
    // Why: EPIPE/EIO are expected pipe churn; logging them would flood the log.
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('rethrows non-pipe errors outside the uncaughtException handler', async () => {
    vi.resetModules()
    const { installUncaughtPipeErrorGuard } = await import('./main-process-error-guards')
    const originalOn = process.on.bind(process)
    const originalOff = process.off.bind(process)
    let handler: ((error: unknown) => void) | null = null
    let scheduled: (() => void) | null = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'on').mockImplementation(((event, listener) => {
      if (event === 'uncaughtException') {
        handler = listener as (error: unknown) => void
        return process
      }
      return originalOn(event, listener)
    }) as typeof process.on)
    const offSpy = vi.spyOn(process, 'off').mockImplementation(((event, listener) => {
      if (event === 'uncaughtException') {
        return process
      }
      return originalOff(event, listener)
    }) as typeof process.off)
    vi.spyOn(globalThis, 'setImmediate').mockImplementation(((callback) => {
      scheduled = callback as () => void
      return {} as NodeJS.Immediate
    }) as typeof setImmediate)

    installUncaughtPipeErrorGuard()

    const error = new Error('boom')
    expect(() => handler?.(error)).not.toThrow()
    expect(offSpy).toHaveBeenCalledWith('uncaughtException', handler)
    expect(scheduled).not.toBeNull()
    expect(() => scheduled?.()).toThrow(error)
  })
})
