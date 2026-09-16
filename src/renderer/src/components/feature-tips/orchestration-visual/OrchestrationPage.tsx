/* oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Why: this page is a timed storyboard; row state resets are part of replaying the animation loop. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { ChevronDown, Workflow } from 'lucide-react'
import { ClaudeIcon } from '@/components/status-bar/icons'
import { OpenCodeIcon } from '@/lib/agent-icon-glyphs'
import {
  BUBBLE_FLIGHT_MS,
  BUBBLE_GAP_MS,
  BUBBLE_LAND_MS,
  INITIAL_ROW_MESSAGES,
  INITIAL_ROW_STATE,
  ORCHESTRATION_CLI_COMMAND_TIMINGS_MS,
  PHASE1_BEATS,
  type AgentKey,
  type Beat,
  type RowFlash,
  type RowMessages,
  type RowPending,
  type RowState
} from './orchestration-types'
import { arrowPathFromCoordTo, bubblePathBetweenRows } from './orchestration-bubble-path'
import { AgentRow, WorkspaceCard } from './orchestration-cards'
import { translate } from '@/i18n/i18n'

// Children start pending (no agent row visible) and reveal as the orchestrator
// dispatches a message to them. This mirrors the "agents arrive when assigned"
// reading the design wants.
const INITIAL_CHILD_PENDING: RowPending = {
  'child-opencode': true,
  'child-claude': true
}

const CHILD_ONE_CREATE_MS = ORCHESTRATION_CLI_COMMAND_TIMINGS_MS[0]
const CHILD_TWO_CREATE_MS = ORCHESTRATION_CLI_COMMAND_TIMINGS_MS[1]
const FIRST_DISPATCH_MS = ORCHESTRATION_CLI_COMMAND_TIMINGS_MS[2]

export function OrchestrationPage(props: {
  reducedMotion: boolean
  controlledCreatedChildCount?: number
  loopMs?: number
  showResponseBeats?: boolean
}): JSX.Element {
  const { reducedMotion, controlledCreatedChildCount, loopMs, showResponseBeats = true } = props
  const stageRef = useRef<HTMLDivElement | null>(null)
  const arrowsRef = useRef<SVGSVGElement | null>(null)
  const bubbleLayerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Partial<Record<AgentKey, HTMLDivElement | null>>>({})
  const childCountControlledRef = useRef(controlledCreatedChildCount !== undefined)

  const [rowState, setRowState] = useState<RowState>(INITIAL_ROW_STATE)
  const [rowMessages, setRowMessages] = useState<RowMessages>(INITIAL_ROW_MESSAGES)
  const [rowFlash, setRowFlash] = useState<RowFlash>({})
  const [rowPending, setRowPending] = useState<RowPending>(INITIAL_CHILD_PENDING)
  const [createdChildCount, setCreatedChildCount] = useState(0)
  const displayedChildCount = controlledCreatedChildCount ?? createdChildCount

  // Why: bubbles measure the recipient row at fire-time, so the pending flag
  // has to flip *before* the path is computed. React state updates are async,
  // so keep a synchronous mirror to flip styles immediately.
  const pendingMirror = useRef<RowPending>({ ...INITIAL_CHILD_PENDING })

  childCountControlledRef.current = controlledCreatedChildCount !== undefined

  const drawArrow = useCallback((): void => {
    const arrows = arrowsRef.current
    const stage = stageRef.current
    if (!arrows || !stage) {
      return
    }
    arrows.removeAttribute('data-fading')
    const stageRect = stage.getBoundingClientRect()
    arrows.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`)
    arrows.setAttribute('width', String(stageRect.width))
    arrows.setAttribute('height', String(stageRect.height))
    const coordEl = stage.querySelector('[data-orchestration-card="coord"]')
    if (!(coordEl instanceof HTMLElement)) {
      arrows.innerHTML = ''
      return
    }
    const openCodeEl = stage.querySelector('[data-orchestration-card="child"]')
    const claudeEl = stage.querySelector('[data-orchestration-card="child-claude"]')
    const paths: string[] = []
    if (openCodeEl instanceof HTMLElement) {
      paths.push(arrowPathFromCoordTo(coordEl, openCodeEl, stageRect))
    }
    if (claudeEl instanceof HTMLElement) {
      paths.push(arrowPathFromCoordTo(coordEl, claudeEl, stageRect))
    }
    arrows.innerHTML = paths.map((d) => `<path d="${d}"/>`).join('')
  }, [])

  useEffect(() => {
    if (displayedChildCount >= 2) {
      const frameId = requestAnimationFrame(() => drawArrow())
      return () => cancelAnimationFrame(frameId)
    }
    return undefined
  }, [displayedChildCount, drawArrow])

  useEffect(() => {
    if (reducedMotion) {
      // Static state: parent + both children visible, mid-task. No bubbles —
      // the lineage chip and nesting convey parentage.
      setRowState(INITIAL_ROW_STATE)
      setRowMessages(INITIAL_ROW_MESSAGES)
      setRowPending({})
      setCreatedChildCount(2)
      pendingMirror.current = {}
      const frameId = requestAnimationFrame(() => drawArrow())
      return () => cancelAnimationFrame(frameId)
    }

    let cancelled = false
    const timeouts: number[] = []
    const frames = new Set<number>()
    const later = (fn: () => void, ms: number): void => {
      timeouts.push(window.setTimeout(() => !cancelled && fn(), ms))
    }
    const nextFrame = (fn: () => void): void => {
      const frameId = requestAnimationFrame(() => {
        frames.delete(frameId)
        if (!cancelled) {
          fn()
        }
      })
      frames.add(frameId)
    }

    const clearArrows = (): void => {
      const arrows = arrowsRef.current
      if (arrows) {
        arrows.innerHTML = ''
      }
    }

    const fireBubble = (beat: Beat): void => {
      const fromRow = rowRefs.current[beat.from]
      const toRow = rowRefs.current[beat.to]
      const stage = stageRef.current
      const layer = bubbleLayerRef.current
      if (!fromRow || !toRow || !stage || !layer) {
        return
      }

      if (beat.senderFinishes) {
        setRowState((s) => ({ ...s, [beat.from]: 'done' }))
      }

      // The bubble needs a real geometry target. If the recipient row is
      // still pending (collapsed), aim the bubble at its parent card center
      // — the row itself reveals only when the bubble lands.
      const wasPending = pendingMirror.current[beat.to] === true
      const targetForPath: HTMLElement = wasPending
        ? ((toRow.closest('[data-orchestration-card]') as HTMLElement | null) ?? toRow)
        : toRow

      const path = bubblePathBetweenRows(stage, fromRow, targetForPath)
      const bubble = document.createElement('div')
      bubble.className = 'orchestration-visual-bubble'
      bubble.style.offsetPath = `path("${path}")`
      bubble.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden>' +
        '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
        '<path d="M3 7l9 6 9-6"/></svg>'
      layer.appendChild(bubble)
      void bubble.offsetWidth
      nextFrame(() => bubble.classList.add('in-flight'))

      later(() => {
        // Reveal the recipient agent on landing — that's the moment work
        // "arrives" at the child workspace.
        if (wasPending) {
          pendingMirror.current = { ...pendingMirror.current, [beat.to]: false }
          setRowPending((p) => ({ ...p, [beat.to]: false }))
        }
        const replacement =
          beat.to === 'coord-claude' && beat.coordMsg ? beat.coordMsg : (beat.recipientMsg ?? '')
        if (replacement) {
          setRowMessages((m) => ({ ...m, [beat.to]: replacement }))
          setRowFlash((f) => ({ ...f, [beat.to]: (f[beat.to] ?? 0) + 1 }))
        }
        bubble.classList.remove('in-flight')
        bubble.classList.add('landed')
      }, BUBBLE_FLIGHT_MS)

      later(() => bubble.remove(), BUBBLE_LAND_MS)
    }

    const runOnce = (done: () => void): void => {
      clearArrows()
      setRowState(INITIAL_ROW_STATE)
      setRowMessages(INITIAL_ROW_MESSAGES)
      setRowPending(INITIAL_CHILD_PENDING)
      setCreatedChildCount(0)
      pendingMirror.current = { ...INITIAL_CHILD_PENDING }
      if (!childCountControlledRef.current) {
        // Reveal each child workspace when the matching shell command appears,
        // so the CLI tip reads as Claude driving the exact Girra workflow shown.
        later(() => {
          setCreatedChildCount(1)
        }, CHILD_ONE_CREATE_MS)
        later(() => {
          setCreatedChildCount(2)
          later(() => drawArrow(), 360)
        }, CHILD_TWO_CREATE_MS)
      }
      const beats = showResponseBeats ? PHASE1_BEATS : PHASE1_BEATS.slice(0, 2)
      let beatIdx = 0
      const next = (): void => {
        if (beatIdx >= beats.length) {
          later(done, 800)
          return
        }
        fireBubble(beats[beatIdx])
        beatIdx += 1
        later(next, BUBBLE_GAP_MS)
      }
      later(next, FIRST_DISPATCH_MS)
    }

    const loop = (): void => {
      runOnce(() => {
        const beatCount = showResponseBeats ? PHASE1_BEATS.length : 2
        const elapsedMs = FIRST_DISPATCH_MS + beatCount * BUBBLE_GAP_MS + 800
        later(loop, loopMs ? Math.max(0, loopMs - elapsedMs) : 1400)
      })
    }

    loop()

    const onResize = (): void => drawArrow()
    window.addEventListener('resize', onResize)

    const cleanupLayer = bubbleLayerRef.current
    return () => {
      cancelled = true
      timeouts.forEach((id) => window.clearTimeout(id))
      frames.forEach((id) => cancelAnimationFrame(id))
      frames.clear()
      window.removeEventListener('resize', onResize)
      if (cleanupLayer) {
        cleanupLayer.innerHTML = ''
      }
    }
  }, [reducedMotion, drawArrow, loopMs, showResponseBeats])

  return (
    <div
      ref={stageRef}
      className="orchestration-visual-stage relative grid"
      style={{
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridAutoRows: 'min-content',
        rowGap: 28,
        paddingRight: 56,
        alignItems: 'start',
        alignContent: 'center',
        height: '100%'
      }}
    >
      <div className="relative flex min-w-0 flex-col gap-1.5">
        <WorkspaceCard
          variant="coordinator"
          name={translate(
            'auto.components.feature.wall.agents.orchestration.OrchestrationPage.coordinatorName',
            'redesign auth flow'
          )}
          dataCard="coord"
          rows={[
            <AgentRow
              key="coord-claude"
              agentKey="coord-claude"
              icon={<ClaudeIcon size={13} />}
              state={rowState['coord-claude']}
              message={rowMessages['coord-claude']}
              flashKey={rowFlash['coord-claude'] ?? 0}
              registerRef={(node) => {
                rowRefs.current['coord-claude'] = node
              }}
            />
          ]}
        />

        <div
          className="flex justify-start"
          style={{
            marginLeft: 'var(--orchestration-visual-child-indent, 28px)',
            marginTop: 0,
            marginBottom: 0
          }}
        >
          <span
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 text-muted-foreground"
            style={{ height: 18, fontSize: 10, fontWeight: 500 }}
            aria-label={translate(
              'auto.components.feature.wall.agents.orchestration.OrchestrationPage.862605d066',
              '2 child workspaces'
            )}
          >
            <Workflow className="size-2.5" aria-hidden />
            <span className="truncate">
              {translate(
                'auto.components.feature.wall.agents.orchestration.OrchestrationPage.30b509a467',
                '2 children'
              )}
            </span>
            <ChevronDown className="size-2.5" aria-hidden />
          </span>
        </div>

        <div
          className="orchestration-visual-children-wrapper"
          data-visible={displayedChildCount > 0 ? 'true' : undefined}
          style={{
            width: 'calc(100% - var(--orchestration-visual-child-indent, 28px))',
            marginLeft: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {displayedChildCount >= 1 ? (
            <div className="orchestration-visual-child-card-shell">
              <WorkspaceCard
                variant="default"
                name={translate(
                  'auto.components.feature.wall.agents.orchestration.OrchestrationPage.childPr1Name',
                  'PR 1/2: migrate users.sql'
                )}
                dataCard="child"
                childPadding
                rows={[
                  <AgentRow
                    key="child-opencode"
                    agentKey="child-opencode"
                    icon={<OpenCodeIcon size={13} />}
                    state={rowState['child-opencode']}
                    message={rowMessages['child-opencode']}
                    flashKey={rowFlash['child-opencode'] ?? 0}
                    pending={rowPending['child-opencode']}
                    spawnRow
                    registerRef={(node) => {
                      rowRefs.current['child-opencode'] = node
                    }}
                  />
                ]}
              />
            </div>
          ) : null}
          {displayedChildCount >= 2 ? (
            <div className="orchestration-visual-child-card-shell">
              <WorkspaceCard
                variant="default"
                name={translate(
                  'auto.components.feature.wall.agents.orchestration.OrchestrationPage.childPr2Name',
                  'PR 2/2: withSession middleware'
                )}
                dataCard="child-claude"
                childPadding
                rows={[
                  <AgentRow
                    key="child-claude"
                    agentKey="child-claude"
                    icon={<ClaudeIcon size={13} />}
                    state={rowState['child-claude']}
                    message={rowMessages['child-claude']}
                    flashKey={rowFlash['child-claude'] ?? 0}
                    pending={rowPending['child-claude']}
                    spawnRow
                    registerRef={(node) => {
                      rowRefs.current['child-claude'] = node
                    }}
                  />
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>

      <svg
        ref={arrowsRef}
        className="orchestration-visual-arrows"
        aria-hidden
        preserveAspectRatio="none"
      />
      <div
        ref={bubbleLayerRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
      />
    </div>
  )
}
