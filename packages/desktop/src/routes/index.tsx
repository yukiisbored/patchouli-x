import DocumentCard from '@/components/DocumentCard'
import { trpc } from '@/trpc'
import {
  Button,
  Card,
  CardBody,
  FormControl,
  HStack,
  Input,
  Kbd,
  Link,
  ListItem,
  Spinner,
  Stack,
  Text,
  UnorderedList,
  VStack,
  useToast
} from '@chakra-ui/react'
import { IconMoodSad2, IconMoodWink } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useCallback, useDeferredValue, useState } from 'react'
import { isUrl as isUrlFn, useEnsureConfigured } from '../utils'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  useEnsureConfigured()

  const toast = useToast()
  const utils = trpc.useUtils()
  const [term, setTerm] = useState('')
  const deferredTerm = useDeferredValue(term)
  const isUrl = isUrlFn(deferredTerm)
  const isStale = deferredTerm !== term

  const addURLMutation = trpc.documents.fromUrl.useMutation()
  const addURL = useCallback(async () => {
    if (isUrl) {
      try {
        await addURLMutation.mutateAsync({ url: deferredTerm })
        toast({
          title: 'Link added',
          status: 'success'
        })
        setTerm('')
      } catch {
        toast({
          title: 'Failed to add link',
          description: 'It appears the link is unreachable.',
          status: 'error'
        })
      }
    }
  }, [deferredTerm, isUrl, addURLMutation.mutateAsync, toast])

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
    <VStack align="stretch" gap={0}>
      <Card position="sticky" top={0} zIndex={1} borderRadius={0} height="48px">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addURL()
                }
              }}
              focusBorderColor="white"
            />
          </FormControl>
        </CardBody>
      </Card>

      {data ? (
        <VStack
          align="center"
          mx="auto"
          pb="32px"
          py={{
            base: 2,
            md: 4
          }}
          px={{
            base: 2,
            md: 4
          }}
          opacity={isStale ? 0.5 : 1}
          overflowY="auto"
          w="100vw"
          maxH="calc(100vh - 48px)"
        >
          {isUrl && (
            <Card
              direction="row"
              overflow="hidden"
              flexShrink={0}
              w={{ base: '100%', md: '48em' }}
            >
              <CardBody>
                <Stack direction="row">
                  <IconMoodWink size={24} />
                  <Text>
                    We detected a link, press <Kbd>Enter</Kbd> to add it to your
                    vault.
                  </Text>
                </Stack>
              </CardBody>
            </Card>
          )}
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
                {deferredTerm ? 'No results found' : 'Your vault is empty'}
              </Text>
              <Text>It might be time to explore the Internet</Text>
              <UnorderedList mt={4} maxW={400}>
                {deferredTerm ? (
                  <ListItem>
                    Try refining your search term or using different keywords.
                    It might be here somewhere.
                  </ListItem>
                ) : (
                  <ListItem>
                    Add your first link by copy-pasting it to the search bar
                    above and press <Kbd>Enter</Kbd>.
                  </ListItem>
                )}
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
              w={{
                base: '100%',
                md: '48em'
              }}
              flexShrink={0}
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
        <VStack mt={16}>
          <HStack gap={4}>
            <Spinner
              size="xl"
              emptyColor="gray.200"
              color="brand.500"
              thickness="3px"
            />
            <Text fontSize="4xl">Getting things ready</Text>
          </HStack>
        </VStack>
      )}
    </VStack>
  )
}
