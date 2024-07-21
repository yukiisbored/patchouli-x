import { createTRPCReact } from '@trpc/react-query'
// @ts-ignore We need to import the ApiRouter type
import type { ApiRouter } from '../../server/api'

export const trpc = createTRPCReact<ApiRouter>()
