import { mkdir, writeFile, readdir } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { ulid } from 'ulid'
import { ScrapeResult } from './scraper'
import {
  create as orama,
  insert as oramaInsert,
  search as oramaSearch,
  remove as oramaRemove,
  update as oramaUpdate,
  insertMultiple as oramaInsertMultiple
} from '@orama/orama'
import { documentsStore as oramaDocumentsStore } from '@orama/orama/components'
import { stopwords as stopWords } from '@orama/stopwords/english'
import { Settings } from './settings'
import z from 'zod'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'stream'
import chokidar from 'chokidar'
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

export type Meta = z.infer<typeof metaSchema>

export type DB = Awaited<ReturnType<typeof createDB>>

export type Result = {
  items: Array<Meta>
  nextPage?: number
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createDB({ dataPath }: Settings) {
  await mkdir(dataPath, { recursive: true })

  const ee = new EventEmitter()
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
  let cachedDocumentsIds: string[] = []

  watcher.on('addDir', async (path) => {
    const id = basename(path)

    if (!z.string().ulid().safeParse(id).success) {
      return
    }

    console.log('Adding document', id)
    const { url, title, description, content, keywords } = await getDocument(id)

    cachedDocumentsIds = [id, ...cachedDocumentsIds].toSorted((a, b) =>
      b.localeCompare(a, 'en', { sensitivity: 'base' })
    )

    await oramaInsert(documentIndex, {
      id,
      url,
      title: title ?? undefined,
      description: description ?? undefined,
      content: content ?? undefined,
      keywords: keywords ?? []
    })

    watcher.add(join(path, 'meta.json'))
    ee.emit('document:add', id)
  })

  watcher.on('unlinkDir', async (path) => {
    const id = basename(path)

    if (!z.string().ulid().safeParse(id).success) {
      return
    }

    console.log('Removing document', id)
    watcher.unwatch(join(path, 'meta.json'))
    cachedDocumentsIds = cachedDocumentsIds.filter((i) => i !== id)
    await oramaRemove(documentIndex, id)

    ee.emit('document:remove', id)
  })

  watcher.on('change', async (path) => {
    const id = basename(resolve(path, '..'))
    console.log('Change detected', id)

    if (!z.string().ulid().safeParse(id).success) {
      return
    }

    console.log('Updating document', id)
    const { url, title, description, content, keywords } = await getDocument(id)

    await oramaUpdate(documentIndex, id, {
      id,
      url,
      title: title ?? undefined,
      description: description ?? undefined,
      content: content ?? undefined,
      keywords: keywords ?? []
    })

    ee.emit('document:update', id)
  })

  async function scan(): Promise<void> {
    const dir = await readdir(dataPath, { withFileTypes: true })

    const documentParseJobs = dir
      .filter((i) => i.isDirectory())
      .filter((i) => z.string().ulid().safeParse(i.name).success)
      .map((i) => i.name)
      // Our canonical IDs are ULIDs which are lexicographically sortable. This is fine.
      .toSorted((a, b) => b.localeCompare(a, 'en', { sensitivity: 'base' }))
      .map(getDocument)

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
      return
    }

    cachedDocumentsIds = resolved.map((i) => i.id)
    watcher.add(resolved.map((i) => join(dataPath, i.id, 'meta.json')))
    await oramaInsertMultiple(
      documentIndex,
      resolved.map((i) => ({
        ...i,
        title: i.title ?? undefined,
        description: i.description ?? undefined,
        content: i.content ?? undefined,
        keywords: i.keywords ?? []
      }))
    )
  }

  async function getDocumentIds(): Promise<string[]> {
    return cachedDocumentsIds
  }

  async function getDocument(id: string): Promise<Meta> {
    const documentPath = join(dataPath, id)
    const metaPath = join(documentPath, 'meta.json')
    const metaRaw = await readFile(metaPath, 'utf-8')

    return metaSchema.parseAsync(JSON.parse(metaRaw))
  }

  async function fetchDocuments(page: number = 1, pageSize: number = 25): Promise<Result> {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const items = await Promise.all((await getDocumentIds()).slice(start, end).map(getDocument))

    const nextPage = items.length === pageSize ? page + 1 : undefined

    return {
      items,
      nextPage
    }
  }

  async function searchDocuments(
    term: string,
    page: number = 1,
    pageSize: number = 25
  ): Promise<Result> {
    const res = await oramaSearch(documentIndex, {
      term,
      limit: pageSize,
      offset: (page - 1) * pageSize
    })

    const ids = res.hits.map((i) => i.document.id)
    const nextPage = ids.length === pageSize ? pageSize + 1 : undefined
    const items = await Promise.all(ids.map(getDocument))

    return {
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

  async function close(): Promise<void> {
    await watcher.close()
  }

  return {
    scan,
    fetchDocuments,
    insertDocumentFromScrape,
    searchDocuments,
    close,
    ee
  }
}
