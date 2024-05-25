import { createTRPCReact } from '@trpc/react-query'
import type { ApiRouter } from '../../main/api'

export const trpc = createTRPCReact<ApiRouter>()
