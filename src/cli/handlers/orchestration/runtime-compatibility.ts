import { RuntimeClientError } from '../../runtime-client'

// Why pre-rename tokens on the wire: the host validates this against a fixed enum, and a host built
// before the enum was widened rejects `girra` outright, failing the whole call. Every name below
// stays an installed alias, so the hint the host renders still runs. Send `girra` only once no
// supported host predates that widening; the enum itself already accepts it.
export function resolveCompatibilityCliCommand(): 'orca' | 'orca-ide' | 'orca-dev' {
  const configured = process.env.GIRRA_CLI_COMMAND
  if (configured === 'girra-dev' || configured === 'orca-dev') {
    return 'orca-dev'
  }
  if (configured === 'orca' || configured === 'orca-ide') {
    return configured
  }
  return process.platform === 'linux' ? 'orca-ide' : 'orca'
}

export function resolvePackagedWindowsCompatibilityCommand(): 'orca' | 'orca-ide' | undefined {
  if (process.env.GIRRA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = process.env.GIRRA_CLI_COMMAND
  if (command === 'girra' || command === 'girra.cmd' || command === 'orca') {
    return 'orca'
  }
  if (command === 'orca-ide') {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Girra launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.GIRRA_DEV_CLI_INVOCATION === '1' ||
    (process.env.GIRRA_USER_DATA_PATH?.includes('orca-dev') ?? false)
  )
}
