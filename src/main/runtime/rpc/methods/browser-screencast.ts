import { defineMethod, defineStreamingMethod } from '../core'
import { Screencast } from './browser-schemas'
import { BrowserError } from '../../../browser/browser-error'
import { BROWSER_UNAVAILABLE_ERROR_CODE } from '../../../../shared/runtime-types'
import { runtimeBrowserCommandsFactoryIsAvailable } from '../../runtime-browser-commands-factory'
import { ScreencastUnsubscribe } from '../../../../shared/rpc-contract/browser-screencast-params'

export const BROWSER_SCREENCAST_METHODS = [
  defineStreamingMethod({
    name: 'browser.screencast',
    params: Screencast,
    handler: async (params, { runtime, connectionId, pairedDeviceId, sendBinary, signal }, emit) =>
      runtime.browserScreencast(params, {
        connectionId,
        pairedDeviceId,
        sendBinary,
        signal,
        emit
      })
  }),
  defineMethod({
    name: 'browser.screencast.unsubscribe',
    params: ScreencastUnsubscribe,
    handler: async (params, { runtime }) => {
      if (!runtimeBrowserCommandsFactoryIsAvailable()) {
        throw new BrowserError(
          BROWSER_UNAVAILABLE_ERROR_CODE,
          'Browser automation is unavailable on this host.'
        )
      }
      runtime.cleanupSubscription(params.subscriptionId)
      return { unsubscribed: true }
    }
  })
]
