import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import EventEmitter from 'events'

import z from 'zod'

const ee = new EventEmitter()

const t = initTRPC.create({ isServer: true })

export const router = t.router({
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
