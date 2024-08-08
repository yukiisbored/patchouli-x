import {
  Card,
  CardBody,
  CardHeader,
  HStack,
  Heading,
  Image,
  Stack,
  Text,
  VStack
} from '@chakra-ui/react'
import faviconFallback from './external-link.svg'
import imageFallback from './fallback.svg'

export interface DocumentCardProps {
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  favicon?: string | null
}

export default function DocumentCard({
  url,
  title,
  description,
  image,
  favicon
}: DocumentCardProps) {
  return (
    <Card
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
          {description && <Text noOfLines={3}>{description}</Text>}
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
  )
}
