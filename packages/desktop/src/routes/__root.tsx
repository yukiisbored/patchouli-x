import AppShell from '@/components/AppShell'
import {
  ChakraProvider,
  extendTheme,
  withDefaultColorScheme
} from '@chakra-ui/react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const TanStackRouterDevtools =
  process.env.NODE_ENV === 'production'
    ? (): null => null
    : lazy(() =>
        import('@tanstack/router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools
        }))
      )

const theme = extendTheme(
  {
    colors: {
      gray: {
        '50': '#F3F0F4',
        '100': '#DDD6E1',
        '200': '#C7BBCD',
        '300': '#B2A1BA',
        '400': '#9C87A6',
        '500': '#866C93',
        '600': '#6B5676',
        '700': '#514158',
        '800': '#362B3B',
        '900': '#1B161D'
      },
      brand: {
        '50': '#F7E5FF',
        '100': '#E7B8FF',
        '200': '#D88AFF',
        '300': '#C95CFF',
        '400': '#B92EFF',
        '500': '#AA00FF',
        '600': '#8800CC',
        '700': '#660099',
        '800': '#440066',
        '900': '#220033'
      }
    },
    config: {
      useSystemColorMode: true
    }
  },
  withDefaultColorScheme({ colorScheme: 'brand' })
)

export const Route = createRootRoute({
  component: () => (
    <ChakraProvider theme={theme}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Suspense>
        <TanStackRouterDevtools
          position="bottom-right"
          toggleButtonProps={{
            style: {
              bottom: '36px',
              right: '2px'
            }
          }}
        />
      </Suspense>
    </ChakraProvider>
  )
})
