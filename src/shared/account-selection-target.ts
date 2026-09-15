/** Host or WSL runtime a PTY launch resolves agent account state for. */
export type AccountSelectionTarget = {
  runtime?: 'host' | 'wsl'
  wslDistro?: string | null
}
