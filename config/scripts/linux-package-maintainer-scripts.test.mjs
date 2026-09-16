import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Linux package maintainer scripts', () => {
  it('keeps upgrades from removing the installed CLI', () => {
    const script = readFileSync(
      new URL('../../resources/linux/packaging/after-remove.sh', import.meta.url),
      'utf8'
    )
    const unlinkStart = script.indexOf('for link in /usr/bin/girra /usr/bin/orca-ide')
    const upgradeGuard = script.slice(0, unlinkStart)

    expect(unlinkStart).toBeGreaterThan(-1)
    expect(upgradeGuard).toContain('case "${1-}" in')
    expect(upgradeGuard).toContain('0 | remove | purge) ;;')
    expect(upgradeGuard).toContain('*) exit 0 ;;')
  })

  it('installs girra as the primary name and keeps orca-ide as an alias', () => {
    const script = readFileSync(
      new URL('../../resources/linux/packaging/after-install.sh', import.meta.url),
      'utf8'
    )

    expect(script).toContain('link_shim /usr/bin/girra "$dir/resources/bin/girra"')
    expect(script).toContain('link_shim /usr/bin/orca-ide "$dir/resources/bin/orca-ide"')
    // The probe must cover the productName-derived install dir.
    expect(script).toContain('/opt/Girra')
  })
})
