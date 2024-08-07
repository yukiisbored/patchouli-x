import { trpc } from '@/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createHashHistory,
  createRouter
} from '@tanstack/react-router'
import { useState } from 'react'

import { pipeLink } from '@/pipeLink.ts'
import { routeTree } from '@/routeTree.gen'
import { isDev } from '@/utils.ts'
import { httpBatchLink } from '@trpc/client'

const history = createHashHistory()
const router = createRouter({ routeTree, history })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: isDev()
        ? [
            httpBatchLink({
              url: 'http://localhost:2022'
            })
          ]
        : [pipeLink()]
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  )
}
