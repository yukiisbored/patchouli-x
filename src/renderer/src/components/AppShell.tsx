import {
  Box,
  BoxProps,
  Flex,
  useColorModeValue,
  Icon,
  FlexProps,
  Link,
  Button,
  useDisclosure
} from '@chakra-ui/react'
import { IconFiles, IconHelp, IconPlus } from '@tabler/icons-react'
import { ElementType } from 'react'
import { Link as RouterLink, useLocation } from '@tanstack/react-router'
import ScrapeModal from './ScrapeModal'

interface NavItem {
  name: string
  to: string
  icon: ElementType
}

const navItems: Array<NavItem> = [
  { name: 'Documents', to: '/', icon: IconFiles },
  { name: 'About', to: '/about', icon: IconHelp }
]

type NavItemProps = NavItem & FlexProps

function NavItem({ icon, name, to, ...rest }: NavItemProps): JSX.Element {
  const pathname = useLocation({
    select: (location) => location.pathname
  })
  const isActive = pathname === to
  return (
    <Link style={{ textDecoration: 'none' }} _focus={{ boxShadow: 'none' }} as={RouterLink} to={to}>
      <Flex
        align="center"
        p="4"
        mb="1"
        role="group"
        cursor="pointer"
        bg={isActive ? 'brand.400' : undefined}
        color={isActive ? 'white' : undefined}
        _hover={{
          bg: isActive ? 'brand.600' : 'brand.400',
          color: 'white'
        }}
        {...rest}
      >
        <Icon mr="4" fontSize="16" _groupHover={{ color: 'white' }} as={icon} />
        {name}
      </Flex>
    </Link>
  )
}

function SidebarContent({ ...rest }: BoxProps): JSX.Element {
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <ScrapeModal isOpen={isOpen} onClose={onClose} />
      <Box
        bg={useColorModeValue('white', 'gray.900')}
        borderRight="1px"
        borderRightColor={useColorModeValue('gray.200', 'gray.700')}
        w="60"
        pos="fixed"
        h="full"
        {...rest}
      >
        <Flex direction="column" justifyContent="space-between" h="100%">
          <Flex direction="column">
            {navItems.map((i) => (
              <NavItem key={i.to} {...i} />
            ))}
          </Flex>
          <Button onClick={onOpen}>
            <Icon mr="1" fontSize="16" _groupHover={{ color: 'white' }} as={IconPlus} />
            Add from URL
          </Button>
        </Flex>
      </Box>
    </>
  )
}

export default function AppShell({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <Box minH="100vh" bg={useColorModeValue('gray.100', 'gray.900')}>
      <SidebarContent />
      <Box ml="60" p="4">
        {children}
      </Box>
    </Box>
  )
}
