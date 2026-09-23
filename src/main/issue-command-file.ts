// Why: `.girra/issue-command` is the per-user override; `orca.yaml` is the tracked project default.
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { loadHooks } from './hooks'

export const GIRRA_DIR = '.girra'
export const LEGACY_GIRRA_DIR = '.orca'
const ISSUE_COMMAND_FILENAME = 'issue-command'

/** Where a new override is written. */
export function getIssueCommandFilePath(repoPath: string): string {
  return join(repoPath, GIRRA_DIR, ISSUE_COMMAND_FILENAME)
}

/**
 * Where the existing override is, which is the legacy path until the user next
 * edits it. The file is the user's own, so it is read where it lies rather than
 * moved out from under a repository they may have it committed or ignored in.
 */
export function findIssueCommandFilePath(repoPath: string): string {
  const current = getIssueCommandFilePath(repoPath)
  if (existsSync(current)) {
    return current
  }
  const legacy = join(repoPath, LEGACY_GIRRA_DIR, ISSUE_COMMAND_FILENAME)
  return existsSync(legacy) ? legacy : current
}

export function getSharedIssueCommand(repoPath: string): string | null {
  return loadHooks(repoPath)?.issueCommand?.trim() || null
}

export type ResolvedIssueCommand = {
  localContent: string | null
  sharedContent: string | null
  effectiveContent: string | null
  localFilePath: string
  source: 'local' | 'shared' | 'none'
}

/**
 * Resolve the GitHub issue command using local override first, then tracked repo config.
 */
export function readIssueCommand(repoPath: string): ResolvedIssueCommand {
  const filePath = findIssueCommandFilePath(repoPath)
  let localContent: string | null = null

  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8').trim()
      localContent = content || null
    } catch {
      localContent = null
    }
  }

  const sharedContent = getSharedIssueCommand(repoPath)
  const effectiveContent = localContent ?? sharedContent

  return {
    localContent,
    sharedContent,
    effectiveContent,
    localFilePath: filePath,
    source: localContent ? 'local' : sharedContent ? 'shared' : 'none'
  }
}

/**
 * Write the per-user issue command override to `{repoRoot}/.girra/issue-command`.
 * Empty content deletes the override so the shared `orca.yaml` command applies again.
 */
export function writeIssueCommand(repoPath: string, content: string): void {
  // Why the found path on delete: clearing the override has to remove the file
  // that is actually in effect, which may still be the legacy one.
  const filePath = content.trim() ? getIssueCommandFilePath(repoPath) : findIssueCommandFilePath(repoPath)
  const trimmed = content.trim()

  try {
    if (!trimmed) {
      rmSync(filePath, { force: true })
      return
    }

    const orcaDir = join(repoPath, GIRRA_DIR)
    if (!existsSync(orcaDir)) {
      mkdirSync(orcaDir, { recursive: true })
    }
    ensureGirraDirIgnored(repoPath)
    writeFileSync(filePath, `${trimmed}\n`, 'utf-8')
  } catch (err) {
    console.error('[hooks] Failed to write issue command:', err)
    // Why: re-throw so the IPC handler surfaces the write failure to the renderer's .catch().
    throw err
  }
}

/** Ensure `.girra` is in `.gitignore` so the per-user directory is never committed. */
function ensureGirraDirIgnored(repoPath: string): void {
  const gitignorePath = join(repoPath, '.gitignore')
  try {
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8')
      if (new RegExp(`^\\${GIRRA_DIR}/?$`, 'm').test(content)) {
        return
      }
      const separator = content.endsWith('\n') ? '' : '\n'
      writeFileSync(gitignorePath, `${content}${separator}${GIRRA_DIR}\n`, 'utf-8')
    } else {
      writeFileSync(gitignorePath, `${GIRRA_DIR}\n`, 'utf-8')
    }
  } catch {
    console.warn(`[hooks] Could not update .gitignore to exclude ${GIRRA_DIR}`)
  }
}
