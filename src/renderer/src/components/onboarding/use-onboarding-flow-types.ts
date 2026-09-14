export type StepNumber = 1 | 2 | 3 | 4 | 5
export type StepId = 'agent' | 'theme' | 'integrations' | 'windows_terminal' | 'notifications'

export const STEPS: readonly {
  id: StepId
  stepNumber: StepNumber
}[] = [
  { id: 'agent', stepNumber: 1 },
  { id: 'theme', stepNumber: 2 },
  { id: 'integrations', stepNumber: 3 },
  { id: 'windows_terminal', stepNumber: 4 },
  { id: 'notifications', stepNumber: 5 }
]
