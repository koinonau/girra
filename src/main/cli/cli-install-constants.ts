export const DEFAULT_MAC_COMMAND_PATH = '/usr/local/bin/girra'
export const DEV_COMMAND_NAME = 'girra-dev'
// Why kept as `orca`: names the pre-rename command this installer may reclaim, not a command it creates.
export const LEGACY_LINUX_COMMAND_NAME = 'orca'
/** Alias names written beside the primary command so scripts already calling `orca` keep running. */
export const CLI_COMMAND_ALIASES = ['orca', 'orca-ide'] as const
export const DEV_CLI_COMMAND_ALIASES = ['orca-dev', 'girra', 'orca'] as const
export const DEV_LAUNCHER_DIR = ['cli', 'bin'] as const
export const WINDOWS_PATH_WRITE_TIMEOUT_MS = 5_000
