import { rmdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const LOCK_DIRECTORY_RMDIR_IGNORED_CODES = new Set(['ENOENT', 'ENOTEMPTY', 'EEXIST', 'EBUSY'])

async function unlinkIfPresent(path: string): Promise<void> {
  await unlink(path).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  })
}

async function removeDirectoryIfPresent(
  path: string,
  removeDirectory: (path: string) => Promise<void>
): Promise<void> {
  await removeDirectory(path).catch((error) => {
    if (!LOCK_DIRECTORY_RMDIR_IGNORED_CODES.has((error as NodeJS.ErrnoException).code ?? '')) {
      throw error
    }
  })
}

export async function cleanupReleasedSkillInstallLock(
  path: string,
  token: string,
  removeDirectory: (path: string) => Promise<void> = rmdir
): Promise<void> {
  await unlinkIfPresent(join(path, `${token}.owner`))
  await unlinkIfPresent(join(path, `${token}.released`))
  await removeDirectoryIfPresent(path, removeDirectory)
}
