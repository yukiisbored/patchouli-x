/* eslint-disable @typescript-eslint/explicit-function-return-type */
import Database from 'better-sqlite3'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as baseMigrate } from 'drizzle-orm/better-sqlite3/migrator'
import { is } from '@electron-toolkit/utils'
import { documents } from './schema'
import { ulid } from 'ulid'
import { ScrapeResult } from './scraper'
import { desc, getTableColumns, notInArray, SQL, sql } from 'drizzle-orm'
import {
  create as orama,
  insert as oramaInsert,
  insertMultiple as oramaInsertMultiple,
  search as oramaSearch
} from '@orama/orama'
import { privatePath, Settings } from './settings'
import z from 'zod'
import { readdir, readFile } from 'node:fs/promises'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { Tuple } from './utils'

const zDateTime = z
  .string()
  .datetime()
  .transform((i) => new Date(i))

const metaSchema = z.object({
  version: z.literal(0),
  id: z.string().ulid(),
  url: z.string(),
  createdAt: zDateTime,
  updatedAt: zDateTime,
  favicon: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  keywords: z.array(z.string()).nullish().default([]),
  publishedAt: zDateTime.nullish(),
  image: z.string().nullish(),
  content: z.string().nullish(),
  author: z.object({ name: z.string(), url: z.string().nullish() }).nullish()
})

const buildConflictUpdateColumns = <T extends SQLiteTable, Q extends keyof T['_']['columns']>(
  table: T,
  columns: Q[]
) => {
  const cls = getTableColumns(table)
  return columns.reduce(
    (acc, column) => {
      const colName = cls[column].name
      acc[column] = sql.raw(`excluded.${colName}`)
      return acc
    },
    {} as Record<Q, SQL>
  )
}

export type Meta = z.infer<typeof metaSchema>

export type DB = Awaited<ReturnType<typeof createDB>>

export async function createDB({ dataPath }: Settings) {
  await mkdir(dataPath, { recursive: true })

  const dbPath = join(privatePath, 'data.sqlite3')
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

  async function scan() {
    const documentParseJobs = (await readdir(dataPath, { withFileTypes: true }))
      .filter((i) => i.isDirectory())
      .filter((i) => z.string().ulid().safeParse(i.name).success)
      .map(async (i) => {
        const documentPath = join(dataPath, i.name)
        const metaPath = join(documentPath, 'meta.json')
        const metaRaw = await readFile(metaPath, 'utf-8')
        return metaSchema.parseAsync(JSON.parse(metaRaw))
      })

    const { l: resolved } = await Promise.allSettled(documentParseJobs).then((res) =>
      res.reduce(
        ({ l, r }, i) => {
          if (i.status === 'fulfilled') {
            return { l: l.concat(i.value), r }
          }
          return { l, r: r.concat(i.reason) }
        },
        Tuple<Array<Meta>, Array<unknown>>([], [])
      )
    )

    if (resolved.length === 0) {
      await db.delete(documents)
      return
    }

    await db
      .insert(documents)
      .values(
        resolved.map((i) => ({
          status: 'complete' as const,
          id: i.id,
          url: i.url,
          title: i.title,
          description: i.description,
          content: i.content,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          keywords: i.keywords,
          publishedAt: i.publishedAt,
          image: i.image,
          favicon: i.favicon,
          author: i.author?.name,
          authorUrl: i.author?.url
        }))
      )
      .onConflictDoUpdate({
        target: documents.id,
        set: buildConflictUpdateColumns(documents, [
          'url',
          'title',
          'description',
          'content',
          'createdAt',
          'updatedAt',
          'keywords',
          'publishedAt',
          'image',
          'favicon',
          'author',
          'authorUrl'
        ])
      })

    await db.delete(documents).where(
      notInArray(
        documents.id,
        resolved.map((i) => i.id)
      )
    )
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
    return db
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
    await writeFile(htmlPath, htmlContent)

    const metaPath = join(documentPath, 'meta.json')
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          ...res,
          htmlContent: undefined,
          version: 0,
          id,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Meta,
        null,
        2
      )
    )

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
      title: title ?? undefined,
      description: description ?? undefined,
      content: content ?? undefined
    })
    return r
  }

  return {
    migrate,
    scan,
    loadIndex,
    fetchDocuments,
    insertDocumentFromScrape,
    searchDocuments
  }
}
