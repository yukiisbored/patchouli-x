import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import cors from 'cors'
import invariant from 'tiny-invariant'
import { router } from './api.ts'
import { createContext } from './context.ts'
import { createPipeServer } from './createPipeServer.ts'
import { logger } from './logger.ts'

process.title = 'Patchouli Server'

const {
  values: { privatePath: privatePathRelative, dev }
} = parseArgs({
  args: process.argv,
  options: {
    privatePath: {
      type: 'string'
    },
    dev: {
      type: 'boolean'
    }
  },
  strict: true,
  allowPositionals: true
})

invariant(privatePathRelative, 'Private path is required')

const privatePath = dev
  ? join(process.cwd(), privatePathRelative)
  : privatePathRelative
const context = createContext(privatePath)

if (dev) {
  logger.info('Patchouli Server is running on port 2022')
  logger.info('Private path is %s', privatePath)

  createHTTPServer({
    middleware: cors(),
    router,
    createContext: async () => {
      const get = await context
      return get()
    }
  }).listen(2022)
} else {
  logger.info('Patchouli Server is running')
  logger.info('Private path is %s', privatePath)

  createPipeServer({
    router,
    createContext: async () => {
      const get = await context
      return get()
    }
  })
}
