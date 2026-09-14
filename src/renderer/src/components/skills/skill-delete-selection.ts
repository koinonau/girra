import type { DiscoveredSkill } from '../../../../shared/skills'
import { MAX_SKILL_DELETE_BATCH } from '../../../../shared/skill-delete-contract'
import { skillDeletionEligibility } from '../../../../shared/skill-deletion-eligibility'
import { skillDeleteBlockReasonLabel } from './skill-delete-copy'
import {
  addSelectableSkillResults,
  eligibleSkillSelectionCount,
  retainedSkillSelection,
  type SkillSelectionPolicy
} from './skill-selection'

const DELETE_SELECTION_POLICY: SkillSelectionPolicy = {
  isEligible: (skill) => skillDeletionEligibility(skill).deletable,
  maxSelection: MAX_SKILL_DELETE_BATCH
}

export function isSkillDeleteEligible(skill: DiscoveredSkill): boolean {
  return DELETE_SELECTION_POLICY.isEligible(skill)
}

/** Advisory client-side reason. The host re-derives the verdict from the
 *  placement set and can refuse a row this reports as deletable. */
export function skillDeleteEligibilityReason(skill: DiscoveredSkill): string | null {
  const eligibility = skillDeletionEligibility(skill)
  return eligibility.deletable ? null : skillDeleteBlockReasonLabel(eligibility.reason)
}

export function eligibleDeleteSkillCount(results: readonly DiscoveredSkill[]): number {
  return eligibleSkillSelectionCount(results, DELETE_SELECTION_POLICY)
}

export function addDeletableSkillResults(
  current: ReadonlySet<string>,
  results: readonly DiscoveredSkill[]
): Set<string> {
  return addSelectableSkillResults(current, results, DELETE_SELECTION_POLICY)
}

export function retainedDeletableSkillSelection(
  current: Set<string>,
  skills: readonly DiscoveredSkill[]
): Set<string> {
  return retainedSkillSelection(current, skills, DELETE_SELECTION_POLICY)
}
