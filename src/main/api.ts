import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import EventEmitter from 'events'

import z from 'zod'

import { scrape } from './scraper'
import { fetchDocuments, insertDocumentFromScrape } from './db'

const ee = new EventEmitter()

const t = initTRPC.create({ isServer: true })

export const router = t.router({
  documents: t.router({
    byPage: t.procedure.input(z.object({ page: z.number(), pageSize: z.number() })).query((req) => {
      const {
        input: { page, pageSize }
      } = req

      return fetchDocuments(page, pageSize)
    }),
    fromUrl: t.procedure.input(z.object({ url: z.string().url() })).mutation(async (req) => {
      const {
        input: { url }
      } = req

      const res = await scrape(url)
      const doc = await insertDocumentFromScrape(res)
      ee.emit('document:add', doc)
    }),
    onAdd: t.procedure.subscription(() => {
      return observable((emit) => {
        function onAdd(res: string): void {
          emit.next({ res })
        }

        ee.on('document:add', onAdd)

        return (): void => {
          ee.off('document:add', onAdd)
        }
      })
    })
  })
})

export type ApiRouter = typeof router
