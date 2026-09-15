import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { EyeOff } from 'lucide-react'
import {
  getFirstIncompleteSetupGuideStepId,
  getSetupGuideSteps,
  isSetupGuideStepId
} from '../../../../shared/setup-guide-steps'
import type { SetupGuideStepId } from '../../../../shared/setup-guide-steps'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { SetupGuideChecklist } from './SetupGuideChecklist'
import { SetupGuideProgressRing } from './SetupGuideProgressRing'
import { useSetupGuideProgress } from './use-setup-guide-progress'
import { translate } from '@/i18n/i18n'

const SETUP_GUIDE_CLOSE_LINGER_MS = 300

export default function SetupGuideModal(): JSX.Element | null {
  const open = useAppStore((s) => s.activeModal === 'setup-guide')
  const [lingering, setLingering] = useState(open)
  useEffect(() => {
    if (open) {
      setLingering(true)
      return
    }
    const timer = window.setTimeout(() => setLingering(false), SETUP_GUIDE_CLOSE_LINGER_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open && !lingering) {
    return null
  }
  return <SetupGuideModalContent open={open} lingering={lingering} />
}

function SetupGuideModalContent({
  open,
  lingering
}: {
  open: boolean
  lingering: boolean
}): JSX.Element {
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const setSetupGuideSidebarDismissed = useAppStore((s) => s.setSetupGuideSidebarDismissed)
  const setupSteps = useMemo(() => getSetupGuideSteps(), [])
  const [userSelectedStep, setUserSelectedStep] = useState(false)
  const [orchestrationSkillInstalled, setOrchestrationSkillInstalled] = useState(false)
  const [browserUseSkillInstalled, setBrowserUseSkillInstalled] = useState(false)
  // Why: keep progress inputs live through the close-animation linger; dropping
  // them mid-fade flips completed rows back to "not done yet" on screen.
  const progressInputsActive = open || lingering
  const progress = useSetupGuideProgress(
    progressInputsActive,
    orchestrationSkillInstalled,
    browserUseSkillInstalled
  )
  const [activeStepId, setActiveStepId] = useState<SetupGuideStepId>(() =>
    getFirstIncompleteSetupGuideStepId(progress.stepDone)
  )
  const requestedStepId = isSetupGuideStepId(modalData.setupStepId) ? modalData.setupStepId : null
  const activeStep = setupSteps.find((step) => step.id === activeStepId) ?? setupSteps[0] ?? null

  useEffect(() => {
    if (!open) {
      setUserSelectedStep(false)
      return
    }
    if (requestedStepId === null) {
      return
    }
    setUserSelectedStep(false)
    setActiveStepId(requestedStepId)
  }, [open, requestedStepId])

  useEffect(() => {
    if (!open || userSelectedStep || requestedStepId !== null) {
      return
    }
    setActiveStepId(getFirstIncompleteSetupGuideStepId(progress.stepDone))
  }, [open, progress.stepDone, requestedStepId, userSelectedStep])

  useEffect(() => {
    if (
      !open ||
      userSelectedStep ||
      requestedStepId === null ||
      activeStep?.id !== requestedStepId ||
      !progress.stepDone[activeStep.id]
    ) {
      return
    }
    const nextUnfinishedCoreStepId = getFirstIncompleteSetupGuideStepId(progress.stepDone)
    if (nextUnfinishedCoreStepId !== activeStep.id) {
      setActiveStepId(nextUnfinishedCoreStepId)
    }
  }, [activeStep, open, progress.stepDone, requestedStepId, userSelectedStep])

  const handleSelectStep = (id: SetupGuideStepId): void => {
    setUserSelectedStep(true)
    setActiveStepId(id)
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      closeModal()
    }
  }

  const handleHideFromSidebar = useCallback((): void => {
    setSetupGuideSidebarDismissed(true)
  }, [setSetupGuideSidebarDismissed])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="grid h-[min(780px,calc(100vh-2rem))] w-[min(1080px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-none"
        tabIndex={-1}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate(
                'auto.components.setup.guide.SetupGuideModal.f3b5ffb2a6',
                'Hide checklist from sidebar'
              )}
              onClick={handleHideFromSidebar}
              className="absolute right-10 top-3.5 text-muted-foreground"
            >
              <EyeOff className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate(
              'auto.components.setup.guide.SetupGuideModal.28cf59fcb4',
              'This will hide the checklist from the sidebar'
            )}
          </TooltipContent>
        </Tooltip>
        <DialogHeader className="gap-1 border-b border-border px-7 py-4">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg">
              {translate(
                'auto.components.setup.guide.SetupGuideModal.48a9e5ef2d',
                'Getting started'
              )}
            </DialogTitle>
            <SetupGuideProgressRing
              done={progress.coreDoneCount}
              total={progress.coreTotal}
              className="text-green-600 dark:text-green-300"
              sizeClassName="size-5"
            />
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {translate(
              'auto.components.setup.guide.SetupGuideModal.3598a3ca0c',
              'Finish the core workflows that make Orca useful for parallel agent work.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-hidden px-7 py-6">
          <SetupGuideChecklist
            activeStep={activeStep}
            progress={progress}
            onSelectStep={handleSelectStep}
            onOrchestrationSkillInstalledChange={setOrchestrationSkillInstalled}
            onBrowserUseSkillInstalledChange={setBrowserUseSkillInstalled}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
