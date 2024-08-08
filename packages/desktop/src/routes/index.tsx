import DocumentCard from '@/components/DocumentCard'
import ScrapeModal from '@/components/ScrapeModal'
import { trpc } from '@/trpc'
import {
  Button,
  Card,
  CardBody,
  Center,
  FormControl,
  HStack,
  IconButton,
  Input,
  Spinner,
  VStack,
  useDisclosure,
  Text,
  Stack,
  UnorderedList,
  ListItem,
  Link
} from '@chakra-ui/react'
import { IconMoodSad2, IconPlus } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useDeferredValue, useState } from 'react'
import { useEnsureConfigured } from '../utils'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  useEnsureConfigured()

  const utils = trpc.useUtils()
  const [term, setTerm] = useState('')
  const deferredTerm = useDeferredValue(term)
  const isStale = deferredTerm !== term

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.documents.byPage.useInfiniteQuery(
      {
        term: deferredTerm,
        pageSize: 25
      },
      {
        getNextPageParam: (page) => page.nextPage,
        initialCursor: 1,
        keepPreviousData: true
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

      {data ? (
        <VStack
          align="stretch"
          w={800}
          mx="auto"
          my={2}
          pb="32px"
          px={4}
          opacity={isStale ? 0.5 : 1}
        >
          {data.pages.map(({ page, items }) => (
            <Fragment key={page}>
              {items.map((doc) => (
                <DocumentCard key={doc.id} {...doc} />
              ))}
            </Fragment>
          ))}

          {!data.pages.reduce((acc, { items }) => acc + items.length, 0) ? (
            <Stack align="center" mt={16}>
              <IconMoodSad2 size={128} />
              <Text fontSize="4xl" fontWeight="bold">
                No results found
              </Text>
              <Text>It might be time to explore the Internet</Text>
              <UnorderedList mt={4} maxW={400}>
                <ListItem>
                  Try refining your search term or using different keywords. It
                  might be here somewhere.
                </ListItem>
                <ListItem>
                  Try searching what you're looking for with your favorite
                  search engine.
                </ListItem>
                <ListItem>
                  Need inspiration? Check out{' '}
                  <Link href="https://kagi.com/smallweb" textColor="brand.500">
                    Kagi Small Web
                  </Link>
                  .
                </ListItem>
              </UnorderedList>
            </Stack>
          ) : (
            <Button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
            >
              {isFetchingNextPage
                ? 'Loading more...'
                : hasNextPage
                  ? 'Load more'
                  : 'Nothing more'}
            </Button>
          )}
        </VStack>
      ) : (
        <Center flexGrow={1}>
          <Spinner />
        </Center>
      )}

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
            disabled={data === undefined}
          />
        </HStack>
      </Card>
    </VStack>
  )
}
