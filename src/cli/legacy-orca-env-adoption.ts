// Imported first by the CLI entry: an SSH host's shim, installed by an older
// client, still exports `ORCA_*` into this process.
import { adoptLegacyOrcaEnvNames } from '../shared/legacy-orca-env-aliases'

adoptLegacyOrcaEnvNames(process.env)
