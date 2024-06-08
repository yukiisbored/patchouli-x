import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync, mkdir as baseMkdir, writeFile as baseWriteFile } from 'fs'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as baseMigrate } from 'drizzle-orm/better-sqlite3/migrator'
import { is } from '@electron-toolkit/utils'
import { documents } from './schema'
import { ulid } from 'ulid'
import { ScrapeResult } from './scraper'
import { promisify } from 'util'

const mkdir = promisify(baseMkdir)
const writeFile = promisify(baseWriteFile)

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function insertDocumentFromScrape(res: ScrapeResult) {
  const id = ulid()

  const { title, description, content, url, htmlContent } = res

  const documentPath = join(dataPath, id)
  await mkdir(documentPath)

  const htmlPath = join(documentPath, 'index.html')
  writeFile(htmlPath, htmlContent)

  return db
    .insert(documents)
    .values({
      id,
      status: 'complete',
      url,
      title,
      description,
      content
    })
    .returning()
}
