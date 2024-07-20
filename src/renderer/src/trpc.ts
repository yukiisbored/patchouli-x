import { createTRPCReact } from '@trpc/react-query'
import type { ApiRouter } from '../../main/server/api'

export const trpc = createTRPCReact<ApiRouter>()
