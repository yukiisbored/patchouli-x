import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About
})

function About(): JSX.Element {
  return <h3>About</h3>
}
