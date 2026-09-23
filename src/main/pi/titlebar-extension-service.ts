import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import { createHash } from 'node:crypto'
import {
  GIRRA_PI_AGENT_STATUS_EXTENSION_FILE,
  getPiAgentStatusExtensionSource
} from './agent-status-extension-source'
import {
  GIRRA_PI_PREFILL_EXTENSION_FILE,
  getPiPrefillExtensionSource
} from './prefill-extension-source'
import { GIRRA_PI_EXTENSION_FILE, getPiTitlebarExtensionSource } from './titlebar-extension-source'
import {
  isSafeDescendCandidate as sharedIsSafeDescendCandidate,
  safeRemoveOverlay
} from '../pty/overlay-mirror'

// Why: the Pi test suite imports `isSafeDescendCandidate` from this module's
// public surface to lock in the Windows-junction ordering invariant against
// future refactors. Re-export the shared implementation so the test contract
// keeps holding after the helper moved to src/main/pty/overlay-mirror.ts.
export const isSafeDescendCandidate = sharedIsSafeDescendCandidate

const GIRRA_MANAGED_EXTENSION_MARKER = '@orca-managed-pi-extension'
// Why: old Girra versions used PTY-scoped overlays under this root. Keep the
// name so spawn and teardown can remove stale pre-migration dirs.
const OVERLAY_ROOT_DIR_NAME = 'pi-agent-overlays'

function getDefaultPiAgentDir(): string {
  return join(homedir(), '.pi', 'agent')
}

function toSafeOverlayDirName(ptyId: string): string {
  return createHash('sha256').update(ptyId).digest('hex').slice(0, 32)
}

function withOrcaManagedExtensionMarker(source: string): string {
  return source.includes(GIRRA_MANAGED_EXTENSION_MARKER)
    ? source
    : `// ${GIRRA_MANAGED_EXTENSION_MARKER}\n${source}`
}

export class PiTitlebarExtensionService {
  // Why: overlay teardown must use the shared safeRemoveOverlay so the
  // Windows-junction guard from issue #1083 stays in lock-step across all
  // overlay consumers (Pi here, OpenCode in src/main/opencode/hook-service.ts).
  private removeLegacyPtyOverlays(ptyId: string): void {
    const root = join(getAppEnvironment().getPath('userData'), OVERLAY_ROOT_DIR_NAME)
    safeRemoveOverlay(join(root, toSafeOverlayDirName(ptyId)), root)
    safeRemoveOverlay(join(root, ptyId), root)
  }

  private canOverwriteManagedExtension(path: string): boolean {
    try {
      return readFileSync(path, 'utf8').includes(GIRRA_MANAGED_EXTENSION_MARKER)
    } catch {
      return true
    }
  }

  private writeManagedExtension(path: string, source: string): void {
    if (existsSync(path) && !this.canOverwriteManagedExtension(path)) {
      return
    }
    try {
      writeFileSync(path, source)
    } catch {
      // Why: a failed install leaves Pi without Girra status; it must not block the spawn.
    }
  }

  private installManagedExtensions(sourceAgentDir: string): void {
    const extensionsDir = join(sourceAgentDir, 'extensions')
    try {
      mkdirSync(extensionsDir, { recursive: true })
    } catch {
      return
    }

    this.writeManagedExtension(
      join(extensionsDir, GIRRA_PI_EXTENSION_FILE),
      withOrcaManagedExtensionMarker(getPiTitlebarExtensionSource())
    )
    this.writeManagedExtension(
      join(extensionsDir, GIRRA_PI_PREFILL_EXTENSION_FILE),
      withOrcaManagedExtensionMarker(getPiPrefillExtensionSource())
    )
    this.writeManagedExtension(
      join(extensionsDir, GIRRA_PI_AGENT_STATUS_EXTENSION_FILE),
      withOrcaManagedExtensionMarker(getPiAgentStatusExtensionSource())
    )
  }

  buildPtyEnv(
    ptyId: string,
    existingAgentDir: string | undefined,
    options?: { materializeDefaultHome?: boolean }
  ): Record<string, string> {
    const sourceAgentDir = existingAgentDir || getDefaultPiAgentDir()
    try {
      this.removeLegacyPtyOverlays(ptyId)
    } catch {
      // Why: old per-PTY overlay cleanup is best-effort; a locked stale
      // directory should not prevent the terminal from starting.
    }

    // Why: bare shells used to mkdir ~/.pi/agent for every terminal so a
    // later typed `pi` got hooks. That recreates deleted unused agent
    // homes on every open (#10196). Only materialize the default home when the
    // caller opts in (explicit agent launch) or the dir already exists.
    const materializeDefaultHome = options?.materializeDefaultHome !== false
    if (!existsSync(sourceAgentDir) && !materializeDefaultHome) {
      return {}
    }

    this.installManagedExtensions(sourceAgentDir)
    return { GIRRA_PI_SOURCE_AGENT_DIR: sourceAgentDir }
  }

  clearPty(ptyId: string): void {
    // Why: source-scoped legacy overlays are deliberately left in place so
    // upgrades never delete user runtime state.
    try {
      this.removeLegacyPtyOverlays(ptyId)
    } catch {
      // Why: on Windows the overlay dir can be locked (EPERM/EBUSY) by
      // antivirus or indexers. Overlay cleanup is best-effort - a stale
      // old PTY-scoped directory in userData is harmless and will be
      // retried on the next PTY spawn/teardown.
    }
  }
}

export const piTitlebarExtensionService = new PiTitlebarExtensionService()
