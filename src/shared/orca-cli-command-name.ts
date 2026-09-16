// Why one name everywhere: `girra` has no GNOME Orca collision, so Linux no longer needs `orca-ide`.
export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'girra.cmd' : 'girra'
}

/** Current name first, then the pre-rename aliases a host may still be the only one to carry. */
export function getOrcaCliCommandNameCandidatesForPlatform(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') {
    return ['girra.cmd', 'orca.cmd']
  }
  return platform === 'linux' ? ['girra', 'orca-ide', 'orca'] : ['girra', 'orca']
}
