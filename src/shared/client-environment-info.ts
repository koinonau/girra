/** Copy-pasteable client environment fields for bug reports. */
export type ClientEnvironmentInfo = {
  appVersion: string
  platform: string
  osRelease: string
  arch: string
  /** Login/default shell path when known (e.g. SHELL / ComSpec / spawn shell). */
  shell?: string
}

const FOOTER_MARKER = '---'
const ORCA_LINE_PREFIX = 'Girra:'

// Why: match the whole block, optional Shell line included, even when edited.
const CLIENT_ENVIRONMENT_FOOTER_BLOCK =
  /(^|\r?\n)---\r?\nGirra:[^\r\n]*\r?\nOS:[^\r\n]*(?:\r?\nShell:[^\r\n]*)?/

function normalizeEnvironmentValue(value: string): string {
  return value.trim().replace(/[\r\n]+/g, ' ')
}

export function formatClientEnvironmentInfo(info: ClientEnvironmentInfo): string {
  const version = normalizeEnvironmentValue(info.appVersion) || 'unknown'
  const platform = normalizeEnvironmentValue(info.platform) || 'unknown'
  const osRelease = normalizeEnvironmentValue(info.osRelease)
  const arch = normalizeEnvironmentValue(info.arch)
  const osParts = [platform, osRelease, arch ? `(${arch})` : ''].filter(Boolean)
  const lines = [`${ORCA_LINE_PREFIX} ${version}`, `OS: ${osParts.join(' ')}`]
  const shell = info.shell ? normalizeEnvironmentValue(info.shell) : ''
  if (shell) {
    lines.push(`Shell: ${shell}`)
  }
  return lines.join('\n')
}

/** Block appended under error bodies so reporters always paste env details. */
export function formatClientEnvironmentFooter(info: ClientEnvironmentInfo): string {
  return `${FOOTER_MARKER}\n${formatClientEnvironmentInfo(info)}`
}

export function hasClientEnvironmentFooter(text: string): boolean {
  return CLIENT_ENVIRONMENT_FOOTER_BLOCK.test(text)
}
