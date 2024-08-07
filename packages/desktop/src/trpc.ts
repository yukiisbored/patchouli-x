import type { ApiRouter } from '@patchouli-app/backend/src/api'
import { createTRPCReact } from '@trpc/react-query'

export const trpc = createTRPCReact<ApiRouter>()
