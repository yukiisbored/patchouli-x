import { router } from './api.ts'
import { createContext } from './context.ts'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import cors from 'cors'
import { parseArgs } from 'node:util'
import invariant from 'tiny-invariant'

process.title = 'Patchouli Server'

const {
  values: { privatePath }
} = parseArgs({
  args: Bun.argv,
  options: {
    privatePath: {
      type: 'string'
    }
  },
  strict: true,
  allowPositionals: true
})

invariant(privatePath, 'Private path is required')

const context = createContext(privatePath)

createHTTPServer({
  middleware: cors(),
  router,
  createContext: async () => {
    const get = await context
    return get()
  }
}).listen(2022)
