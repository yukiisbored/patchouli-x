/*
 * Forked from [electron-trpc]. Modified to work in child_process.
 *
 * MIT License
 *
 * Copyright (c) 2024 Yuki Langley and Patchouli contributors
 * Copyright (c) 2022 Jason Nall
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * [electron-trpc]: https://github.com/jsonnull/electron-trpc
 */
import { isObservable, Unsubscribable } from '@trpc/server/observable'
import { TRPCResponseMessage } from '@trpc/server/rpc'
import { getErrorShape, transformTRPCResponse } from '@trpc/server/shared'
import {
  AnyRouter,
  callProcedure,
  getTRPCErrorFromUnknown,
  inferRouterContext,
  MaybePromise,
  TRPCError
} from '@trpc/server'
import { IPCRequest } from '../main/relay'

type CreatePortServerProps<TRouter extends AnyRouter> = {
  router: TRouter
  createContext?: () => MaybePromise<inferRouterContext<TRouter>>
}

export async function createPortServer<TRouter extends AnyRouter>({
  router,
  createContext
}: CreatePortServerProps<TRouter>) {
  const subscriptions = new Map<string | number, Unsubscribable>()

  process.parentPort.on('message', async (event) => {
    const ctx = (await createContext?.()) ?? {}

    const request = event.data as IPCRequest

    if (request.method === 'subscription.stop') {
      const subscription = subscriptions.get(request.id)

      if (!subscription) {
        return
      }

      subscription.unsubscribe()
      subscriptions.delete(request.id)
      return
    }
    const { type, input: serializedInput, path, id } = request.operation
    const input = serializedInput
      ? router._def._config.transformer.input.deserialize(serializedInput)
      : undefined

    const respond = (response: TRPCResponseMessage) => {
      const reply = transformTRPCResponse(router._def._config, response)
      process.parentPort.postMessage(reply)
    }

    try {
      const result = await callProcedure({
        ctx,
        path,
        procedures: router._def.procedures,
        rawInput: input,
        type
      })
      if (type !== 'subscription') {
        respond({
          id,
          result: {
            type: 'data',
            data: result
          }
        })
        return
      }

      if (!isObservable(result)) {
        throw new TRPCError({
          message: `Subscription ${path} did not return an observable`,
          code: 'INTERNAL_SERVER_ERROR'
        })
      }

      const subscription = result.subscribe({
        next(data) {
          respond({
            id,
            result: {
              type: 'data',
              data
            }
          })
        },
        error(err) {
          const error = getTRPCErrorFromUnknown(err)
          respond({
            id,
            error: getErrorShape({
              config: router._def._config,
              error,
              type,
              path,
              input,
              ctx
            })
          })
        },
        complete() {
          respond({
            id,
            result: {
              type: 'stopped'
            }
          })
        }
      })

      subscriptions.set(id, subscription)
    } catch (cause) {
      const error: TRPCError = getTRPCErrorFromUnknown(cause)

      return respond({
        id,
        error: getErrorShape({
          config: router._def._config,
          error,
          type,
          path,
          input,
          ctx
        })
      })
    }
  })
}
