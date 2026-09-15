import { describe, expect, it } from 'vitest'
import { resolvePaneRendererPolicy } from './terminal-renderer-policy'

describe('resolvePaneRendererPolicy', () => {
  describe('user GPU modes', () => {
    it('keeps the content gate open under `off`', () => {
      // Why: the mode gate downstream forces DOM; the gate stays open so a later
      // switch to auto/on can re-attach without waiting for a new title frame.
      expect(resolvePaneRendererPolicy({ userGpuMode: 'off' })).toEqual({
        gpuEnabled: true,
        reason: 'user-setting'
      })
    })

    it('enables GPU under `on`', () => {
      expect(resolvePaneRendererPolicy({ userGpuMode: 'on' })).toEqual({
        gpuEnabled: true,
        reason: 'user-setting'
      })
    })

    it('enables GPU under `auto`', () => {
      expect(resolvePaneRendererPolicy({ userGpuMode: 'auto' })).toEqual({
        gpuEnabled: true,
        reason: 'capability'
      })
    })
  })

  describe('WebGL capability and context-loss containment', () => {
    it('disables GPU under `on` when WebGL is unavailable', () => {
      expect(resolvePaneRendererPolicy({ userGpuMode: 'on', webglUnavailable: true })).toEqual({
        gpuEnabled: false,
        reason: 'capability'
      })
    })

    it('disables GPU under `on` inside context-loss containment', () => {
      expect(
        resolvePaneRendererPolicy({ userGpuMode: 'on', inContextLossContainment: true })
      ).toEqual({ gpuEnabled: false, reason: 'context-loss' })
    })

    it('disables GPU under `auto` inside context-loss containment', () => {
      expect(
        resolvePaneRendererPolicy({ userGpuMode: 'auto', inContextLossContainment: true })
      ).toEqual({ gpuEnabled: false, reason: 'context-loss' })
    })
  })
})
