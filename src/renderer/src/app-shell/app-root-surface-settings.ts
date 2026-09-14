import type { AppState } from '../store/types'

type AppRootSurfaceSettingsState = Pick<AppState, 'settings'>

export function selectAppRootSurfacePetEnabled(state: AppRootSurfaceSettingsState): boolean {
  return state.settings?.experimentalPet === true
}
