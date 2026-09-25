// Imported first by the relay entry: the relay is versioned independently of the
// client, so an older host's service definition still exports ORCA_*.
import { adoptLegacyOrcaEnvNames } from '../shared/legacy-orca-env-aliases'

adoptLegacyOrcaEnvNames(process.env)
