import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { GlobalSettings } from '../shared/global-settings-types'
import type { PersistedState } from '../shared/persisted-state-types'
import { getDefaultPersistedState } from '../shared/constants'
import {
  testState,
  createStore,
  withPlatform,
  writeDataFile,
  readDataFile
} from './persistence-test-harness'

// Stub the ~/.ssh/config parser so the SSH-import test drives the real Store with deterministic hosts, not the operator's actual ~/.ssh/config.
const { loadUserSshConfigMock, sshConfigHostsToTargetsMock } = vi.hoisted(() => ({
  loadUserSshConfigMock: vi.fn(),
  sshConfigHostsToTargetsMock: vi.fn()
}))

vi.mock('./ssh/ssh-config-parser', () => ({
  loadUserSshConfig: loadUserSshConfigMock,
  sshConfigHostsToTargets: sshConfigHostsToTargetsMock
}))
vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`encrypted:${plaintext}`, 'utf-8'),
    decryptString: (ciphertext: Buffer) => {
      const decoded = ciphertext.toString('utf-8')
      if (!decoded.startsWith('encrypted:')) {
        throw new Error('invalid ciphertext')
      }
      return decoded.slice('encrypted:'.length)
    }
  }
}))

describe('Store', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(() => {
    rmSync(testState.dir, { recursive: true, force: true })
  })
  it('returns default settings when no data file exists', async () => {
    const store = await createStore()
    const settings = store.getSettings()
    expect(settings.branchPrefix).toBe('git-username')
    expect(settings.refreshLocalBaseRefOnWorktreeCreate).toBe(false)
    expect(settings.sourceControlGroupOrder).toBe('changes-first')
    expect(settings.theme).toBe('system')
    expect(settings.appIcon).toBe('classic')
    expect(settings.appFontFamily).toBe('Geist')
    expect(settings.editorAutoSave).toBe(false)
    expect(settings.editorAutoSaveDelayMs).toBe(1000)
    expect(settings.terminalFontSize).toBe(14)
    expect(settings.terminalFontWeight).toBe(500)
    expect(settings.terminalFontWeightBold).toBe(700)
    expect(settings.terminalScrollSensitivity).toBe(1.15)
    expect(settings.terminalFastScrollSensitivity).toBe(5)
    expect(settings.terminalTuiScrollSensitivity).toBe(1)
    expect(settings.localAccountRuntime).toBe('auto')
    expect(settings.localAccountRuntimeDefaultedToAutoForAllUsers).toBe(true)
    expect(settings.terminalTuiScrollSensitivityDefaultedToOne).toBe(true)
    expect(settings.terminalUseSeparateLightTheme).toBe(true)
    expect(settings.rightSidebarOpenByDefault).toBe(true)
    expect(settings.showTasksButton).toBe(true)
    expect(settings.showAutomationsButton).toBe(true)
    expect(settings.visibleTaskProviders).toEqual(['github', 'gitlab', 'linear', 'jira'])
    expect(settings.openInApplications).toEqual([
      { id: 'vscode', label: 'VS Code', command: 'code' }
    ])
    expect(settings.experimentalActivity).toBe(false)
    expect(settings.experimentalActivityDefaultedOffForAllUsers).toBe(true)
    expect(settings.experimentalTerminalAttention).toBe(false)
    expect(settings.experimentalNewWorktreeCardStyle).toBe(false)
    expect(settings.floatingTerminalEnabled).toBe(true)
    expect(settings.floatingTerminalDefaultedForAllUsers).toBe(true)
    expect(settings.notifications.customSoundPath).toBeNull()
    expect(settings.notifications.customSoundVolume).toBe(100)
    expect(settings.notifications.suppressWhenFocused).toBe(true)
  })

  it('repairs a persisted terminal line height outside xterm bounds', async () => {
    const persisted = getDefaultPersistedState(testState.dir)
    writeDataFile({
      ...persisted,
      settings: { ...persisted.settings, terminalLineHeight: 0.85 }
    })

    const store = await createStore()

    expect(store.getSettings().terminalLineHeight).toBe(1)
    store.flush()
    expect((readDataFile() as PersistedState).settings.terminalLineHeight).toBe(1)
  })

  it('returns default UI state when no data file exists', async () => {
    const store = await createStore()
    const ui = store.getUI()
    expect(ui.sidebarWidth).toBe(280)
    expect(ui.rightSidebarOpen).toBe(true)
    expect(ui.rightSidebarTab).toBe('explorer')
    expect(ui.groupBy).toBe('repo')
    expect(ui.lastActiveRepoId).toBeNull()
    expect(ui.setupGuideSidebarDismissed).toBe(false)
    expect(ui.setupGuideBrowserMilestoneMigrated).toBe(true)
    expect(ui.setupGuideBrowserMilestoneLegacyComplete).toBe(false)
    // Why: brand-new profiles never saw remaining-as-default.
    expect(ui.usagePercentageDisplayChangeNoticeDismissed).toBe(true)
  })

  it('surfaces the usage percentage display change notice for upgraded profiles', async () => {
    const persisted = getDefaultPersistedState(testState.dir)
    writeDataFile({
      ...persisted,
      onboarding: { closedAt: 1, outcome: 'completed' },
      ui: {
        ...persisted.ui,
        // Why: omit the notice key so load resolves eligibility for existing profiles.
        usagePercentageDisplayChangeNoticeDismissed: undefined
      }
    })

    const store = await createStore()

    expect(store.getUI().usagePercentageDisplayChangeNoticeDismissed).toBe(false)
  })

  it('keeps the usage percentage display change notice dismissed when remaining was chosen', async () => {
    const persisted = getDefaultPersistedState(testState.dir)
    writeDataFile({
      ...persisted,
      onboarding: { closedAt: 1, outcome: 'completed' },
      ui: {
        ...persisted.ui,
        usagePercentageDisplay: 'remaining',
        usagePercentageDisplayChangeNoticeDismissed: undefined
      }
    })

    const store = await createStore()

    expect(store.getUI().usagePercentageDisplayChangeNoticeDismissed).toBe(true)
  })

  it('defaults minimizeToTrayOnClose to false when unset', async () => {
    const store = await createStore()
    expect(store.getSettings().minimizeToTrayOnClose).toBe(false)
  })

  it('coerces loaded minimizeToTrayOnClose to false unless stored as true', async () => {
    writeDataFile({
      ...getDefaultPersistedState(testState.dir),
      settings: {
        minimizeToTrayOnClose: 'true' as unknown as boolean
      }
    })

    const store = await createStore()

    expect(store.getSettings().minimizeToTrayOnClose).toBe(false)
  })

  it('persists minimizeToTrayOnClose true/false round-trip', async () => {
    const store = await createStore()
    store.updateSettings({ minimizeToTrayOnClose: true })
    expect(store.getSettings().minimizeToTrayOnClose).toBe(true)
    store.flush()
    expect((readDataFile() as PersistedState).settings.minimizeToTrayOnClose).toBe(true)
    store.updateSettings({ minimizeToTrayOnClose: false })
    expect(store.getSettings().minimizeToTrayOnClose).toBe(false)
  })

  it('persists native chat session options with per-model isolation', async () => {
    const store = await createStore()
    store.updateSettings({
      nativeChatSessionOptions: {
        claude: {
          model: 'opus',
          valuesByModel: {
            opus: { effort: 'xhigh', fastMode: true },
            sonnet: { effort: 'medium' }
          }
        }
      }
    })
    store.flush()

    const reloaded = await createStore()
    expect(reloaded.getSettings().nativeChatSessionOptions?.claude).toEqual({
      model: 'opus',
      valuesByModel: {
        opus: { effort: 'xhigh', fastMode: true },
        sonnet: { effort: 'medium' }
      }
    })
  })

  it('coerces non-boolean minimizeToTrayOnClose payloads to a strict boolean', async () => {
    const store = await createStore()
    // Why: a renderer-supplied non-bool must never persist as truthy and later read as "tray-minimize on".
    store.updateSettings({ minimizeToTrayOnClose: 'true' as unknown as boolean })
    expect(store.getSettings().minimizeToTrayOnClose).toBe(false)
    store.updateSettings({ minimizeToTrayOnClose: 1 as unknown as boolean })
    expect(store.getSettings().minimizeToTrayOnClose).toBe(false)
    store.updateSettings({ minimizeToTrayOnClose: null as unknown as boolean })
    expect(store.getSettings().minimizeToTrayOnClose).toBe(false)
  })

  it('defaults the menu bar icon on regardless of platform', async () => {
    await withPlatform('darwin', async () => {
      const store = await createStore()
      expect(store.getSettings().showMenuBarIcon).toBe(true)
    })

    await withPlatform('linux', async () => {
      const store = await createStore()
      expect(store.getSettings().showMenuBarIcon).toBe(true)
    })
  })

  it('enables the menu bar icon when an existing macOS profile has no stored value', async () => {
    await withPlatform('darwin', async () => {
      const persisted = getDefaultPersistedState(testState.dir)
      delete (persisted.settings as Partial<GlobalSettings>).showMenuBarIcon
      writeDataFile(persisted)

      const store = await createStore()

      expect(store.getSettings().showMenuBarIcon).toBe(true)
    })
  })

  it('persists an explicit macOS menu bar opt-out', async () => {
    await withPlatform('darwin', async () => {
      const store = await createStore()
      store.updateSettings({ showMenuBarIcon: false })
      store.flush()

      expect((readDataFile() as PersistedState).settings.showMenuBarIcon).toBe(false)
      expect((await createStore()).getSettings().showMenuBarIcon).toBe(false)
    })
  })

  it('normalizes menu bar icon writes to a strict boolean', async () => {
    await withPlatform('darwin', async () => {
      const store = await createStore()
      store.updateSettings({ showMenuBarIcon: 'true' as unknown as boolean })
      expect(store.getSettings().showMenuBarIcon).toBe(false)
      store.updateSettings({ showMenuBarIcon: true })
      expect(store.getSettings().showMenuBarIcon).toBe(true)
    })
  })

  it('round-trips a macOS menu bar opt-out through a non-mac host unchanged', async () => {
    await withPlatform('darwin', async () => {
      const store = await createStore()
      store.updateSettings({ showMenuBarIcon: false })
      store.flush()
    })

    // Why: a profile opened on another OS must not rewrite the mac-only preference on flush.
    await withPlatform('win32', async () => {
      const store = await createStore()
      store.updateSettings({ minimizeToTrayOnClose: true })
      store.flush()
      expect((readDataFile() as PersistedState).settings.showMenuBarIcon).toBe(false)
    })

    await withPlatform('darwin', async () => {
      expect((await createStore()).getSettings().showMenuBarIcon).toBe(false)
    })
  })

  it('defaults trayMinimizeNoticeShown to false and persists it strictly', async () => {
    const store = await createStore()
    expect(store.getUI().trayMinimizeNoticeShown).toBe(false)
    store.updateUI({ trayMinimizeNoticeShown: true })
    expect(store.getUI().trayMinimizeNoticeShown).toBe(true)
    store.flush()
    const reloaded = await createStore()
    expect(reloaded.getUI().trayMinimizeNoticeShown).toBe(true)
  })

  it('keeps the setup guide sidebar entry for existing profiles without an onboarding block', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: {}
    })

    const store = await createStore()

    expect(store.getUI().setupGuideSidebarDismissed).toBe(false)
    expect(store.getUI().setupGuideBrowserMilestoneMigrated).toBe(false)
    expect(store.getUI().setupGuideBrowserMilestoneLegacyComplete).toBe(false)
  })

  it('keeps the setup guide sidebar entry available when retired onboarding was left open', async () => {
    writeDataFile({
      onboarding: {
        flowVersion: 4,
        closedAt: null,
        outcome: null,
        lastCompletedStep: -1,
        checklist: {}
      },
      ui: {}
    })

    const store = await createStore()

    expect(store.getUI().setupGuideSidebarDismissed).toBe(false)
  })

  it('keeps new worktree card style off by default on load', async () => {
    writeDataFile({
      settings: {},
      ui: {}
    })

    const store = await createStore()

    expect(store.getSettings().experimentalNewWorktreeCardStyle).toBe(false)
  })

  it('preserves explicit new worktree card style opt-out on load', async () => {
    writeDataFile({
      settings: {
        experimentalNewWorktreeCardStyle: false
      },
      ui: {}
    })

    const store = await createStore()

    expect(store.getSettings().experimentalNewWorktreeCardStyle).toBe(false)
  })

  it('preserves explicit new worktree card style opt-in on load', async () => {
    writeDataFile({
      schemaVersion: 1,
      settings: {
        experimentalNewWorktreeCardStyle: true
      },
      ui: {}
    })

    const store = await createStore()

    expect(store.getSettings().experimentalNewWorktreeCardStyle).toBe(true)
  })

  it('treats persisted false setup guide sidebar dismissal as stale once onboarding was closed', async () => {
    writeDataFile({
      onboarding: {
        flowVersion: 4,
        closedAt: 123,
        outcome: 'dismissed',
        lastCompletedStep: 2,
        checklist: {}
      },
      ui: {
        setupGuideSidebarDismissed: false
      }
    })

    const store = await createStore()

    expect(store.getUI().setupGuideSidebarDismissed).toBe(true)
    store.flush()
    expect((readDataFile() as PersistedState).ui.setupGuideSidebarDismissed).toBe(true)
  })

  it.each([
    [{ closedAt: 'yesterday', outcome: 'completed' }],
    [{ closedAt: null, outcome: 'dismissed' }],
    [{ outcome: 'completed' }]
  ] as const)(
    'keeps the setup guide sidebar dismissed when closed onboarding has a malformed timestamp: %o',
    async (onboardingInput) => {
      writeDataFile({
        onboarding: {
          flowVersion: 4,
          lastCompletedStep: 5,
          checklist: {},
          ...onboardingInput
        },
        ui: {
          setupGuideSidebarDismissed: false
        }
      })

      const store = await createStore()

      expect(store.getUI().setupGuideSidebarDismissed).toBe(true)
    }
  )

  it('does not mutate gate fields for a consistent closed-onboarding existing user', async () => {
    // Why: the gate must be idempotent, and the retired onboarding block round-trips verbatim for downgrades.
    const consistent = {
      onboarding: {
        flowVersion: 4,
        closedAt: 123,
        outcome: 'completed',
        lastCompletedStep: 5,
        checklist: {}
      },
      ui: {
        setupGuideSidebarDismissed: true
      }
    }
    writeDataFile(consistent)

    const store = await createStore()
    expect(store.getUI().setupGuideSidebarDismissed).toBe(true)

    store.flush()
    const persisted = readDataFile() as typeof consistent

    expect(persisted.onboarding.closedAt).toBe(123)
    expect(persisted.onboarding.outcome).toBe('completed')
    expect(persisted.ui.setupGuideSidebarDismissed).toBe(true)
  })

  it('preserves legacy none grouping as ungrouped workspaces', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: { groupBy: 'none' }
    })
    const store = await createStore()
    expect(store.getUI().groupBy).toBe('none')
  })

  it('normalizes interim flat grouping back to none', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: { groupBy: 'flat' }
    })
    const store = await createStore()
    expect(store.getUI().groupBy).toBe('none')
  })

  it('preserves explicit workspace status grouping', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: { groupBy: 'workspace-status' }
    })
    const store = await createStore()
    expect(store.getUI().groupBy).toBe('workspace-status')
  })

  it('defaults projectOrderBy to manual when absent, even with recent sortBy', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: { sortBy: 'recent' }
    })
    const store = await createStore()
    expect(store.getUI().projectOrderBy).toBe('manual')
  })

  it('falls back invalid projectOrderBy to manual', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: { projectOrderBy: 'bogus' }
    })
    const store = await createStore()
    expect(store.getUI().projectOrderBy).toBe('manual')
  })

  it('preserves and round-trips an explicit recent projectOrderBy', async () => {
    writeDataFile({
      schemaVersion: 1,
      ui: { projectOrderBy: 'recent' }
    })
    const store = await createStore()
    expect(store.getUI().projectOrderBy).toBe('recent')

    store.updateUI({ projectOrderBy: 'manual' })
    expect(store.getUI().projectOrderBy).toBe('manual')
  })
})
