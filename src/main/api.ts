import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import EventEmitter from 'events'

import z from 'zod'

import { scrape } from './scraper'
import { insertDocumentFromScrape } from './db'

const ee = new EventEmitter()

const t = initTRPC.create({ isServer: true })

export const router = t.router({
  scrape: t.procedure.input(z.object({ url: z.string().url() })).mutation(async (req) => {
    const {
      input: { url }
    } = req

    const res = await scrape(url)
    return await insertDocumentFromScrape(res)
  }),
  greeting: t.procedure.input(z.object({ name: z.string() })).query((req) => {
    const {
      input: { name }
    } = req
    ee.emit('greeting', name)

    return {
      res: `Hello, ${name}`
    }
  }),
  subscription: t.procedure.subscription(() => {
    return observable((emit) => {
      function onGreet(res: string): void {
        emit.next({ res })
      }

      ee.on('greeting', onGreet)

      return (): void => {
        ee.off('greeting', onGreet)
      }
    })
  })
})

export type ApiRouter = typeof router
