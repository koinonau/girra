import { defineMethod } from '../core'
import { saveClipboardImageBufferAsTempFile } from '../../../window/clipboard-image-temp-file'
import { randomUUID } from 'node:crypto'
import {
  AbortImageUpload,
  AppendImageUploadChunk,
  CommitImageUpload,
  SaveImageAsTempFile,
  StartImageUpload,
  isValidBase64
} from '../../../../shared/rpc-contract/clipboard-params'
export { CLIPBOARD_IMAGE_UPLOAD_CHUNK_BASE64_CHARS } from '../../../../shared/rpc-contract/clipboard-params'
export const CLIPBOARD_IMAGE_UPLOAD_MAX_CONCURRENT = 8
const CLIPBOARD_IMAGE_UPLOAD_TTL_MS = 5 * 60 * 1000

type ClipboardImageUpload = {
  expectedBase64Length: number
  connectionId?: string | null
  chunks: string[]
  receivedBase64Length: number
  expiresAt: number
  ttlTimer: ReturnType<typeof setTimeout>
}

const clipboardImageUploads = new Map<string, ClipboardImageUpload>()

function pruneExpiredUploads(now = Date.now()): void {
  for (const [uploadId, upload] of clipboardImageUploads) {
    if (upload.expiresAt <= now) {
      deleteUpload(uploadId)
    }
  }
}

function scheduleUploadExpiry(uploadId: string): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => {
    clipboardImageUploads.delete(uploadId)
  }, CLIPBOARD_IMAGE_UPLOAD_TTL_MS)
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref()
  }
  return timer
}

function refreshUploadExpiry(uploadId: string, upload: ClipboardImageUpload): void {
  clearTimeout(upload.ttlTimer)
  upload.expiresAt = Date.now() + CLIPBOARD_IMAGE_UPLOAD_TTL_MS
  upload.ttlTimer = scheduleUploadExpiry(uploadId)
}

function deleteUpload(uploadId: string): void {
  const upload = clipboardImageUploads.get(uploadId)
  if (upload) {
    clearTimeout(upload.ttlTimer)
  }
  clipboardImageUploads.delete(uploadId)
}

function getUpload(uploadId: string): ClipboardImageUpload {
  pruneExpiredUploads()
  const upload = clipboardImageUploads.get(uploadId)
  if (!upload) {
    throw new Error('Clipboard image upload was not found')
  }
  return upload
}

function assertValidBase64Content(value: string): void {
  if (!isValidBase64(value)) {
    throw new Error('Clipboard image content must be base64')
  }
}

export const CLIPBOARD_METHODS = [
  defineMethod({
    name: 'clipboard.saveImageAsTempFile',
    params: SaveImageAsTempFile,
    handler: async (params) =>
      saveClipboardImageBufferAsTempFile(Buffer.from(params.contentBase64, 'base64'), {
        connectionId: params.connectionId
      })
  }),
  defineMethod({
    name: 'clipboard.startImageUpload',
    params: StartImageUpload,
    handler: (params) => {
      pruneExpiredUploads()
      if (clipboardImageUploads.size >= CLIPBOARD_IMAGE_UPLOAD_MAX_CONCURRENT) {
        throw new Error('Too many clipboard image uploads are in progress')
      }
      const uploadId = randomUUID()
      clipboardImageUploads.set(uploadId, {
        expectedBase64Length: params.expectedBase64Length,
        connectionId: params.connectionId,
        chunks: [],
        receivedBase64Length: 0,
        expiresAt: Date.now() + CLIPBOARD_IMAGE_UPLOAD_TTL_MS,
        ttlTimer: scheduleUploadExpiry(uploadId)
      })
      return { uploadId }
    }
  }),
  defineMethod({
    name: 'clipboard.appendImageUploadChunk',
    params: AppendImageUploadChunk,
    handler: (params) => {
      const upload = getUpload(params.uploadId)
      if (params.offset !== upload.receivedBase64Length) {
        throw new Error('Clipboard image chunk offset is out of order')
      }
      const nextLength = upload.receivedBase64Length + params.contentBase64.length
      if (nextLength > upload.expectedBase64Length) {
        throw new Error('Clipboard image upload exceeded expected size')
      }
      upload.chunks.push(params.contentBase64)
      upload.receivedBase64Length = nextLength
      refreshUploadExpiry(params.uploadId, upload)
      return { receivedBase64Length: upload.receivedBase64Length }
    }
  }),
  defineMethod({
    name: 'clipboard.commitImageUpload',
    params: CommitImageUpload,
    handler: async (params) => {
      const upload = getUpload(params.uploadId)
      try {
        if (upload.receivedBase64Length !== upload.expectedBase64Length) {
          throw new Error('Clipboard image upload is incomplete')
        }
        const contentBase64 = upload.chunks.join('')
        assertValidBase64Content(contentBase64)
        return await saveClipboardImageBufferAsTempFile(Buffer.from(contentBase64, 'base64'), {
          connectionId: upload.connectionId
        })
      } finally {
        // Why: failed SSH or filesystem commits must not leave bounded upload
        // memory pinned until TTL cleanup.
        deleteUpload(params.uploadId)
      }
    }
  }),
  defineMethod({
    name: 'clipboard.abortImageUpload',
    params: AbortImageUpload,
    handler: (params) => {
      pruneExpiredUploads()
      deleteUpload(params.uploadId)
      return { aborted: true }
    }
  })
]

export function resetClipboardImageUploadsForTest(): void {
  for (const uploadId of clipboardImageUploads.keys()) {
    deleteUpload(uploadId)
  }
}
