import { expect, type ElectronApplication } from '@stablyai/playwright-test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  isAgentHookEndpointFileName,
  parseAgentHookEndpointFile,
  type AgentHookEndpoint
} from '../../../src/shared/agent-hook-endpoint-file'

function findEndpointEnvFile(root: string): string | null {
  if (!existsSync(root)) {
    return null
  }
  const entries = readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isFile() && isAgentHookEndpointFileName(entry.name)) {
      return fullPath
    }
    if (entry.isDirectory()) {
      const nested = findEndpointEnvFile(fullPath)
      if (nested) {
        return nested
      }
    }
  }
  return null
}

export async function readHookEndpoint(app: ElectronApplication): Promise<AgentHookEndpoint> {
  const userDataPath = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
  const hookRoot = path.join(userDataPath, 'agent-hooks')
  let endpointPath: string | null = null
  await expect
    .poll(
      () => {
        endpointPath = findEndpointEnvFile(hookRoot)
        return endpointPath
      },
      {
        timeout: 15_000,
        message: `Agent hook endpoint file not found under ${hookRoot}`
      }
    )
    .not.toBeNull()
  if (!endpointPath) {
    throw new Error(`Agent hook endpoint file not found under ${hookRoot}`)
  }
  return parseAgentHookEndpointFile(readFileSync(endpointPath, 'utf8'))
}
