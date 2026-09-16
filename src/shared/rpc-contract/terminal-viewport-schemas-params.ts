import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const TerminalHandle = z.object({ terminal: requiredString('Missing terminal handle') })

// Why: in-place update avoids an unsubscribe/resubscribe that flashed the lock banner and stranded the PTY at the viewer's dims.
export const TerminalUpdateViewport = TerminalHandle.extend({
  client: z.object({
    id: requiredString('Missing client ID'),
    type: z.literal('desktop').default('desktop').optional()
  }),
  viewport: z.object({
    cols: z.number().int().min(20).max(240),
    rows: z.number().int().min(8).max(120)
  }),
  claim: z.boolean().optional()
})
