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
import { desc, eq, getTableColumns, notInArray, SQL, sql } from 'drizzle-orm'
import {
  create as orama,
  insert as oramaInsert,
  insertMultiple as oramaInsertMultiple,
  search as oramaSearch
} from '@orama/orama'
import { documentsStore as oramaDocumentsStore } from '@orama/orama/components'
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

  // HACK(yuki):
  //     I'm not happy with using two databases that serve rather redundant
  //     purposes.
  //
  //     This is done this way because this is how the original Patchouli
  //     worked, but a lot of the dirty work was done by Laravel Scout.
  //
  //     But as X uses plain old hierarchial filesystems[^1] as the database since
  //     7e0b69a43, I think we should eliminate SQLite.
  //
  //     I did make a first-attempt which failed miserably because I followed
  //     the "Remote Document Storing"[rds] example from Orama too closely and
  //     encountered problem with mapping between Orama's internal IDs and our
  //     canonical IDs.
  //
  //     [^1]: Quite ironic when you think about it.
  //           Also, I don't think Uriel would be happy since I'm doing this in
  //           Node.js/Electron :s
  //
  //     [rds]: https://docs.askorama.ai/open-source/usage/insert#remote-document-storing
  const db = drizzle(sqlite)
  const store = await oramaDocumentsStore.createDocumentsStore()
  const documentIndex = await orama({
    schema: {
      id: 'string',
      title: 'string',
      description: 'string',
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

  async function fetchDocuments(page: number = 1, pageSize: number = 25) {
    const items = await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    const nextPage = items.length === pageSize ? page + 1 : undefined

    return {
      items,
      nextPage
    }
  }

  async function searchDocuments(term: string, page: number = 1, pageSize: number = 25) {
    const res = await oramaSearch(documentIndex, {
      term,
      limit: pageSize,
      offset: (page - 1) * pageSize
    })

    const ids = res.hits.map((i) => i.document.id)
    const nextPage = ids.length === pageSize ? pageSize + 1 : undefined

    // HACK(yuki): This makes me a bit unhappy.
    //             I try to not think about it.
    const items = await Promise.all(
      ids.map((i) =>
        db
          .select()
          .from(documents)
          .where(eq(documents.id, i))
          .then((i) => i[0])
      )
    )

    return {
      items,
      nextPage
    }
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
