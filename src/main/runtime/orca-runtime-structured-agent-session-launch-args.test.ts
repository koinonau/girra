import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'

type InstalledDeps = {
  resolveLaunchArgs: (provider: 'claude') => Promise<string[]> | string[]
  resolveClaudeLaunchEnv?: () => Record<string, string>
}

const { installStructuredAgentSessionHost } = vi.hoisted(() => ({
  installStructuredAgentSessionHost: vi.fn(async (_deps: unknown) => ({}) as never)
}))

vi.mock('./structured-agent-session-runtime', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ensureStructuredAgentSessionHost: installStructuredAgentSessionHost
}))

function runtimeWith(settings: Record<string, unknown>): OrcaRuntimeService {
  return new OrcaRuntimeService({ getSettings: () => settings } as never)
}

async function installedDeps(settings: Record<string, unknown>): Promise<InstalledDeps> {
  installStructuredAgentSessionHost.mockClear()
  await runtimeWith(settings).ensureStructuredAgentSessionHost()
  return installStructuredAgentSessionHost.mock.calls[0]?.[0] as InstalledDeps
}

describe('structured agent-session launch args wiring', () => {
  it('resolves Claude launch args from the Claude agent defaults only', async () => {
    const deps = await installedDeps({
      agentDefaultArgs: {
        claude: '--dangerously-skip-permissions --model opus',
        opencode: '--not-a-claude-flag'
      },
      agentDefaultEnv: {}
    })

    expect(await deps.resolveLaunchArgs('claude')).toEqual([
      '--dangerously-skip-permissions',
      '--model',
      'opus'
    ])
  })

  it('supplies the Claude env overlay so the launch resolver does not fall back to process.env', async () => {
    const deps = await installedDeps({
      agentDefaultArgs: {},
      agentDefaultEnv: {
        claude: { GIRRA_CLAUDE_OVERLAY: 'claude-value' },
        opencode: { GIRRA_OPENCODE_OVERLAY: 'opencode-value' }
      }
    })

    expect(deps.resolveClaudeLaunchEnv).toBeTypeOf('function')
    expect(deps.resolveClaudeLaunchEnv?.()).toMatchObject({
      GIRRA_CLAUDE_OVERLAY: 'claude-value'
    })
    expect(deps.resolveClaudeLaunchEnv?.()).not.toHaveProperty('GIRRA_OPENCODE_OVERLAY')
  })
})
