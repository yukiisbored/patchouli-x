import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ulid } from 'ulid'

export const documents = sqliteTable('documents', {
  id: text('id', { mode: 'text', length: 26 })
    .primaryKey()
    .$defaultFn(() => ulid()),
  status: text('status', {
    mode: 'text',
    enum: ['pending', 'processing', 'complete', 'failed']
  })
    .default('pending')
    .notNull(),
  url: text('url').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .$onUpdate(() => sql`(unixepoch())`)
    .notNull(),
  favicon: text('favicon'),
  title: text('title'),
  description: text('description'),
  keywords: text('keywords', { mode: 'json' }).$type<string[]>().default([]),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  image: text('image'),
  content: text('content'),
  author: text('author'),
  authorUrl: text('authorUrl')
})
