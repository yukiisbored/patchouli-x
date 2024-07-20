import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'

import z from 'zod'

import { scrape } from './scraper'
import { type Database } from './db'
import { EventEmitter } from 'stream'

export type Context = {
  db: Database
  ee: EventEmitter
}

const t = initTRPC.context<Context>().create({ isServer: true })

export const router = t.router({
  documents: t.router({
    byPage: t.procedure
      .input(z.object({ term: z.string().optional(), cursor: z.number(), pageSize: z.number() }))
      .query(async (req) => {
        const {
          input: { term, cursor: page, pageSize },
          ctx: { db }
        } = req

        const { fetchDocuments, searchDocuments } = await db

        return term ? searchDocuments(term, page, pageSize) : fetchDocuments(page, pageSize)
      }),
    fromUrl: t.procedure.input(z.object({ url: z.string().url() })).mutation(async (req) => {
      const {
        input: { url },
        ctx: { db }
      } = req

      const { insertDocumentFromScrape } = await db
      const res = await scrape(url)
      await insertDocumentFromScrape(res)
    }),
    onAdd: t.procedure.subscription((req) => {
      const {
        ctx: { ee }
      } = req

      return observable((emit) => {
        function onAdd(res: string): void {
          emit.next({ res })
        }

        ee.on('document:add', onAdd)

        return (): void => {
          ee.off('document:add', onAdd)
        }
      })
    }),
    onRemove: t.procedure.subscription((req) => {
      const {
        ctx: { ee }
      } = req

      return observable((emit) => {
        function onRemove(res: string): void {
          emit.next({ res })
        }

        ee.on('document:remove', onRemove)

        return (): void => {
          ee.off('document:remove', onRemove)
        }
      })
    }),
    onUpdate: t.procedure.subscription((req) => {
      const {
        ctx: { ee }
      } = req

      return observable((emit) => {
        function onUpdate(res: string): void {
          emit.next({ res })
        }

        ee.on('document:update', onUpdate)

        return (): void => {
          ee.off('document:update', onUpdate)
        }
      })
    })
  })
})

export type ApiRouter = typeof router
