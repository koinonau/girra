import { defineMethod } from '../core'

export const STATUS_METHODS = [
  defineMethod({
    name: 'status.get',
    params: null,
    handler: (_params, { runtime, pairedDeviceId }) => {
      return {
        ...runtime.getStatus(),
        ...(pairedDeviceId ? { pairedDeviceId } : {}),
        ...(process.env.ORCA_APP_VERSION ? { appVersion: process.env.ORCA_APP_VERSION } : {})
      }
    }
  })
]
