import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

import { runProcess } from '../../src/shared/child-process/run-process'

const PUBLISH_STEP = 'Publish the GitHub Release'
const DMG = 'girra-macos-arm64.dmg'

const workflow = parse(readFileSync('.github/workflows/mac-build.yml', 'utf8'))
const publishScript = workflow.jobs['build-mac'].steps.find(
  (step) => step.name === PUBLISH_STEP
).run
const version = JSON.parse(readFileSync('package.json', 'utf8')).version

/**
 * Run the publish step against a `gh` that answers as the scenario says, and report
 * which `gh` subcommands it reached.
 *
 * `assets` is what `gh release view --json assets --jq` prints: the names the tag already
 * carries. `null` means the release itself does not exist.
 */
async function runPublishStep(assets) {
  const dir = mkdtempSync(join(tmpdir(), 'girra-publish-guard-'))
  const callLog = join(dir, 'calls.txt')
  const ghStub = join(dir, 'gh')
  writeFileSync(
    ghStub,
    `#!/bin/bash
echo "$@" >> ${JSON.stringify(callLog)}
case "$*" in
  *"--json assets"*) ${assets === null ? 'exit 1' : `printf '%s\\n' ${assets.map((name) => JSON.stringify(name)).join(' ')}`} ;;
  "release view "*) ${assets === null ? 'exit 1' : 'exit 0'} ;;
esac
exit 0
`
  )
  chmodSync(ghStub, 0o755)
  writeFileSync(join(dir, 'step.sh'), publishScript)

  const result = await runProcess({
    program: 'bash',
    args: [join(dir, 'step.sh')],
    cwd: process.cwd(),
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_SHA: 'deadbeef' }
  })
  let calls = ''
  try {
    calls = readFileSync(callLog, 'utf8')
  } catch {
    // The guard can refuse before reaching gh at all.
  }
  return { code: result.code, stdout: result.stdout, calls }
}

describe('mac-build release publishing', () => {
  it('refuses rather than replacing a DMG the tag already carries', async () => {
    const { code, stdout, calls } = await runPublishStep([DMG])
    expect(code).not.toBe(0)
    expect(stdout).toContain(`v${version} already carries ${DMG}`)
    expect(calls).not.toContain('release upload')
  })

  it('creates the release and uploads when the tag is new', async () => {
    const { code, calls } = await runPublishStep(null)
    expect(code).toBe(0)
    expect(calls).toContain('release create')
    expect(calls).toContain(`release upload v${version} dist/${DMG}`)
  })

  // Why: a run that created the release and then failed to upload must stay completable,
  // which is the whole reason the guard keys on the asset instead of on the release.
  it('uploads into a release that exists without the DMG', async () => {
    const { code, calls } = await runPublishStep([])
    expect(code).toBe(0)
    expect(calls).not.toContain('release create')
    expect(calls).toContain(`release upload v${version} dist/${DMG}`)
  })

  it('never passes --clobber, which is what made an overwrite silent', () => {
    expect(publishScript).not.toContain('--clobber')
  })
})
