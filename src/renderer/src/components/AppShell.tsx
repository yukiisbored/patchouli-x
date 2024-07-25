import { Box, useColorModeValue } from '@chakra-ui/react'
import type { ReactElement } from 'react'

export default function AppShell({ children }: { children: ReactElement }) {
  return (
    <Box minH="100vh" bg={useColorModeValue('gray.100', 'gray.900')}>
      {children}
    </Box>
  )
}
