/*
 * Forked from [electron-trpc].
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
import { type Operation, TRPCClientError, type TRPCLink } from '@trpc/client'
import { transformResult } from '@trpc/client/shared'
import type { AnyRouter, ProcedureType, inferRouterContext } from '@trpc/server'
import { type Observer, observable } from '@trpc/server/observable'
import type { TRPCResponseMessage } from '@trpc/server/rpc'
import { error } from 'tauri-plugin-log-api'

type PipeCallbackResult<TRouter extends AnyRouter = AnyRouter> =
  TRPCResponseMessage<unknown, inferRouterContext<TRouter>>

type PipeCallbacks<TRouter extends AnyRouter = AnyRouter> = Observer<
  PipeCallbackResult<TRouter>,
  TRPCClientError<TRouter>
>

type PipeRequest = {
  type: ProcedureType
  callbacks: PipeCallbacks
  op: Operation
}

function PipeClient() {
  const pendingRequests = new Map<string | number, PipeRequest>()

  function send(data: unknown) {
    window.sidecar.child
      .write(`${JSON.stringify(data)}\n`)
      .catch(async (err: unknown) => {
        await error(`Failed to write to sidecar: ${err}`)
      })
  }

  function handle(response: TRPCResponseMessage) {
    const request = response.id && pendingRequests.get(response.id)

    if (!request) {
      return
    }

    request.callbacks.next(response)

    if ('result' in response && response.result.type === 'stopped') {
      request.callbacks.complete()
    }
  }

  window.sidecar.command.stdout.on('data', (line: string) => {
    const response: TRPCResponseMessage = JSON.parse(line)
    handle(response)
  })

  function request(op: Operation, callbacks: PipeCallbacks) {
    const { type, id } = op

    pendingRequests.set(id, {
      type,
      callbacks,
      op
    })

    send({
      method: 'request',
      operation: op
    })

    return () => {
      const callbacks = pendingRequests.get(id)?.callbacks

      pendingRequests.delete(id)

      callbacks?.complete()

      if (type === 'subscription') {
        send({
          id,
          method: 'subscription.stop'
        })
      }
    }
  }

  return { request }
}

export function pipeLink<T extends AnyRouter>(): TRPCLink<T> {
  const client = PipeClient()
  return (runtime) => {
    return ({ op }) => {
      return observable((observer) => {
        op.input = runtime.transformer.serialize(op.input)

        const unsubscribe = client.request(op, {
          error(err) {
            observer.error(err as TRPCClientError<T>)
            unsubscribe()
          },
          complete() {
            observer.complete()
          },
          next(response) {
            const transformed = transformResult(response, runtime)

            if (!transformed.ok) {
              observer.error(TRPCClientError.from(transformed.error))
              return
            }

            observer.next({ result: transformed.result })

            if (op.type !== 'subscription') {
              unsubscribe()
              observer.complete()
            }
          }
        })

        return () => {
          unsubscribe()
        }
      })
    }
  }
}
