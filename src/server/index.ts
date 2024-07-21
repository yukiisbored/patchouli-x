import { createPortServer } from './createPortServer'
import { router } from './api'
import { createContext } from './context'

process.title = 'Patchouli Server'

const privatePath = process.argv[process.argv.length - 1]

const context = createContext(privatePath)

createPortServer({
  router,
  createContext: async () => {
    const get = await context
    return get()
  }
}).catch(console.error)
