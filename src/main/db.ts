/* eslint-disable @typescript-eslint/explicit-function-return-type */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdir as baseMkdir, writeFile as baseWriteFile } from 'fs'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as baseMigrate } from 'drizzle-orm/better-sqlite3/migrator'
import { is } from '@electron-toolkit/utils'
import { documents } from './schema'
import { ulid } from 'ulid'
import { ScrapeResult } from './scraper'
import { promisify } from 'util'
import { desc } from 'drizzle-orm'
import {
  create as orama,
  insertMultiple as oramaInsertMultiple,
  insert as oramaInsert,
  search as oramaSearch
} from '@orama/orama'

const mkdir = promisify(baseMkdir)
const writeFile = promisify(baseWriteFile)

export type DB = Awaited<ReturnType<typeof createDB>>

export async function createDB() {
  const dataPath = join(app.getPath('userData'), 'Patchouli Data')
  await mkdir(dataPath, { recursive: true })

  const dbPath = join(dataPath, 'data.sqlite3')
  const sqlite = new Database(dbPath)

  const migrationsFolder = is.dev
    ? join(__dirname, '../../resources/drizzle')
    : join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'drizzle')

  const db = drizzle(sqlite)
  const documentIndex = await orama({
    schema: {
      id: 'string',
      title: 'string',
      description: 'string',
      content: 'string',
      url: 'string'
    } as const
  })

  async function migrate(): Promise<void> {
    baseMigrate(db, {
      migrationsFolder
    })
  }

  async function loadIndex(): Promise<void> {
    const res = await db
      .select({
        id: documents.id,
        url: documents.url,
        title: documents.title,
        description: documents.description,
        content: documents.content
      })
      .from(documents)

    await oramaInsertMultiple(
      documentIndex,
      res.map((i) => ({
        ...i,
        title: i.title ?? '',
        description: i.description ?? '',
        content: i.content ?? ''
      }))
    )
  }

  async function searchDocuments(term: string, page: number = 1, pageSize: number = 25) {
    return await oramaSearch(documentIndex, {
      term,
      limit: pageSize,
      offset: (page - 1) * pageSize
    })
  }
  async function fetchDocuments(page: number = 1, pageSize: number = 25) {
    return await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
  }

  async function insertDocumentFromScrape(res: ScrapeResult) {
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
    await oramaInsert(documentIndex, {
      id,
      url,
      title,
      description,
      content
    })
    return r
  }

  return {
    migrate,
    loadIndex,
    fetchDocuments,
    insertDocumentFromScrape,
    searchDocuments
  }
}
