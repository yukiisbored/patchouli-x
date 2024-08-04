import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { EventEmitter } from 'node:stream'
import {
  create as orama,
  insert as oramaInsert,
  remove as oramaRemove,
  search as oramaSearch,
  update as oramaUpdate
} from '@orama/orama'
import { documentsStore as oramaDocumentsStore } from '@orama/orama/components'
import { stopwords as stopWords } from '@orama/stopwords/english'
import chokidar from 'chokidar'
import { LRUCacheWithDelete } from 'mnemonist'
import { ulid } from 'ulid'
import z from 'zod'
import type { ScrapeResult } from './scraper.ts'
import type { Settings } from './settings.ts'
import { SortedArray, isUlid } from './utils.ts'

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
  const store = await oramaDocumentsStore.createDocumentsStore()
  const documentIndex = await orama({
    schema: {
      id: 'string',
      title: 'string',
      description: 'string',
      keywords: 'string[]',
      content: 'string',
      url: 'string'
    } as const,
    components: {
      // HACK(yuki): We're gutting Orama's default document store to be an
      //             expensive Orama Internal ID -> Canonical ID mapper.
      //
      //             Also this breaks Orama's types which is always fun.
      //
      //             :-)
      documentsStore: {
        ...store,
        store(ctx, id, { id: docId }) {
          return store.store(ctx, id, { id: docId })
        }
      },
      tokenizer: {
        stemming: true,
        stopWords
      }
    }
  })

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
    await oramaInsert(documentIndex, {
      id,
      url: document.url,
      title: document.title ?? undefined,
      description: document.description ?? undefined,
      content: document.content ?? undefined,
      keywords: document.keywords ?? []
    })
  }

  async function remove(id: string) {
    cachedDocumentIds.remove(id)
    cache.delete(id)
    watcher.unwatch(join(dataPath, id, 'meta.json'))
    await oramaRemove(documentIndex, id)
  }

  async function update(id: string, document: Meta) {
    cache.delete(id)
    await oramaUpdate(documentIndex, id, {
      id,
      url: document.url,
      title: document.title ?? undefined,
      description: document.description ?? undefined,
      content: document.content ?? undefined,
      keywords: document.keywords ?? []
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
    const res = await oramaSearch(documentIndex, {
      term,
      limit: pageSize,
      offset: (page - 1) * pageSize
    })

    const ids = res.hits.map((i) => i.document.id)
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

  await Promise.allSettled(
    (await readdir(dataPath, { withFileTypes: true }))
      .filter((i) => i.isDirectory())
      .filter((i) => isUlid(i.name))
      .map((i) => i.name)
      .map(async (id) => {
        const document = await read(id)
        await insert(id, document)
      })
  )

  watcher.on('addDir', async (path) => {
    const id = basename(path)

    if (!isUlid(id)) {
      return
    }

    console.log('Adding document', id)
    const document = await read(id)

    insert(id, document)
    ee.emit('document:add', id)
  })

  watcher.on('unlinkDir', async (path) => {
    const id = basename(path)

    if (!isUlid(id)) {
      return
    }

    console.log('Removing document', id)
    await remove(id)
    ee.emit('document:remove', id)
  })

  watcher.on('change', async (path) => {
    const id = basename(resolve(path, '..'))
    console.log('Change detected', id)

    if (!isUlid(id)) {
      return
    }

    console.log('Updating document', id)
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
