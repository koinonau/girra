// Imported first by every main-side entry, so `GIRRA_*` is already populated when
// the modules below it read the environment at import time.
import { adoptLegacyOrcaEnvNames } from '../../shared/legacy-orca-env-aliases'

adoptLegacyOrcaEnvNames(process.env)
