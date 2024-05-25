import { trpc } from './trpc'

export default function Hello(): JSX.Element {
  const { data, error, status } = trpc.greeting.useQuery({ name: 'world' })

  trpc.subscription.useSubscription(undefined, {
    onData: (data) => {
      console.log(data)
    }
  })

  if (error) {
    return <p>{error.message}</p>
  }

  if (status !== 'success') {
    return <p>Loading...</p>
  }

  return <div>{data && <h1>{data.res}</h1>}</div>
}
