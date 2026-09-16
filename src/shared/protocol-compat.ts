// Why: pure compat evaluators shared by the main process, renderer and CLI; version numbers are passed in.

export type RuntimeCompatVerdict =
  | {
      kind: 'ok'
      clientProtocolVersion: number
      serverProtocolVersion: number
    }
  | {
      kind: 'blocked'
      reason: 'client-too-old' | 'server-too-old'
      clientProtocolVersion: number
      serverProtocolVersion: number
      requiredClientProtocolVersion?: number
      requiredServerProtocolVersion?: number
    }

export function evaluateRuntimeCompat(input: {
  clientProtocolVersion: number
  minCompatibleServerProtocolVersion: number
  serverProtocolVersion: number | undefined
  serverMinCompatibleClientProtocolVersion: number | undefined
}): RuntimeCompatVerdict {
  // Why: absent fields are protocol 0. New clients can give old servers a
  // clear "update server" error instead of attempting partially-supported RPCs.
  const serverProtocolVersion = input.serverProtocolVersion ?? 0
  const requiredClientProtocolVersion = input.serverMinCompatibleClientProtocolVersion ?? 0

  if (input.clientProtocolVersion < requiredClientProtocolVersion) {
    return {
      kind: 'blocked',
      reason: 'client-too-old',
      clientProtocolVersion: input.clientProtocolVersion,
      serverProtocolVersion,
      requiredClientProtocolVersion
    }
  }
  if (serverProtocolVersion < input.minCompatibleServerProtocolVersion) {
    return {
      kind: 'blocked',
      reason: 'server-too-old',
      clientProtocolVersion: input.clientProtocolVersion,
      serverProtocolVersion,
      requiredServerProtocolVersion: input.minCompatibleServerProtocolVersion
    }
  }
  return {
    kind: 'ok',
    clientProtocolVersion: input.clientProtocolVersion,
    serverProtocolVersion
  }
}

export function describeRuntimeCompatBlock(verdict: RuntimeCompatVerdict): string {
  if (verdict.kind === 'ok') {
    return 'Runtime client and server are compatible.'
  }
  if (verdict.reason === 'client-too-old') {
    return `This Girra client is too old for the selected server. Update Girra on this machine. Client protocol ${verdict.clientProtocolVersion}, server requires client protocol ${verdict.requiredClientProtocolVersion}.`
  }
  return `The selected Girra server is too old for this client. Update Girra on the server. Server protocol ${verdict.serverProtocolVersion}, client requires server protocol ${verdict.requiredServerProtocolVersion}.`
}
