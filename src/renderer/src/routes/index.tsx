import { createFileRoute } from '@tanstack/react-router'
import { trpc } from '@/trpc'
import { VStack } from '@chakra-ui/react'
import DocumentCard from '@/components/DocumentCard'

export const Route = createFileRoute('/')({
  component: Index
})

function Index(): JSX.Element {
  const utils = trpc.useUtils()
  const { data, error, status } = trpc.documents.byPage.useQuery({ page: 1, pageSize: 25 })

  trpc.documents.onAdd.useSubscription(undefined, {
    onData: () => {
      utils.documents.invalidate()
    }
  })

  if (error) {
    return <p>{error.message}</p>
  }

  if (status !== 'success') {
    return <p>Loading...</p>
  }

  return (
    <VStack align="stretch" maxW={800}>
      {data.map((i) => (
        <DocumentCard key={i.id} {...i} />
      ))}
    </VStack>
  )
}
