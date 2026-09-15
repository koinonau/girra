export type SetupGuideStepId =
  | 'default-agent'
  | 'add-two-repos'
  | 'notifications'
  | 'two-worktrees'
  | 'browser'
  | 'task-sources'
  | 'agent-capabilities'
  | 'setup-script'

export type SetupGuideStep = {
  readonly id: SetupGuideStepId
  readonly name: string
  readonly subtitle: string
  readonly description: string
}

export const SETUP_GUIDE_PARALLEL_WORK_STEP_IDS = [
  'two-worktrees',
  'browser'
] as const satisfies readonly SetupGuideStepId[]

export type SetupGuideSectionId = 'parallel-work' | 'setup'

export const SETUP_GUIDE_STEPS: readonly SetupGuideStep[] = [
  {
    id: 'two-worktrees',
    name: 'Multi-task',
    subtitle: 'Multi-task',
    description:
      'Work in 2 different worktrees at once. Each one is isolated (even in the same project). Perfect for working on 2 features at once.'
  },
  {
    id: 'browser',
    name: "Use Orca's browser",
    subtitle: "Use Orca's browser",
    description:
      'Browse your web app without leaving Orca. Grab any element and send its exact source and styles to an agent with one click.'
  },
  {
    id: 'notifications',
    name: 'Turn on notifications',
    subtitle: 'Turn on notifications',
    description: 'Know the moment an agent finishes, needs attention, or gets blocked.'
  },
  {
    id: 'default-agent',
    name: 'Choose your default agent',
    subtitle: 'Choose your default agent',
    description: 'Start new work faster with your preferred agent already selected.'
  },
  {
    id: 'agent-capabilities',
    name: 'Enable Orca CLI',
    subtitle: 'Enable Orca CLI',
    description:
      'Register the Orca shell command and install agent skills for browser, computer, and orchestration workflows.'
  },
  {
    id: 'task-sources',
    name: 'Connect integrations',
    subtitle: 'Connect integrations',
    description: 'Start an agent from a task in one click and keep PR status in view.'
  },
  {
    id: 'setup-script',
    name: 'Automate workspace setup',
    subtitle: 'Automate workspace setup',
    description:
      'Run install and setup commands automatically so every new worktree is ready for agents.'
  },
  {
    id: 'add-two-repos',
    name: 'Start work in multiple repos',
    subtitle: 'Start work in multiple repos',
    description:
      'Bring your key repos into Orca so you can start agent work without hunting for folders.'
  }
] as const

export const SETUP_GUIDE_STEP_IDS = SETUP_GUIDE_STEPS.map((step) => step.id)

export function getSetupGuideSteps(): readonly SetupGuideStep[] {
  return SETUP_GUIDE_STEPS
}

export function getSetupGuideSectionId(stepId: SetupGuideStepId): SetupGuideSectionId {
  return SETUP_GUIDE_PARALLEL_WORK_STEP_IDS.includes(
    stepId as (typeof SETUP_GUIDE_PARALLEL_WORK_STEP_IDS)[number]
  )
    ? 'parallel-work'
    : 'setup'
}

export function getSetupGuideStepsForSection(
  sectionId: SetupGuideSectionId
): readonly SetupGuideStep[] {
  return SETUP_GUIDE_STEPS.filter((step) => getSetupGuideSectionId(step.id) === sectionId)
}

export function getFirstIncompleteSetupGuideStepId(
  stepDone: Partial<Record<SetupGuideStepId, boolean>>
): SetupGuideStepId {
  // Why: the checklist should prioritize Setup, while durable definitions retain the original order.
  const setupStep = getSetupGuideStepsForSection('setup').find((step) => !stepDone[step.id])
  if (setupStep) {
    return setupStep.id
  }
  const parallelStep = getSetupGuideStepsForSection('parallel-work').find(
    (step) => !stepDone[step.id]
  )
  return parallelStep?.id ?? SETUP_GUIDE_STEPS[0].id
}

export function isSetupGuideStepId(value: unknown): value is SetupGuideStepId {
  return typeof value === 'string' && SETUP_GUIDE_STEP_IDS.includes(value as SetupGuideStepId)
}
