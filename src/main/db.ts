import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { ulid } from 'ulid'
import { ScrapeResult } from './scraper'
import {
  create as orama,
  insert as oramaInsert,
  insertMultiple as oramaInsertMultiple,
  search as oramaSearch
} from '@orama/orama'
import { documentsStore as oramaDocumentsStore } from '@orama/orama/components'
import { Settings } from './settings'
import z from 'zod'
import { readdir, readFile } from 'node:fs/promises'
import { Tuple } from './utils'
import invariant from 'tiny-invariant'

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
      }
    }
  })

  // HACK: For now, we'll assume the store is static and can only grow
  let cachedDocumentsIds: string[] | undefined = undefined

  async function getDocumentIds(): Promise<string[]> {
    if (cachedDocumentsIds) return cachedDocumentsIds

    const dir = await readdir(dataPath, { withFileTypes: true })

    const res = dir
      .filter((i) => i.isDirectory())
      .filter((i) => z.string().ulid().safeParse(i.name).success)
      .map((i) => i.name)
      // Our canonical IDs are ULIDs which are lexicographically sortable. This is fine.
      .toSorted((a, b) => b.localeCompare(a, 'en', { sensitivity: 'base' }))

    cachedDocumentsIds = res

    return res
  }

  async function getDocument(id: string): Promise<Meta> {
    const documentPath = join(dataPath, id)
    const metaPath = join(documentPath, 'meta.json')
    const metaRaw = await readFile(metaPath, 'utf-8')

    return metaSchema.parseAsync(JSON.parse(metaRaw))
  }

  async function scan(): Promise<void> {
    const documentParseJobs = (await getDocumentIds()).map(getDocument)

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

    const { title, description, content, url, htmlContent } = res

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

    invariant(cachedDocumentsIds, 'Cached Document IDs should be initialized by now')
    cachedDocumentsIds = [id, ...cachedDocumentsIds]

    await oramaInsert(documentIndex, {
      id,
      url,
      title: title ?? undefined,
      description: description ?? undefined,
      content: content ?? undefined
    })

    return meta
  }

  return {
    scan,
    fetchDocuments,
    insertDocumentFromScrape,
    searchDocuments
  }
}
