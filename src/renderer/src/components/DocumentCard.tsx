import { Card, CardBody, CardHeader, Heading, Text, VStack } from '@chakra-ui/react'

export interface DocumentCardProps {
  url: string
  title: string | null
  description: string | null
}

export default function DocumentCard({ url, title, description }: DocumentCardProps): JSX.Element {
  return (
    <Card role="group" className="document-card" as="a" href={url} target="_blank">
      <CardHeader>
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
          <Text
            color="gray"
            sx={{
              '.document-card:hover &': {
                textDecoration: 'underline'
              }
            }}
          >
            {url}
          </Text>
        </VStack>
      </CardHeader>
      <CardBody pt="unset">{description && <Text>{description}</Text>}</CardBody>
    </Card>
  )
}
