import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { EventEmitter } from 'node:stream'
import chokidar from 'chokidar'
import { LRUCacheWithDelete } from 'mnemonist'
import { ulid } from 'ulid'
import z from 'zod'
import { logger } from './logger.ts'
import type { ScrapeResult } from './scraper.ts'
import type { Settings } from './settings.ts'
import { SortedArray, isUlid } from './utils.ts'
import { createClient } from '@libsql/client'

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

export type Meta = z.infer<typeof metaSchema>

export type Result = {
  items: Array<Meta>
  page: number
  nextPage?: number
}

type DatabaseProps = {
  settings: Settings
  ee: EventEmitter
}

export type Database = ReturnType<typeof Database>

export async function Database({ settings, ee }: DatabaseProps) {
  const { dataPath } = settings

  const client = createClient({
    url: ':memory:'
  })

  await client.execute(
    'CREATE VIRTUAL TABLE fts_documents USING fts5(id UNINDEXED, title, description, content, url, keywords)'
  )

  const watcher = chokidar.watch(dataPath, { depth: 0, ignoreInitial: true })
  const cachedDocumentIds = SortedArray<string>((a, b) =>
    b.localeCompare(a, 'en', { sensitivity: 'base' })
  )
  const cache = new LRUCacheWithDelete<string, Meta>(1000)

  async function close(): Promise<void> {
    await watcher.close()
  }

  async function insert(id: string, document: Meta) {
    cachedDocumentIds.insert(id)
    watcher.add(join(dataPath, id, 'meta.json'))
    await client.execute({
      sql: 'INSERT INTO fts_documents (id, url, title, description, content, keywords) VALUES (?, ?, ?, ?, ?, ?)',
      args: [
        id,
        document.url,
        document.title ?? null,
        document.description ?? null,
        document.content ?? null,
        document.keywords?.join(' ') ?? null
      ]
    })
  }

  async function remove(id: string) {
    cachedDocumentIds.remove(id)
    cache.delete(id)
    watcher.unwatch(join(dataPath, id, 'meta.json'))
    await client.execute({
      sql: 'DELETE FROM fts_documents WHERE id = ?',
      args: [id]
    })
  }

  async function update(id: string, document: Meta) {
    cache.delete(id)
    await client.execute({
      sql: 'UPDATE fts_documents SET url = ?, title = ?, description = ?, content = ?, keywords = ? WHERE id = ?',
      args: [
        document.url,
        document.title ?? null,
        document.description ?? null,
        document.content ?? null,
        document.keywords?.join(' ') ?? null,
        id
      ]
    })
  }

  async function read(id: string) {
    const documentPath = join(dataPath, id)
    const metaPath = join(documentPath, 'meta.json')
    const metaRaw = await readFile(metaPath, 'utf-8')

    return metaSchema.parseAsync(JSON.parse(metaRaw))
  }

  async function get(id: string): Promise<Meta> {
    async function readAndCache(id: string) {
      const document = await read(id)
      cache.set(id, document)
      return document
    }

    return cache.get(id) ?? readAndCache(id)
  }

  async function fetchDocuments(page = 1, pageSize = 25): Promise<Result> {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const items = await Promise.all(
      cachedDocumentIds.get().slice(start, end).map(get)
    )

    const nextPage = items.length === pageSize ? page + 1 : undefined

    return {
      page,
      items,
      nextPage
    }
  }

  async function searchDocuments(
    term: string,
    page = 1,
    pageSize = 25
  ): Promise<Result> {
    const res = await client.execute({
      sql: 'SELECT id FROM fts_documents WHERE fts_documents MATCH ? ORDER BY rank LIMIT ? OFFSET ?',
      args: [term, pageSize, (page - 1) * pageSize]
    })

    const ids = res.rows.map((i) => i.id) as string[]
    const nextPage = ids.length === pageSize ? pageSize + 1 : undefined
    const items = await Promise.all(ids.map(get))

    return {
      page,
      items,
      nextPage
    }
  }

  async function insertDocumentFromScrape(res: ScrapeResult): Promise<Meta> {
    const id = ulid()

    const { htmlContent } = res

    const documentPath = join(dataPath, id)
    await mkdir(documentPath)

    const htmlPath = join(documentPath, 'index.html')
    await writeFile(htmlPath, htmlContent)

    const metaPath = join(documentPath, 'meta.json')
    const meta = {
      ...res,
      htmlContent: undefined,
      version: 0,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Meta

    await writeFile(metaPath, JSON.stringify(meta, null, 2))

    return meta
  }

  await mkdir(dataPath, { recursive: true })

  const ids = (await readdir(dataPath, { withFileTypes: true }))
    .filter((i) => i.isDirectory())
    .filter((i) => isUlid(i.name))
    .map((i) => i.name)

  for await (const id of ids) {
    try {
      const document = await read(id)
      await insert(id, document)
    } catch (e) {
      console.error(e)
    }
  }

  watcher.on('addDir', async (path) => {
    const id = basename(path)

    if (!isUlid(id)) {
      return
    }

    logger.info('Adding document: %s', id)
    const document = await read(id)

    await insert(id, document)
    ee.emit('document:add', id)
  })

  watcher.on('unlinkDir', async (path) => {
    const id = basename(path)

    if (!isUlid(id)) {
      return
    }

    logger.info('Removing document: %s', id)
    await remove(id)
    ee.emit('document:remove', id)
  })

  watcher.on('change', async (path) => {
    const id = basename(resolve(path, '..'))
    logger.info('Change detected: %s', id)

    if (!isUlid(id)) {
      return
    }

    logger.info('Updating document: %s', id)
    const document = await read(id)
    await update(id, document)
    ee.emit('document:update', id)
  })

  return {
    settings,
    fetchDocuments,
    insertDocumentFromScrape,
    searchDocuments,
    close
  }
}
