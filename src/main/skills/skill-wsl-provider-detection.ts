import { runWslProcess } from '../wsl/wsl-runner'

const DETECTION_SCRIPT = [
  'set -eu',
  'command -v claude >/dev/null 2>&1 && printf "claude\\n" || true'
].join('\n')

export async function detectSkillProvidersInWsl(distro: string): Promise<string[]> {
  let result
  try {
    // Why probe: a bare `sh -c` has no login shell, so a PATH built by nvm/mise
    // rc files never applies and an installed claude reads as absent.
    result = await runWslProcess({
      distro,
      loginPath: 'preferred',
      script: DETECTION_SCRIPT,
      // POSIX `command -v` loop; declared because the payload is opaque here.
      shell: 'sh',
      timeoutMs: 10_000
    })
  } catch {
    throw new Error('skill-install-wsl-provider-detection-failed')
  }
  if (result.code !== 0) {
    throw new Error('skill-install-wsl-provider-detection-failed')
  }
  // Why fail: the script ends in `|| true`, so without the login PATH an
  // nvm-only claude reads absent and the caller skips its skill roots (#9725).
  if (!result.environmentResolved) {
    throw new Error('skill-install-wsl-provider-detection-failed')
  }
  return result.stdout.split(/\r?\n/u).filter((provider) => provider === 'claude')
}
