import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { trpc } from './trpc'

// TODO: Find better solution that doesn't depend on React Hooks.
//       So, we could run this in the loader instead, outside of React DOM hydrate/render.
export function useEnsureConfigured() {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  useEffect(() => {
    async function checkStatus() {
      const status = await utils.system.status.fetch()
      if (status === 'configured') {
        return
      }

      await navigate({ to: '/setup' })
    }

    checkStatus().catch(console.error)
  }, [navigate, utils])
}

export function isDev() {
  return import.meta.env.DEV
}

export function isUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
