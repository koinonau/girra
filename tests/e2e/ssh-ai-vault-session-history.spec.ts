import type { Page, TestInfo } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  cleanupDockerSshRelayTarget,
  DOCKER_SSH_RELAY_REMOTE_REPO_PATH,
  execDockerSshRelayTargetCommand,
  startDockerSshRelayTarget,
  writeDockerSshRelayTargetFile,
  type DockerSshRelayTarget
} from './helpers/docker-ssh-relay-target'
import { connectDockerSshRelayTarget } from './helpers/docker-ssh-relay-connection'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

const RUN_DOCKER_SSH = process.env.GIRRA_E2E_SSH_DOCKER === '1'
const REMOTE_CLAUDE_PROJECT_DIR = '/root/.claude/projects/orca'

test.describe('SSH Agent Session History', () => {
  test.skip(!RUN_DOCKER_SSH, 'Set GIRRA_E2E_SSH_DOCKER=1 to run Docker-backed SSH tests.')
  test.skip(process.platform === 'win32', 'Docker SSH tests use POSIX ssh tooling.')

  test('shows remote session history only for the SSH host and resumes Claude on that worktree', async ({
    orcaPage
  }, testInfo: TestInfo) => {
    test.slow()
    let target: DockerSshRelayTarget | null = null
    const stamp = Date.now()
    const defaultSessionId = `remote-ai-vault-${stamp}`
    const secondSessionId = `remote-ai-vault-second-${stamp}`
    const defaultTitle = `Remote AI Vault ${stamp}`
    const secondTitle = `Remote Second AI Vault ${stamp}`

    try {
      target = startDockerSshRelayTarget(testInfo)
      seedRemoteAiVaultHistory(target, {
        defaultSessionId,
        secondSessionId,
        defaultTitle,
        secondTitle
      })

      await waitForSessionReady(orcaPage)
      await waitForActiveWorktree(orcaPage)
      const remote = await connectDockerSshRelayTarget(orcaPage, target)
      const sshScope = `ssh:${encodeURIComponent(remote.targetId)}` as const

      const scan = await orcaPage.evaluate(
        async ({ sshScope, defaultTitle, secondTitle }) => {
          const local = await window.api.aiVault.listSessions({
            executionHostScope: 'local',
            force: true
          })
          const ssh = await window.api.aiVault.listSessions({
            executionHostScope: sshScope,
            force: true
          })
          const all = await window.api.aiVault.listSessions({
            executionHostScope: 'all',
            force: true
          })
          return {
            localHasRemote: local.sessions.some((session) => session.title === defaultTitle),
            sshTitles: ssh.sessions.map((session) => session.title),
            allHasSecond: all.sessions.some((session) => session.title === secondTitle),
            remoteHostIds: ssh.sessions
              .filter((session) => [defaultTitle, secondTitle].includes(session.title))
              .map((session) => session.executionHostId),
            remoteCommands: ssh.sessions
              .filter((session) => session.title === defaultTitle || session.title === secondTitle)
              .map((session) => session.resumeCommand)
          }
        },
        { sshScope, defaultTitle, secondTitle }
      )
      expect(scan.localHasRemote).toBe(false)
      expect(scan.sshTitles).toEqual(expect.arrayContaining([defaultTitle, secondTitle]))
      expect(scan.allHasSecond).toBe(true)
      expect(new Set(scan.remoteHostIds)).toEqual(new Set([sshScope]))
      expect(scan.remoteCommands.join('\n')).toContain(`claude --resume '${defaultSessionId}'`)
      expect(scan.remoteCommands.join('\n')).toContain(`claude --resume '${secondSessionId}'`)

      const defaultSessionTitle = orcaPage.getByText(defaultTitle, { exact: true })
      const secondSessionTitle = orcaPage.getByText(secondTitle, { exact: true })

      await openAiVaultSidebar(orcaPage)
      await expect(defaultSessionTitle.first()).toBeVisible({ timeout: 30_000 })

      const hostButton = orcaPage.getByRole('button', { name: /Session History host:/ })
      await hostButton.click()
      await orcaPage.getByRole('menuitemradio', { name: /Local/ }).click()
      await expect(defaultSessionTitle).toHaveCount(0, { timeout: 30_000 })

      await hostButton.click()
      await orcaPage.getByRole('menuitemradio', { name: 'All hosts' }).click()
      await expect(secondSessionTitle.first()).toBeVisible({ timeout: 30_000 })

      await hostButton.click()
      await orcaPage
        .getByRole('menuitemradio')
        .filter({ hasNotText: /Local|All hosts/ })
        .click()
      await expect(defaultSessionTitle.first()).toBeVisible({ timeout: 30_000 })

      await installStartupQueueProbe(orcaPage)
      await defaultSessionTitle.first().click()
      await orcaPage.getByText('Resume in Worktree', { exact: true }).click()

      await expect
        .poll(() => readLastQueuedStartupCommand(orcaPage), { timeout: 30_000 })
        .toContain(`claude --resume '${defaultSessionId}'`)
      const queuedWorktreeId = await readLastQueuedStartupWorktreeId(orcaPage)
      expect(queuedWorktreeId).toBe(remote.worktreeId)
    } finally {
      cleanupDockerSshRelayTarget(target)
    }
  })
})

function seedRemoteAiVaultHistory(
  target: DockerSshRelayTarget,
  args: {
    defaultSessionId: string
    secondSessionId: string
    defaultTitle: string
    secondTitle: string
  }
): void {
  execDockerSshRelayTargetCommand(target, `mkdir -p ${REMOTE_CLAUDE_PROJECT_DIR}`)
  writeDockerSshRelayTargetFile(
    target,
    `${REMOTE_CLAUDE_PROJECT_DIR}/${args.defaultSessionId}.jsonl`,
    claudeTranscript({
      sessionId: args.defaultSessionId,
      title: args.defaultTitle,
      timestamp: '2026-07-04T01:00:00.000Z'
    })
  )
  writeDockerSshRelayTargetFile(
    target,
    `${REMOTE_CLAUDE_PROJECT_DIR}/${args.secondSessionId}.jsonl`,
    claudeTranscript({
      sessionId: args.secondSessionId,
      title: args.secondTitle,
      timestamp: '2026-07-04T02:00:00.000Z'
    })
  )
}

function jsonLines(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n')
}

function claudeTranscript(args: { sessionId: string; title: string; timestamp: string }): string {
  return jsonLines([
    {
      sessionId: args.sessionId,
      cwd: DOCKER_SSH_RELAY_REMOTE_REPO_PATH,
      timestamp: args.timestamp,
      type: 'user',
      message: { content: [{ type: 'text', text: args.title }] }
    },
    {
      sessionId: args.sessionId,
      cwd: DOCKER_SSH_RELAY_REMOTE_REPO_PATH,
      timestamp: args.timestamp.replace(':00.000Z', ':01.000Z'),
      type: 'assistant',
      message: { model: 'claude-opus-4', content: 'Remote session acknowledged.' }
    }
  ])
}

async function openAiVaultSidebar(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    store.getState().setRightSidebarOpen(true)
    store.getState().setRightSidebarTab('vault')
  })
}

async function installStartupQueueProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    const holder = window as unknown as {
      __aiVaultQueuedStartups?: { tabId: string; startup: { command: string } }[]
    }
    holder.__aiVaultQueuedStartups = []
    const current = store.getState()
    const original = current.queueTabStartupCommand
    store.setState({
      queueTabStartupCommand: (tabId, startup) => {
        holder.__aiVaultQueuedStartups?.push({ tabId, startup: { command: startup.command } })
        original(tabId, startup)
      }
    })
  })
}

async function readLastQueuedStartupCommand(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const holder = window as unknown as {
      __aiVaultQueuedStartups?: { startup: { command: string } }[]
    }
    return holder.__aiVaultQueuedStartups?.at(-1)?.startup.command ?? null
  })
}

async function readLastQueuedStartupWorktreeId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const holder = window as unknown as {
      __aiVaultQueuedStartups?: { tabId: string }[]
    }
    const tabId = holder.__aiVaultQueuedStartups?.at(-1)?.tabId
    if (!tabId) {
      return null
    }
    const state = window.__store?.getState()
    if (!state) {
      return null
    }
    for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
      if (tabs.some((tab) => tab.id === tabId)) {
        return worktreeId
      }
    }
    return null
  })
}
