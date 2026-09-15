import { expect, it } from 'vitest'
import { join } from 'node:path'
import type { SessionFileDiscovery } from '../ai-vault/session-scanner-types'
import { sessionSearchRootListings } from './session-search-scan-roots'

const ROOT = '/tmp/ss-roots/projects'

function file(path: string): SessionFileDiscovery['files'][number] {
  return { path, mtimeMs: 0, modifiedAt: new Date(0).toISOString() }
}

it('counts a file by path segment under its own root, not by string prefix', () => {
  const listings = sessionSearchRootListings([
    {
      agent: 'claude',
      rootDir: ROOT,
      files: [
        file(join(ROOT, 'a', 'one.jsonl')),
        // A sibling whose name merely starts with the root's name belongs to no root.
        file(join(`${ROOT}-old`, 'b', 'two.jsonl')),
        // A synthetic store row names no file under the root.
        file(`${ROOT}#session-1`)
      ]
    }
  ])

  expect(listings).toEqual([{ root: ROOT, files: 1 }])
})
