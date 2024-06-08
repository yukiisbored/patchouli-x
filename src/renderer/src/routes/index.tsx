import { createFileRoute } from '@tanstack/react-router'
import { trpc } from '@/trpc'
import { Card, CardBody, FormControl, Input, VStack } from '@chakra-ui/react'
import DocumentCard from '@/components/DocumentCard'
import { useFormik } from 'formik'

export const Route = createFileRoute('/')({
  component: Index
})

function Index(): JSX.Element {
  const utils = trpc.useUtils()
  const {
    handleSubmit,
    handleChange,
    values: { term }
  } = useFormik({ initialValues: { term: '' }, onSubmit: () => {} })
  const { data, status } = trpc.documents.byPage.useQuery({ term, page: 1, pageSize: 25 })

  trpc.documents.onAdd.useSubscription(undefined, {
    onData: () => {
      utils.documents.invalidate()
    }
  })

  return (
    <VStack align="stretch" maxW={800}>
      <Card>
        <CardBody p={0}>
          <form onSubmit={handleSubmit}>
            <FormControl>
              <Input
                id="term"
                name="term"
                onChange={handleChange}
                value={term}
                bg="white"
                size="lg"
                placeholder="What's on your mind?"
              />
            </FormControl>
          </form>
        </CardBody>
      </Card>
      {status === 'success' && data.map((i) => <DocumentCard key={i.id} {...i} />)}
    </VStack>
  )
}
