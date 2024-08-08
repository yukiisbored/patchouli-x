import { trpc } from '@/trpc'
import {
  Button,
  Heading,
  Spacer,
  Stack,
  Text,
  Image,
  Card,
  CardBody,
  HStack
} from '@chakra-ui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { message, open } from '@tauri-apps/api/dialog'
import logo from '@/assets/icon.png'
import { IconBulb } from '@tabler/icons-react'
import { getVersion } from '@tauri-apps/api/app'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/setup')({
  component: Setup
})

function Setup() {
  const navigate = useNavigate()
  const mutation = trpc.system.configure.useMutation()
  const [version, setVersion] = useState<string | null>(null)

  async function onClick() {
    const selected = await open({
      directory: true,
      multiple: false
    })

    if (Array.isArray(selected) || !selected) {
      await message('Please select a directory for your vault.', {
        type: 'error'
      })
      return
    }

    await mutation.mutateAsync({
      version: 0,
      dataPath: selected
    })

    await navigate({
      to: '/'
    })
  }

  const fetchInformation = useCallback(async () => {
    setVersion(await getVersion())
  }, [])

  useEffect(() => {
    fetchInformation()
  })

  return (
    <Stack
      mx="auto"
      h="100vh"
      maxW={600}
      align="center"
      justify="space-between"
      background="white"
      padding={8}
    >
      <Spacer />
      <Stack>
        <Stack>
          <Image w={32} src={logo} />
          <Heading size="2xl">Patchouli</Heading>
          {version && <Text>Version {version}</Text>}
        </Stack>

        <Stack mt={4}>
          <Text>To begin, we need a place to store your darlings.</Text>
          <Text>Please choose the location of your personal vault.</Text>
        </Stack>

        <Button mt={6} onClick={onClick} size="lg">
          Browse
        </Button>

        <Card mt={4} bg="green.100">
          <CardBody>
            <HStack align="flex-start">
              <IconBulb />
              <Text fontWeight="bold">Tip:</Text>
              <Text>
                You can put your vault in your cloud storage to sync between
                devices.
              </Text>
            </HStack>
          </CardBody>
        </Card>
      </Stack>
    </Stack>
  )
}
