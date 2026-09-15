import { publicKeyFromBase64 } from './e2ee-crypto'
import { parseRemoteRuntimeJsonText } from '../../../shared/remote-runtime-request-frames'

export type MobileE2EEAuth = {
  type: 'e2ee_auth'
  deviceToken: string
  clientCapabilities?: unknown
  // Why: fields of the retired version 2 handshake; their presence marks an invalid auth.
  v?: unknown
  transcriptHashB64?: unknown
}

export function authenticateMobileE2EE<TDevice extends { deviceToken: string }>(args: {
  plaintext: string
  resolveDevice: (token: string) => TDevice | null
}):
  | { ok: true; device: TDevice; auth: MobileE2EEAuth }
  | { ok: false; code: 'bad_auth' | 'unauthorized' } {
  let auth: MobileE2EEAuth
  try {
    auth = parseRemoteRuntimeJsonText(args.plaintext) as MobileE2EEAuth
  } catch {
    return { ok: false, code: 'bad_auth' }
  }
  if (
    auth.type !== 'e2ee_auth' ||
    !auth.deviceToken ||
    auth.v !== undefined ||
    auth.transcriptHashB64 !== undefined
  ) {
    return { ok: false, code: 'bad_auth' }
  }
  const device = args.resolveDevice(auth.deviceToken)
  return device?.deviceToken === auth.deviceToken
    ? { ok: true, device, auth }
    : { ok: false, code: 'unauthorized' }
}

export function decodeMobileE2EEPublicKey(value: string): Uint8Array | null {
  try {
    return publicKeyFromBase64(value)
  } catch {
    return null
  }
}
