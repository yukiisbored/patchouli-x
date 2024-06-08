/* eslint-disable @typescript-eslint/explicit-function-return-type */
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
import { desc } from 'drizzle-orm'

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

export async function fetchDocuments(page: number = 1, pageSize: number = 25) {
  return await db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
}

export async function insertDocumentFromScrape(res: ScrapeResult) {
  const id = ulid()

  const { title, description, content, url, htmlContent } = res

  const documentPath = join(dataPath, id)
  await mkdir(documentPath)

  const htmlPath = join(documentPath, 'index.html')
  writeFile(htmlPath, htmlContent)

  const [r] = await db
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

  return r
}
