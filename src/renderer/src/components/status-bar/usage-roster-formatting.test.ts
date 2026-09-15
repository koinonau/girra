import { describe, expect, it } from 'vitest'
import { usageTextColorClass } from './usage-roster-formatting'

describe('usageTextColorClass', () => {
  it('stays neutral below the 60% caution line', () => {
    expect(usageTextColorClass(0)).toBe('text-foreground')
    expect(usageTextColorClass(59)).toBe('text-foreground')
  })

  it('turns amber in the 60–79% caution band', () => {
    expect(usageTextColorClass(60)).toBe('text-yellow-500')
    expect(usageTextColorClass(79)).toBe('text-yellow-500')
  })

  it('turns red at the 80% critical line and above', () => {
    expect(usageTextColorClass(80)).toBe('text-red-500')
    expect(usageTextColorClass(100)).toBe('text-red-500')
  })
})
