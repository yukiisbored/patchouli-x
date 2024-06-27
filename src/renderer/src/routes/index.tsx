import { createFileRoute } from '@tanstack/react-router'
import { trpc } from '@/trpc'
import {
  Button,
  Card,
  CardBody,
  FormControl,
  HStack,
  IconButton,
  Input,
  Spinner,
  VStack,
  useDisclosure
} from '@chakra-ui/react'
import DocumentCard from '@/components/DocumentCard'
import { IconPlus } from '@tabler/icons-react'
import ScrapeModal from '@/components/ScrapeModal'
import { Fragment, Suspense, useDeferredValue, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Index
})

function Index(): JSX.Element {
  const utils = trpc.useUtils()
  const [term, setTerm] = useState('')
  const deferredTerm = useDeferredValue(term)
  const isStale = deferredTerm !== term

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    trpc.documents.byPage.useInfiniteQuery(
      {
        term: deferredTerm,
        pageSize: 25
      },
      {
        getNextPageParam: (page) => page.nextPage,
        initialCursor: 1
      }
    )

  const { isOpen, onOpen, onClose } = useDisclosure()

  trpc.documents.onAdd.useSubscription(undefined, {
    onData: () => {
      utils.documents.invalidate()
    }
  })

  trpc.documents.onRemove.useSubscription(undefined, {
    onData: () => {
      utils.documents.invalidate()
    }
  })

  trpc.documents.onUpdate.useSubscription(undefined, {
    onData: () => {
      utils.documents.invalidate()
    }
  })

  return (
    <VStack align="stretch">
      <ScrapeModal isOpen={isOpen} onClose={onClose} />

      <Card position="sticky" top={0} zIndex={1} borderRadius={0}>
        <CardBody p={0}>
          <FormControl>
            <Input
              id="term"
              name="term"
              onChange={(e) => setTerm(e.currentTarget.value)}
              value={term}
              bg="white"
              size="lg"
              borderRadius={0}
              borderColor="white"
              placeholder="What's on your mind?"
              autoFocus
            />
          </FormControl>
        </CardBody>
      </Card>

      <Suspense fallback={<Spinner />}>
        <VStack
          align="stretch"
          w={800}
          mx="auto"
          my={2}
          pb="32px"
          px={4}
          opacity={isStale ? 0.5 : 1}
        >
          {status === 'success' && (
            <>
              {data.pages.map((page, i) => (
                <Fragment key={i}>
                  {page.items.map((doc) => (
                    <DocumentCard key={doc.id} {...doc} />
                  ))}
                </Fragment>
              ))}

              <Button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
                {isFetchingNextPage
                  ? 'Loading more...'
                  : hasNextPage
                    ? 'Load more'
                    : 'Nothing more'}
              </Button>
            </>
          )}
        </VStack>
      </Suspense>

      <Card
        position="fixed"
        width="100vw"
        h="32px"
        px={4}
        bottom={0}
        zIndex={1}
        borderRadius={0}
        variant="outline"
      >
        <HStack justify="end" align="center" h="100%">
          <IconButton
            variant="ghost"
            aria-label="Import from URL"
            size="xs"
            icon={<IconPlus />}
            onClick={onOpen}
          />
        </HStack>
      </Card>
    </VStack>
  )
}
