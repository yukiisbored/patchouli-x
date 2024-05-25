import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <Link to="/">Home</Link> <Link to="/about">About</Link>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
})
