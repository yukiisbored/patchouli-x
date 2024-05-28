import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as baseMigrate } from 'drizzle-orm/better-sqlite3/migrator'

const dataPath = join(app.getPath('userData'), 'Patchouli Data')
mkdirSync(dataPath, { recursive: true })

const dbPath = join(dataPath, 'data.sqlite3')
const sqlite = new Database(dbPath)

// TODO: Figure out how to deliver the drizzle folder that is usable by the migrator.
const migrationsFolder = join(__dirname, '../../resources/drizzle')

export const db = drizzle(sqlite)

export async function migrate(): Promise<void> {
  console.log(migrationsFolder)
  baseMigrate(db, {
    migrationsFolder
  })
}
