import { describe, expect, it, vi } from 'vitest'
import { remoteRpcContentBudget } from '../../../../shared/remote-rpc-content-budget'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import { FILE_METHODS } from './files'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

describe('file preview RPC transport budgets', () => {
  it('charges the request id to the preview content budget', async () => {
    const readFileExplorerPreview = vi.fn().mockResolvedValue({
      content: 'base64',
      isBinary: true,
      isImage: true,
      mimeType: 'image/png'
    })
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      readFileExplorerPreview
    } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: FILE_METHODS })
    const id = ''.repeat(8_192)

    await dispatcher.dispatchStreaming(
      {
        ...makeRequest('files.readPreview', { worktree: 'id:wt-1', relativePath: 'logo.png' }),
        id
      },
      vi.fn(),
      { clientKind: 'runtime' }
    )

    expect(readFileExplorerPreview).toHaveBeenCalledWith(
      'id:wt-1',
      'logo.png',
      remoteRpcContentBudget(id)
    )
  })
})
