import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  testState,
  createStore,
  writeDataFile,
  readDataFile,
  makeRepo
} from './persistence-test-harness'

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  },
  safeStorage: {
    isEncryptionAvailable: () => false
  }
}))

async function seedAutomationWithRetiredAgent(): Promise<string> {
  const store = await createStore()
  store.addRepo(makeRepo())
  const automation = store.createAutomation({
    name: 'Nightly',
    prompt: 'Run checks',
    agentId: 'claude',
    projectId: 'r1',
    workspaceMode: 'new_per_run',
    timezone: 'UTC',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    dtstart: new Date('2026-05-13T00:00:00Z').getTime()
  })
  store.flush()
  const persisted = readDataFile() as { automations: Record<string, unknown>[] }
  persisted.automations[0].agentId = 'codex'
  writeDataFile(persisted)
  return automation.id
}

describe('automations whose agent was retired', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(() => {
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('load paused, keep their agent id, and persist the pause', async () => {
    const id = await seedAutomationWithRetiredAgent()

    const reloaded = await createStore()
    const automation = reloaded.listAutomations().find((entry) => entry.id === id)
    expect(automation).toMatchObject({ enabled: false, agentId: 'codex' })

    reloaded.flush()
    const persisted = readDataFile() as { automations: Record<string, unknown>[] }
    expect(persisted.automations[0]).toMatchObject({ enabled: false, agentId: 'codex' })
  })

  it('cannot be re-enabled until a supported agent is chosen', async () => {
    const id = await seedAutomationWithRetiredAgent()
    const store = await createStore()

    expect(() => store.updateAutomation(id, { enabled: true })).toThrow(
      'Agent "codex" is no longer available'
    )
    expect(store.updateAutomation(id, { name: 'Renamed' }).enabled).toBe(false)
    expect(store.updateAutomation(id, { enabled: true, agentId: 'pi' })).toMatchObject({
      enabled: true,
      agentId: 'pi'
    })
  })
})
