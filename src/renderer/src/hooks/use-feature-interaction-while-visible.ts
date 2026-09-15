import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { FeatureInteractionId } from '../../../shared/feature-interactions'

/** Records `id` each time `visible` turns true, deferring until persisted UI hydrates. */
export function useFeatureInteractionWhileVisible(
  id: FeatureInteractionId,
  visible: boolean
): void {
  const persistedUIReady = useAppStore((s) => s.persistedUIReady)
  useEffect(() => {
    if (visible && persistedUIReady) {
      void useAppStore.getState().recordFeatureInteraction(id)
    }
  }, [id, persistedUIReady, visible])
}
