import { Settings } from '../settings'
import { EventEmitter } from 'stream'
import { Database } from './db'
import { createPortServer } from './createPortServer'
import { router } from './api'

// TODO: Find less cursed way to pass settings
const settings = JSON.parse(process.argv[process.argv.length - 1]) as Settings

const ee = new EventEmitter()
const db = Database({
  ...settings,
  ee
})

createPortServer({
  router,
  createContext() {
    return { ee, db }
  }
}).catch(console.error)
