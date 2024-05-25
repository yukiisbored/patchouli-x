import { ipcLink } from 'electron-trpc/renderer'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc } from './trpc'
import Hello from './Hello'

export default function App(): JSX.Element {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [ipcLink()]
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Hello />
      </QueryClientProvider>
    </trpc.Provider>
  )
}
