import { useMemo } from 'react'
import { useAppStore } from '../../store'

/**
 * Every store action the TerminalPane controller dispatches, bound once.
 *
 * Why `getState()` and not one selector each: zustand action identities are fixed when the store
 * is built and no slice ever puts one in a `set()` payload, so subscribing to them can never fire.
 * TerminalPane mounts once per retained tab, so 26 action subscriptions cost 26 live listeners and
 * 26 selector runs per store publication *per mounted tab*. Same pattern as
 * `useSourceControlStoreActions`.
 */
export function useTerminalPaneStoreActions() {
  return useMemo(() => {
    const state = useAppStore.getState()
    return {
      clearRuntimePaneTitle: state.clearRuntimePaneTitle,
      clearTabPtyId: state.clearTabPtyId,
      clearTerminalPaneUnread: state.clearTerminalPaneUnread,
      clearTerminalTabUnread: state.clearTerminalTabUnread,
      clearWorktreeUnread: state.clearWorktreeUnread,
      consumeSuppressedPtyExit: state.consumeSuppressedPtyExit,
      consumeTabIssueCommandSplit: state.consumeTabIssueCommandSplit,
      consumeTabSetupSplit: state.consumeTabSetupSplit,
      consumeTabStartupCommand: state.consumeTabStartupCommand,
      isPtyShutdownPending: state.isPtyShutdownPending,
      markTerminalPaneUnread: state.markTerminalPaneUnread,
      markTerminalTabUnread: state.markTerminalTabUnread,
      markWorktreeUnread: state.markWorktreeUnread,
      openSpacePage: state.openSpacePage,
      refreshWorkspaceSpace: state.refreshWorkspaceSpace,
      setCacheTimerStartedAt: state.setCacheTimerStartedAt,
      setRuntimePaneTitle: state.setRuntimePaneTitle,
      setTabCanExpandPane: state.setTabCanExpandPane,
      setTabLayout: state.setTabLayout,
      setTabPaneExpanded: state.setTabPaneExpanded,
      setTabViewMode: state.setTabViewMode,
      toggleTabViewMode: state.toggleTabViewMode,
      suppressPtyExit: state.suppressPtyExit,
      updateSettings: state.updateSettings,
      updateTabPtyId: state.updateTabPtyId,
      updateTabTitle: state.updateTabTitle
    }
  }, [])
}

export type TerminalPaneStoreActions = ReturnType<typeof useTerminalPaneStoreActions>

/** The action names bound above, for the listener-budget test. */
export const TERMINAL_PANE_STORE_ACTION_KEYS = [
  'clearRuntimePaneTitle',
  'clearTabPtyId',
  'clearTerminalPaneUnread',
  'clearTerminalTabUnread',
  'clearWorktreeUnread',
  'consumeSuppressedPtyExit',
  'consumeTabIssueCommandSplit',
  'consumeTabSetupSplit',
  'consumeTabStartupCommand',
  'isPtyShutdownPending',
  'markTerminalPaneUnread',
  'markTerminalTabUnread',
  'markWorktreeUnread',
  'openSpacePage',
  'refreshWorkspaceSpace',
  'setCacheTimerStartedAt',
  'setRuntimePaneTitle',
  'setTabCanExpandPane',
  'setTabLayout',
  'setTabPaneExpanded',
  'setTabViewMode',
  'toggleTabViewMode',
  'suppressPtyExit',
  'updateSettings',
  'updateTabPtyId',
  'updateTabTitle'
] as const
