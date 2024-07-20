import { ipcMain, IpcMainEvent, UtilityProcess } from 'electron'
import { Operation } from '@trpc/client'

export type IPCRequest =
  | { method: 'request'; operation: Operation }
  | { method: 'subscription.stop'; id: number }

export function createRelay(child: UtilityProcess) {
  const pendingRequests = new Map<number, { type: Operation['type']; event: IpcMainEvent }>()

  function post(request: IPCRequest) {
    child.postMessage(request)
  }

  function stopSubscription(id: number) {
    post({ method: 'subscription.stop', id })
  }

  ipcMain.on('trpc', (event: IpcMainEvent, request: IPCRequest) => {
    if (request.method === 'subscription.stop') {
      pendingRequests.delete(request.id)
      stopSubscription(request.id)
      return
    }

    pendingRequests.set(request.operation.id, {
      type: request.operation.type,
      event
    })

    child.postMessage(request)
  })

  child.on('message', (resp: unknown & { id: number }) => {
    const request = pendingRequests.get(resp.id)!
    const { event, type } = request

    if (event.sender.isDestroyed()) {
      pendingRequests.delete(resp.id)

      if (type === 'subscription') {
        stopSubscription(resp.id)
      }
    }

    request.event.reply('trpc', resp)

    if (type !== 'subscription') {
      pendingRequests.delete(resp.id)
    }
  })
}
