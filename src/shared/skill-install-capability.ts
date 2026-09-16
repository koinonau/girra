/** Why capability-gated rather than Rule 1: `skills.delete` is a new RPC method,
 *  and an old host answers method-not-found, which surfaces as an unexplained
 *  failure instead of a disabled action with a reason. */
export const SKILL_DELETE_CAPABILITY = 'skills.delete.v1' as const

export const SKILL_DELETE_UPDATE_REQUIRED_MESSAGE =
  'Update Girra on the selected machine to delete skills.'
