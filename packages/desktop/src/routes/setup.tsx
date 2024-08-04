import { trpc } from '@/trpc'
import { Button, Flex, Heading, Spacer, Stack, Text } from '@chakra-ui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { message, open } from '@tauri-apps/api/dialog'

export const Route = createFileRoute('/setup')({
  component: Setup
})

function Setup() {
  const navigate = useNavigate()
  const mutation = trpc.system.configure.useMutation()

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

  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="space-between"
      height="100vh"
    >
      <Spacer />
      <Stack
        maxW={600}
        align="center"
        background="white"
        padding={8}
        borderRadius="md"
      >
        <Heading size="xl">Patchouli</Heading>
        <Text mt={4}>We need a place to store your darlings.</Text>
        <Text>Please choose the location of your personal vault.</Text>
        <Button mt={4} onClick={onClick}>
          Browse
        </Button>
      </Stack>
      <Spacer />
    </Flex>
  )
}
