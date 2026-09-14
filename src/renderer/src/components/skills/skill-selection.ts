import type { DiscoveredSkill } from '../../../../shared/skills'

/** The range/select-all/retain-across-rescan logic behind skill selection. */
export type SkillSelectionPolicy = {
  isEligible: (skill: DiscoveredSkill) => boolean
  maxSelection?: number
}

/** How many rows "Select all" would end up holding. */
export function eligibleSkillSelectionCount(
  results: readonly DiscoveredSkill[],
  policy: SkillSelectionPolicy
): number {
  const count = results.filter(policy.isEligible).length
  return policy.maxSelection === undefined ? count : Math.min(count, policy.maxSelection)
}

/** Used by both select-all and shift-range. */
export function addSelectableSkillResults(
  current: ReadonlySet<string>,
  results: readonly DiscoveredSkill[],
  policy: SkillSelectionPolicy
): Set<string> {
  const next = new Set(current)
  for (const skill of results) {
    if (policy.maxSelection !== undefined && next.size >= policy.maxSelection) {
      break
    }
    if (policy.isEligible(skill)) {
      next.add(skill.id)
    }
  }
  return next
}

/** Rebuilds the selection from a fresh scan, dropping rows that vanished or
 *  became ineligible. Returns the same reference when nothing changed. */
export function retainedSkillSelection(
  current: Set<string>,
  skills: readonly DiscoveredSkill[],
  policy: SkillSelectionPolicy
): Set<string> {
  const next = new Set<string>()
  for (const skill of skills) {
    if (current.has(skill.id) && policy.isEligible(skill)) {
      next.add(skill.id)
    }
  }
  return next.size === current.size ? current : next
}

export function updatedSkillSelection(
  current: ReadonlySet<string>,
  skillId: string,
  selected: boolean,
  maxSelection?: number
): Set<string> {
  const next = new Set(current)
  if (selected && (maxSelection === undefined || next.size < maxSelection)) {
    next.add(skillId)
  } else {
    next.delete(skillId)
  }
  return next
}
