import { createTRPCReact } from '@trpc/react-query'
import type { ApiRouter } from '@patchouli-app/backend/src/api'

export const trpc = createTRPCReact<ApiRouter>()
