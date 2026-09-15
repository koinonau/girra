import { posix } from 'node:path'
import { parseWslUncPath } from '../../shared/wsl-paths'
import type {
  SkillDirectoryEntry,
  SkillInstallFilesystem,
  SkillPathInspection
} from './skill-install-filesystem'
import {
  parseWslInspectPathsOutput,
  parseWslListEntriesOutput,
  WSL_INSPECT_PATHS_SCRIPT,
  WSL_LIST_ENTRIES_SCRIPT
} from './skill-delete/wsl-enumeration-protocol'
import { runWslProcess } from '../wsl/wsl-runner'

const GUEST_COMMAND_TIMEOUT_MS = 30_000
const GUEST_COMMAND_MAX_OUTPUT_BYTES = 64 * 1024
// Why far above the default: one batched `listEntries` covers every discovery
// root of a WSL home at once, which is orders of magnitude more output than a
// rename or remove. Matched to the discovery scanner's own bound.
const ENUMERATION_MAX_BUFFER_BYTES = 128 * 1024 * 1024

const RENAME_SCRIPT = [
  'set -eu',
  '[ ! -e "$2" ] && [ ! -L "$2" ] || exit 43',
  'mv -- "$1" "$2"',
  'sync -f "$2" 2>/dev/null || sync'
].join('\n')

const REMOVE_SCRIPT = [
  'set -eu',
  'parent=$(dirname -- "$1")',
  'rm -rf -- "$1"',
  'sync -f "$parent" 2>/dev/null || sync'
].join('\n')

export class WslSkillInstallFilesystem implements SkillInstallFilesystem {
  private readonly guestAllowedRoots: string[]

  constructor(
    private readonly distro: string,
    allowedRoots: readonly string[]
  ) {
    this.guestAllowedRoots = allowedRoots.map((path) => this.toGuestPath(path))
  }

  authorizeRoots(paths: readonly string[]): void {
    for (const path of paths) {
      const guestRoot = this.toGuestPath(path)
      if (!this.guestAllowedRoots.includes(guestRoot)) {
        this.guestAllowedRoots.push(guestRoot)
      }
    }
  }

  async rename(source: string, target: string): Promise<void> {
    await this.run(RENAME_SCRIPT, [this.requireAllowed(source), this.requireAllowed(target)])
  }

  async remove(path: string): Promise<void> {
    await this.run(REMOVE_SCRIPT, [this.requireAllowed(path)])
  }

  async listEntries(directories: readonly string[]): Promise<Map<string, SkillDirectoryEntry[]>> {
    if (directories.length === 0) {
      return new Map()
    }
    return parseWslListEntriesOutput(
      await this.runOutput(
        WSL_LIST_ENTRIES_SCRIPT,
        directories.map((directory) => this.requireReadable(directory)),
        ENUMERATION_MAX_BUFFER_BYTES
      ),
      directories
    )
  }

  async inspectPaths(paths: readonly string[]): Promise<Map<string, SkillPathInspection>> {
    if (paths.length === 0) {
      return new Map()
    }
    return parseWslInspectPathsOutput(
      await this.runOutput(
        WSL_INSPECT_PATHS_SCRIPT,
        paths.map((path) => this.requireReadable(path)),
        ENUMERATION_MAX_BUFFER_BYTES
      ),
      paths
    )
  }

  private toGuestPath(path: string): string {
    const parsed = parseWslUncPath(path)
    if (parsed) {
      if (
        parsed.distro.toLocaleLowerCase('en-US') !== this.distro.toLocaleLowerCase('en-US') ||
        !posix.isAbsolute(parsed.linuxPath) ||
        parsed.linuxPath.includes('\0')
      ) {
        throw new Error('skill-install-wsl-path-invalid')
      }
      return posix.normalize(parsed.linuxPath)
    }
    const drive = path.replace(/\\/g, '/').match(/^([A-Za-z]):\/(.*)$/)
    if (!drive || path.includes('\0')) {
      throw new Error('skill-install-wsl-path-invalid')
    }
    return posix.join('/mnt', drive[1].toLocaleLowerCase('en-US'), drive[2])
  }

  private requireAllowed(path: string): string {
    const guestPath = this.toGuestPath(path)
    const allowed = this.guestAllowedRoots.some((root) => {
      const child = posix.relative(root, guestPath)
      return child !== '' && child !== '..' && !child.startsWith('../') && !posix.isAbsolute(child)
    })
    if (!allowed) {
      throw new Error('skill-install-wsl-path-outside-root')
    }
    return guestPath
  }

  /** Enumeration also has to reach an authorized root *itself*, which
   *  `requireAllowed` refuses because it demands strict containment. Read-only,
   *  so admitting the root adds no mutation surface. */
  private requireReadable(path: string): string {
    const guestPath = this.toGuestPath(path)
    const allowed = this.guestAllowedRoots.some((root) => {
      const child = posix.relative(root, guestPath)
      return child !== '..' && !child.startsWith('../') && !posix.isAbsolute(child)
    })
    if (!allowed) {
      throw new Error('skill-install-wsl-path-outside-root')
    }
    return guestPath
  }

  private async run(script: string, args: string[]): Promise<void> {
    await this.runOutput(script, args)
  }

  private async runOutput(
    script: string,
    args: string[],
    maxOutputBytes = GUEST_COMMAND_MAX_OUTPUT_BYTES
  ): Promise<string> {
    const result = await runWslProcess({
      distro: this.distro,
      loginPath: 'none',
      script,
      // POSIX file operations; declared because the payload is opaque here.
      shell: 'sh',
      args,
      timeoutMs: GUEST_COMMAND_TIMEOUT_MS,
      maxOutputBytes
    })
    if (result.code !== 0 || result.timedOut) {
      throw Object.assign(new Error('skill-install-wsl-guest-operation-failed'), {
        cause: new Error(`wsl exited ${result.code}: ${result.stderr}`)
      })
    }
    return result.stdout.trim()
  }
}
