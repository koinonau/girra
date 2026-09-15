import { describe, expect, it } from 'vitest'
import { describeRuntimeCompatBlock, evaluateRuntimeCompat } from './protocol-compat'
import {
  MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION,
  MIN_COMPATIBLE_RUNTIME_SERVER_VERSION,
  RUNTIME_PROTOCOL_VERSION
} from './protocol-version'

describe('evaluateRuntimeCompat', () => {
  it('keeps the current client and current server self-compatible', () => {
    const verdict = evaluateRuntimeCompat({
      clientProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      minCompatibleServerProtocolVersion: MIN_COMPATIBLE_RUNTIME_SERVER_VERSION,
      serverProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      serverMinCompatibleClientProtocolVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
    })

    expect(verdict).toMatchObject({ kind: 'ok' })
  })

  it('allows client and server app versions to skew when protocol ranges overlap', () => {
    const verdict = evaluateRuntimeCompat({
      clientProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      minCompatibleServerProtocolVersion: MIN_COMPATIBLE_RUNTIME_SERVER_VERSION,
      serverProtocolVersion: RUNTIME_PROTOCOL_VERSION + 3,
      serverMinCompatibleClientProtocolVersion: RUNTIME_PROTOCOL_VERSION - 1
    })

    expect(verdict).toMatchObject({ kind: 'ok' })
  })

  it('blocks when the server requires a newer client protocol', () => {
    const verdict = evaluateRuntimeCompat({
      clientProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      minCompatibleServerProtocolVersion: MIN_COMPATIBLE_RUNTIME_SERVER_VERSION,
      serverProtocolVersion: RUNTIME_PROTOCOL_VERSION + 1,
      serverMinCompatibleClientProtocolVersion: RUNTIME_PROTOCOL_VERSION + 1
    })

    expect(verdict).toMatchObject({
      kind: 'blocked',
      reason: 'client-too-old',
      requiredClientProtocolVersion: RUNTIME_PROTOCOL_VERSION + 1
    })
    expect(describeRuntimeCompatBlock(verdict)).toContain('client is too old')
  })

  it('blocks when the server protocol is below the client minimum', () => {
    const verdict = evaluateRuntimeCompat({
      clientProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      minCompatibleServerProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      serverProtocolVersion: RUNTIME_PROTOCOL_VERSION - 1,
      serverMinCompatibleClientProtocolVersion: 0
    })

    expect(verdict).toMatchObject({
      kind: 'blocked',
      reason: 'server-too-old',
      requiredServerProtocolVersion: RUNTIME_PROTOCOL_VERSION
    })
    expect(describeRuntimeCompatBlock(verdict)).toContain('server is too old')
  })

  it('treats missing server fields as protocol 0', () => {
    const verdict = evaluateRuntimeCompat({
      clientProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      minCompatibleServerProtocolVersion: 1,
      serverProtocolVersion: undefined,
      serverMinCompatibleClientProtocolVersion: undefined
    })

    expect(verdict).toMatchObject({
      kind: 'blocked',
      reason: 'server-too-old',
      serverProtocolVersion: 0
    })
  })
})
