import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { EventEmitter } from 'node:stream'
import { TRPCError } from '@trpc/server'
import { Database } from './db'
import { load, save } from './settings'
import type { Settings } from './settings'
import { Store } from './store'

export type Context =
  | { status: 'unconfigured'; configure: (settings: Settings) => Promise<void> }
  | {
      status: 'configured'
      db: Database
      ee: EventEmitter
      configure: (settings: Settings) => Promise<void>
    }

export async function createContext(privatePath: string) {
  await mkdir(privatePath, { recursive: true })
  const settingsPath = join(privatePath, 'Settings.json')

  const store = Store<Context>({
    status: 'unconfigured',
    configure: async (settings) => {
      const ctx = store.get()
      const { configure } = ctx

      await save(settingsPath, settings)

      if (ctx.status === 'configured') {
        const { db } = ctx

        await (await db).close()
      }

      const ee = ctx.status === 'configured' ? ctx.ee : new EventEmitter()
      const db = Database({ settings, ee })

      store.set({
        status: 'configured',
        db,
        ee,
        configure
      })
    }
  })

  const maybeSettings = await load(settingsPath)

  if (maybeSettings.success) {
    await store.get().configure(maybeSettings.data)
  }

  return store.get
}

export function unwrapCtx(ctx: Context) {
  if (ctx.status === 'unconfigured') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'Server is not configured. Please perform setup process and try again.'
    })
  }

  return ctx
}
