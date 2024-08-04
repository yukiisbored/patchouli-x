import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import cors from 'cors'
import invariant from 'tiny-invariant'
import { router } from './api.ts'
import { createContext } from './context.ts'

process.title = 'Patchouli Server'

const {
  values: { privatePath: privatePathRelative }
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

invariant(privatePathRelative, 'Private path is required')

const privatePath = join(process.cwd(), privatePathRelative)
const context = createContext(privatePath)

console.log('Patchouli Server is running on port 2022')
console.log('Private path is', privatePath)

createHTTPServer({
  middleware: cors(),
  router,
  createContext: async () => {
    const get = await context
    return get()
  }
}).listen(2022)
