import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const TerminalHandle = z.object({ terminal: requiredString('Missing terminal handle') })

export const TerminalMultiplex = z.object({})
