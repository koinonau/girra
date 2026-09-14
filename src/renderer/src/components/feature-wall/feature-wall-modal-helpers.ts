export { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

export type FeatureWallOpenSource = 'help_menu' | 'popup' | 'onboarding' | 'unknown'

export function getFeatureWallOpenSource(
  modalData: Record<string, unknown>
): FeatureWallOpenSource {
  const source = modalData.source
  return source === 'help_menu' || source === 'popup' || source === 'onboarding'
    ? source
    : 'unknown'
}
