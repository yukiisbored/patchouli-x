import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { router } from './api'
import { Settings } from '../settings'
import { EventEmitter } from 'stream'
import { Database } from './db'
import cors from 'cors'

const settings = JSON.parse(process.argv[process.argv.length - 1]) as Settings
const ee = new EventEmitter()
const db = Database({
  ...settings,
  ee
})

createHTTPServer({
  middleware: cors(),
  router,
  createContext() {
    return { db, ee }
  }
}).listen(3333)
