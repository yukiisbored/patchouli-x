import {
  Card,
  CardBody,
  CardHeader,
  HStack,
  Heading,
  Image,
  MenuDivider,
  MenuItem,
  MenuList,
  Stack,
  Text,
  VStack,
  useToast
} from '@chakra-ui/react'
import faviconFallback from './external-link.svg'
import imageFallback from './fallback.svg'
import { ContextMenu } from 'chakra-ui-contextmenu'
import {
  IconCircleArrowUpRight,
  IconHistory,
  IconPencil,
  IconTrash
} from '@tabler/icons-react'
import { open } from '@tauri-apps/api/shell'
import { trpc } from '@/trpc'
import { useCallback } from 'react'
import { getErrorMessage } from '@/utils'

export interface DocumentCardProps {
  id: string
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  favicon?: string | null
  index?: string
}

export default function DocumentCard({
  id,
  url,
  title,
  description,
  image,
  favicon,
  index
}: DocumentCardProps) {
  const toast = useToast()
  const deleteMutation = trpc.documents.delete.useMutation()

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync({ id })
      toast({
        title: 'Document moved to trash',
        description: `"${title ?? url}" has been moved to trash.`,
        status: 'success'
      })
    } catch (error) {
      toast({
        title: 'Failed to delete document',
        description: getErrorMessage(error),
        status: 'error'
      })
    }
  }, [id, deleteMutation, toast, title, url])

  return (
    <ContextMenu<HTMLAnchorElement>
      renderMenu={() => (
        <MenuList>
          <MenuItem
            icon={<IconCircleArrowUpRight size={18} />}
            iconSpacing={2}
            as="a"
            href={url}
            target="_blank"
          >
            Open
          </MenuItem>
          {index && (
            <MenuItem
              icon={<IconHistory size={18} />}
              iconSpacing={2}
              onClick={() => open(`file://${index}`)}
            >
              Open cached
            </MenuItem>
          )}
          <MenuDivider />
          <MenuItem
            color="yellow.500"
            icon={<IconPencil size={18} />}
            iconSpacing={2}
          >
            Edit
          </MenuItem>
          <MenuDivider />
          <MenuItem
            color="red.500"
            icon={<IconTrash size={18} />}
            iconSpacing={2}
            onClick={() => handleDelete()}
          >
            Delete
          </MenuItem>
        </MenuList>
      )}
    >
      {(ref) => (
        <Card
          ref={ref}
          role="group"
          className="document-card"
          as="a"
          href={url}
          target="_blank"
          direction="row"
          overflow="hidden"
          flexShrink={0}
          w={{
            base: '100%',
            md: '48em'
          }}
          h={180}
        >
          <Stack flexGrow={1}>
            <CardHeader pb="unset">
              <VStack align="start" spacing={1}>
                {title && (
                  <Heading
                    size="sm"
                    sx={{
                      '.document-card:hover &': {
                        color: 'brand.500'
                      }
                    }}
                  >
                    {title}
                  </Heading>
                )}
                <HStack>
                  <Image
                    objectFit="contain"
                    objectPosition="center"
                    src={favicon ?? faviconFallback}
                    h="1em"
                    fallbackSrc={faviconFallback}
                  />
                  <Text
                    color="gray"
                    sx={{
                      '.document-card:hover &': {
                        textDecoration: 'underline'
                      }
                    }}
                    textOverflow="ellipsis"
                    noOfLines={1}
                    maxW="500px"
                  >
                    {url}
                  </Text>
                </HStack>
              </VStack>
            </CardHeader>
            <CardBody pt="unset">
              {description && (
                <Text
                  noOfLines={{
                    base: 2,
                    md: 3
                  }}
                >
                  {description}
                </Text>
              )}
            </CardBody>
          </Stack>
          <Image
            objectFit="cover"
            w="200px"
            flexShrink={0}
            src={image ?? imageFallback}
            alt={title ?? url}
            fallbackSrc={imageFallback}
            display={{
              base: 'none',
              sm: 'initial'
            }}
          />
        </Card>
      )}
    </ContextMenu>
  )
}
