/**
 * `~/.claude/settings.json` is one file both Girra and an installed upstream Orca
 * manage, and each sweeps managed entries by script file name. These tests pin the
 * two directions of ADR-0004: Girra never deletes Orca's entry, and Orca's own sweep
 * never deletes Girra's.
 */
import { describe, expect, it } from 'vitest'
import {
  createManagedCommandMatcher,
  removeManagedCommands,
  MANAGED_HOOK_TIMEOUT_SECONDS,
  type HookCommandConfig,
  type HookDefinition,
  type HooksConfig
} from '../agent-hooks/installer-utils'
import { wrapPosixHookCommand } from '../agent-hooks/posix-hook-command'
import {
  applyManagedHooks,
  getManagedCommand,
  getPosixManagedScriptFileName,
  getStatusLineSlotState,
  removeManagedHooks
} from './hook-settings'

const GIRRA_SCRIPT = getPosixManagedScriptFileName()
const SHARED_SCRIPT = 'claude-hook.sh'

const girraHook: HookCommandConfig = {
  type: 'command',
  command: getManagedCommand(`/home/u/.girra/agent-hooks/${GIRRA_SCRIPT}`, {
    neutralJsonWhenMissing: true
  }),
  timeout: MANAGED_HOOK_TIMEOUT_SECONDS
}

/** Upstream Orca's runtime-home form: the same shape, under its own tree and name. */
const ORCA_RUNTIME_HOME_COMMAND = `if [ -f "\${HOME-}/.orca/agent-hooks/${SHARED_SCRIPT}" ]; then /bin/sh "\${HOME-}/.orca/agent-hooks/${SHARED_SCRIPT}"; fi`
/** The absolute form older Orca builds wrote. */
const ORCA_ABSOLUTE_COMMAND = wrapPosixHookCommand(`/home/u/.orca/agent-hooks/${SHARED_SCRIPT}`)

function definitionsFor(config: HooksConfig, eventName: string): HookDefinition[] {
  const definitions = config.hooks?.[eventName]
  return Array.isArray(definitions) ? definitions : []
}

function commandsFor(config: HooksConfig, eventName: string): string[] {
  return definitionsFor(config, eventName).flatMap((definition) =>
    (definition.hooks ?? []).map((hook) => hook.command ?? '')
  )
}

function configWith(commands: string[]): HooksConfig {
  return {
    hooks: {
      Stop: commands.map((command) => ({ hooks: [{ type: 'command' as const, command }] }))
    }
  }
}

describe('installing Girra hooks beside an installed Orca', () => {
  it.each([
    ['the runtime-home form', ORCA_RUNTIME_HOME_COMMAND],
    ['the absolute form', ORCA_ABSOLUTE_COMMAND]
  ])("keeps Orca's entry in %s and adds its own", (_label, orcaCommand) => {
    const next = applyManagedHooks(configWith([orcaCommand]), girraHook, GIRRA_SCRIPT)

    expect(commandsFor(next, 'Stop')).toEqual([orcaCommand, girraHook.command])
  })

  // Why: Orca's matcher keys on `agent-hooks/claude-hook.sh` alone and we cannot change
  // it, so the prefix on Girra's script name is what survives its sweep.
  it("survives Orca's own sweep of its managed name", () => {
    const installed = applyManagedHooks(
      configWith([ORCA_RUNTIME_HOME_COMMAND]),
      girraHook,
      GIRRA_SCRIPT
    )
    const afterOrcaSweep = removeManagedCommands(
      definitionsFor(installed, 'Stop'),
      createManagedCommandMatcher(SHARED_SCRIPT)
    )

    expect(
      afterOrcaSweep.flatMap((definition) => (definition.hooks ?? []).map((hook) => hook.command))
    ).toEqual([girraHook.command])
  })

  // Why scoped to `.girra/`: those entries name the script the same thing Orca does.
  it("removes Girra's own pre-prefix entries and nothing else", () => {
    const staleGirraCommand = wrapPosixHookCommand(`/home/u/.girra/agent-hooks/${SHARED_SCRIPT}`)
    const next = applyManagedHooks(
      configWith([ORCA_RUNTIME_HOME_COMMAND, staleGirraCommand]),
      girraHook,
      GIRRA_SCRIPT
    )

    expect(commandsFor(next, 'Stop')).toEqual([ORCA_RUNTIME_HOME_COMMAND, girraHook.command])
  })

  it("leaves Orca's entry behind when Girra's hooks are turned off", () => {
    const installed = applyManagedHooks(
      configWith([ORCA_RUNTIME_HOME_COMMAND]),
      girraHook,
      GIRRA_SCRIPT
    )
    const { config, changed } = removeManagedHooks(installed, GIRRA_SCRIPT)

    expect(changed).toBe(true)
    expect(commandsFor(config, 'Stop')).toEqual([ORCA_RUNTIME_HOME_COMMAND])
  })

  // One settings slot, two apps: Girra defers and falls back to the OAuth usage poll.
  it('reads an Orca-owned statusline as user-owned rather than claiming it', () => {
    const config: HooksConfig = {
      statusLine: { type: 'command', command: '/home/u/.orca/agent-hooks/claude-statusline.sh' }
    }

    expect(getStatusLineSlotState(config, 'claude-girra-statusline.sh')).toBe('user')
  })
})
