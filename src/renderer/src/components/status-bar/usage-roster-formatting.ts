// Pure formatting for the consolidated Usage roster, split out so it can be unit
// tested without pulling in React / UI dependencies.

// Mirrors barColor's 60/80 thresholds so the number matches its bar; neutral
// inherits the foreground color (STYLEGUIDE: color reserved for state).
export function usageTextColorClass(usedPercent: number): string {
  if (usedPercent >= 80) {
    return 'text-red-500'
  }
  if (usedPercent >= 60) {
    return 'text-yellow-500'
  }
  return 'text-foreground'
}
