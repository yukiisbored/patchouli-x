import { Box, useColorModeValue } from '@chakra-ui/react'

export default function AppShell({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <Box minH="100vh" bg={useColorModeValue('gray.100', 'gray.900')}>
      {children}
    </Box>
  )
}
