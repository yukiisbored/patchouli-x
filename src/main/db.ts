import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as baseMigrate } from 'drizzle-orm/better-sqlite3/migrator'
import { is } from '@electron-toolkit/utils'

const dataPath = join(app.getPath('userData'), 'Patchouli Data')
mkdirSync(dataPath, { recursive: true })

const dbPath = join(dataPath, 'data.sqlite3')
const sqlite = new Database(dbPath)

const migrationsFolder = is.dev
  ? join(__dirname, '../../resources/drizzle')
  : join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'drizzle')

export const db = drizzle(sqlite)

export async function migrate(): Promise<void> {
  baseMigrate(db, {
    migrationsFolder
  })
}
