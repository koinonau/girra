import { join } from 'node:path'

// Why `girra` now: the rename off `orca` removes the GNOME Orca clash the `orca-ide` name existed to dodge.
export const LINUX_CLI_COMMAND_NAME = 'girra'

/** Absolute path of the CLI launcher this app ships in its own resources bundle.
 *  Lives apart from cli-installer so callers that only need the path (PTY env
 *  assembly) don't pull in the installer's `electron` dependency. */
export function getBundledLauncherPath(
  platform: NodeJS.Platform,
  resourcesPath: string
): string | null {
  if (platform === 'darwin') {
    return join(resourcesPath, 'bin', 'girra')
  }
  if (platform === 'linux') {
    return join(resourcesPath, 'bin', LINUX_CLI_COMMAND_NAME)
  }
  if (platform === 'win32') {
    return join(resourcesPath, 'bin', 'girra.exe')
  }
  return null
}
