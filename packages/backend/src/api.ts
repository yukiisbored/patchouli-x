import { TRPCError, initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import z from 'zod'

import { settingsSchema } from 'settings.ts'
import { type Context, unwrapCtx } from './context.ts'
import { scrape } from './scraper.ts'

const t = initTRPC.context<Context>().create({ isServer: true })

const databaseProcedure = t.procedure.use(async (opts) => {
  const { ctx: unwrappedCtx } = opts

  const ctx = unwrapCtx(unwrappedCtx)

  return opts.next({
    ctx: {
      ...ctx,
      db: await ctx.db
    }
  })
})

export const router = t.router({
  system: t.router({
    configure: t.procedure.input(settingsSchema).mutation(async (req) => {
      const {
        ctx: { configure },
        input
      } = req

      await configure(input)
    }),
    status: t.procedure.query(async (req) => {
      const {
        ctx: { status }
      } = req

      return status
    })
  }),
  documents: t.router({
    byPage: databaseProcedure
      .input(
        z.object({
          term: z.string().optional(),
          cursor: z.number(),
          pageSize: z.number()
        })
      )
      .query(async (req) => {
        const {
          input: { term, cursor: page, pageSize },
          ctx: {
            db: { fetchDocuments, searchDocuments }
          }
        } = req

        return term
          ? searchDocuments(term, page, pageSize)
          : fetchDocuments(page, pageSize)
      }),
    fromUrl: databaseProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async (req) => {
        const {
          input: { url },
          ctx: {
            db: { insertDocumentFromScrape }
          }
        } = req

        const res = await scrape(url)
        await insertDocumentFromScrape(res)
      }),
    delete: databaseProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async (req) => {
        const {
          input: { id },
          ctx: {
            db: { deleteDocument }
          }
        } = req

        await deleteDocument(id)
      }),
    onAdd: databaseProcedure.subscription((req) => {
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
    onRemove: databaseProcedure.subscription((req) => {
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
    onUpdate: databaseProcedure.subscription((req) => {
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
