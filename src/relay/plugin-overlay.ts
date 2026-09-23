// Why: relay-side equivalent of Girra's local agent integration installers.
// OpenCode still needs a config overlay, while Pi now gets Girra-managed
// extension files installed into the remote agent home. Host paths from the
// renderer are meaningless on SSH targets, so the relay performs the remote
// filesystem work itself.
//
// Plugin source strings ship over the JSON-RPC channel at session-ready —
// they are NOT bundled with the relay binary because the relay is versioned
// independently from Girra and the plugin source changes frequently as new
// agent events get added; bundling would make every such change a relay
// redeploy, and an old relay would silently serve stale plugin code.
//
// We deliberately do not reuse OpenCodeHookService / PiTitlebarExtensionService
// directly: those modules import `electron` and ride on Girra's userData
// path. The relay's electron-free constraint forces a thin parallel
// implementation rooted at $HOME/.orca-relay/ for OpenCode and at the remote
// Pi home for Pi.

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mirrorEntry, safeRemoveOverlay } from '../main/pty/overlay-mirror'

const RELAY_HOOKS_DIR = '.orca-relay'
const OPENCODE_OVERLAY_SUBDIR = 'opencode-overlays'
// Why: old relays wrote PTY-scoped Pi overlays here; exit cleanup still sweeps them.
const LEGACY_PI_OVERLAY_SUBDIR = 'pi-overlays'
const OPENCODE_PLUGIN_FILE = 'orca-opencode-status.js'
const PI_EXTENSION_FILE = 'orca-agent-status.ts'
const GIRRA_MANAGED_EXTENSION_MARKER = '@orca-managed-pi-extension'

function withOrcaManagedPiExtensionMarker(source: string): string {
  return source.includes(GIRRA_MANAGED_EXTENSION_MARKER)
    ? source
    : `// ${GIRRA_MANAGED_EXTENSION_MARKER}\n${source}`
}
function safeDirName(input: string): string {
  // Why: paneKey embeds tabId:paneId where tabId may itself contain
  // filesystem-unsafe characters in some Girra builds. Hash to a fixed-width
  // hex name so any input produces a portable directory name.
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}

function isUsableId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 1024
}

export type PluginSources = {
  /** Source body of `orca-opencode-status.js` to drop into <overlay>/plugins/. */
  opencodePluginSource?: string
  /** Source body of Pi's `orca-agent-status.ts` to install in its real agent dir. */
  piExtensionSource?: string
}

/** Result of installing Pi status into the real agent home. */
export type MaterializePiResult = {
  sourceAgentDir: string
  /** Absolute path to the installed orca-agent-status.ts. */
  statusExtensionPath: string
}

/** Presence of this file is what makes an overlay usable — a rebuild that failed
 *  after the wipe leaves the dir itself present but the plugin missing. */
export function getRelayOpenCodePluginPath(overlayDir: string): string {
  return join(overlayDir, 'plugins', OPENCODE_PLUGIN_FILE)
}

export class PluginOverlayManager {
  private opencodePluginSource: string | null = null
  private piExtensionSource: string | null = null
  private homeDir: string
  private opencodeRoot: string
  private legacyPiRoot: string

  constructor(opts?: { homeDir?: string }) {
    const home = opts?.homeDir ?? homedir()
    this.homeDir = home
    this.opencodeRoot = join(home, RELAY_HOOKS_DIR, OPENCODE_OVERLAY_SUBDIR)
    this.legacyPiRoot = join(home, RELAY_HOOKS_DIR, LEGACY_PI_OVERLAY_SUBDIR)
  }

  /** Replace the cached source bodies. Called from relay.ts when Girra sends
   *  `agent_hook.installPlugins`. The first install enables the augmenter
   *  output; subsequent installs (e.g. Girra version upgrade in flight) refresh
   *  the cached source so future spawns see the new strings.
   *  Note: existing running agents keep whatever source they loaded at
   *  process start. Future PTYs pick up the refreshed source when the relay
   *  writes plugin/extension files before spawn. */
  setSources(sources: PluginSources): void {
    if (typeof sources.opencodePluginSource === 'string') {
      this.opencodePluginSource = sources.opencodePluginSource
    }
    if (typeof sources.piExtensionSource === 'string') {
      this.piExtensionSource = withOrcaManagedPiExtensionMarker(sources.piExtensionSource)
    }
  }

  hasOpenCodeSource(): boolean {
    return this.opencodePluginSource !== null
  }

  hasPiSource(): boolean {
    return this.piExtensionSource !== null
  }

  private mirrorOpenCodeConfig(sourceDir: string, overlayDir: string): void {
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      const sourcePath = join(sourceDir, entry.name)

      if (entry.name === 'plugins') {
        const isSymlink = entry.isSymbolicLink()
        let isLinkPointingToDir = false
        if (isSymlink) {
          try {
            isLinkPointingToDir = statSync(sourcePath).isDirectory()
          } catch {
            isLinkPointingToDir = false
          }
        }

        if ((!isSymlink && entry.isDirectory()) || isLinkPointingToDir) {
          const resolvedSource = isLinkPointingToDir ? realpathSync(sourcePath) : sourcePath
          const overlayPluginsDir = join(overlayDir, 'plugins')
          mkdirSync(overlayPluginsDir, { recursive: true })
          for (const pluginEntry of readdirSync(resolvedSource, { withFileTypes: true })) {
            if (pluginEntry.name === OPENCODE_PLUGIN_FILE) {
              continue
            }
            mirrorEntry(
              join(resolvedSource, pluginEntry.name),
              join(overlayPluginsDir, pluginEntry.name)
            )
          }
          continue
        }
      }

      mirrorEntry(sourcePath, join(overlayDir, entry.name))
    }
  }

  private writeOpenCodePlugin(overlayDir: string): void {
    const pluginsDir = join(overlayDir, 'plugins')
    mkdirSync(pluginsDir, { recursive: true })
    const pluginPath = join(pluginsDir, OPENCODE_PLUGIN_FILE)
    try {
      unlinkSync(pluginPath)
    } catch {
      // Fresh overlay or no same-named stale symlink.
    }
    writeFileSync(pluginPath, this.opencodePluginSource!)
  }

  /** Materialize the OpenCode plugin overlay for `id` (typically the
   *  renderer-supplied paneKey or, fallback, the relay-internal pty-id) and
   *  return the directory path. Returns null when no source is cached or
   *  the overlay write fails — caller falls back to no plugin (the agent
   *  CLI runs without status reporting), which is the existing fail-open
   *  behavior on the local side. */
  materializeOpenCode(id: string, existingConfigDir?: string): string | null {
    if (!this.opencodePluginSource || !isUsableId(id)) {
      return null
    }
    const dir = join(this.opencodeRoot, safeDirName(id))
    try {
      safeRemoveOverlay(dir, this.opencodeRoot)
      mkdirSync(dir, { recursive: true })
      if (existingConfigDir) {
        if (!existsSync(existingConfigDir)) {
          return null
        }
        // Why: OPENCODE_CONFIG_DIR is a single config root. Mirror the user's
        // remote root into the overlay before adding Girra's plugin so status
        // reporting does not hide their auth, models, keybinds, or plugins.
        this.mirrorOpenCodeConfig(existingConfigDir, dir)
      }
      this.writeOpenCodePlugin(dir)
      return dir
    } catch (err) {
      process.stderr.write(
        `[plugin-overlay] failed to materialize OpenCode overlay: ${err instanceof Error ? err.message : String(err)}\n`
      )
      return null
    }
  }

  private canOverwritePiExtension(path: string): boolean {
    try {
      return readFileSync(path, 'utf8').includes(GIRRA_MANAGED_EXTENSION_MARKER)
    } catch {
      return true
    }
  }

  /** Install the Pi status extension into the remote real agent dir, defaulting
   *  to `~/.pi/agent` when `existingAgentDir` is not supplied.
   *
   *  When `materializeDefaultHome` is false (bare shells), a missing default
   *  home is left alone so an unused Pi does not recreate `~/.pi` (#10196). */
  materializePi(
    id: string,
    existingAgentDir?: string,
    options?: { materializeDefaultHome?: boolean }
  ): MaterializePiResult | null {
    const extensionSource = this.piExtensionSource
    if (!extensionSource || !isUsableId(id)) {
      return null
    }
    try {
      const sourceAgentDir = existingAgentDir ?? join(this.homeDir, '.pi', 'agent')
      if (existingAgentDir && !existsSync(existingAgentDir)) {
        return null
      }
      const materializeDefaultHome = options?.materializeDefaultHome !== false
      if (!existingAgentDir && !existsSync(sourceAgentDir) && !materializeDefaultHome) {
        return null
      }
      const extensionsDir = join(sourceAgentDir, 'extensions')
      mkdirSync(extensionsDir, { recursive: true })
      const extensionPath = join(extensionsDir, PI_EXTENSION_FILE)
      if (!this.canOverwritePiExtension(extensionPath)) {
        return null
      }
      writeFileSync(extensionPath, extensionSource)
      return {
        sourceAgentDir,
        statusExtensionPath: extensionPath
      }
    } catch (err) {
      process.stderr.write(
        `[plugin-overlay] failed to install pi extension: ${err instanceof Error ? err.message : String(err)}\n`
      )
      return null
    }
  }

  /** Drop a paneKey's overlay dirs on PTY exit. Best-effort; cleanup over a
   *  recursive tree may fail on exotic filesystems but the worst-case
   *  outcome is unbounded growth on a long-lived relay, which the per-pane
   *  caches alone do not bound. */
  clearOverlay(id: string): void {
    if (!isUsableId(id)) {
      return
    }
    const safe = safeDirName(id)
    // Why: sweep both roots because PTY exit doesn't know which agent materialized
    // this id. Per-root scoping inside safeRemoveOverlay keeps each call bounded.
    for (const root of [this.opencodeRoot, this.legacyPiRoot]) {
      try {
        safeRemoveOverlay(join(root, safe), root)
      } catch (err) {
        // Why: log the failed cleanup so a permission/IO error is observable.
        // The leak is the failure mode the per-pane cache eviction exists to
        // prevent - silent swallows would let it accumulate invisibly on
        // long-running relays.
        process.stderr.write(
          `[plugin-overlay] failed to remove overlay dir ${join(root, safe)}: ${err instanceof Error ? err.message : String(err)}\n`
        )
      }
    }
  }
}
