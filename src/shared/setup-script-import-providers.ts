export const SETUP_SCRIPT_IMPORT_PROVIDERS = [
  'superset',
  'conductor',
  'cmux',
  'package-manager'
] as const

export type SetupScriptImportProvider = (typeof SETUP_SCRIPT_IMPORT_PROVIDERS)[number]
