/** One live browser screencast subscription, tracked per browser page. */
export type BrowserScreencastSubscriber = {
  cancel: (emitEnd?: boolean) => void
  done: Promise<void>
  connectionKey: string
}
