import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { type Meta } from './server/db'
import { ulid } from 'ulid'

export type ScrapeResult = Meta & { htmlContent: string }

function first<K, V>(map: Map<K, V>, ...keys: K[]): V | undefined {
  for (const key of keys) {
    if (map.has(key)) {
      return map.get(key)
    }
  }
  return undefined
}

function extractMeta(document: Document): Map<string, string> {
  const nodes = document.getElementsByTagName('meta')

  const res = new Map<string, string>()

  for (const node of nodes) {
    const type =
      node.getAttribute('name') ?? node.getAttribute('property') ?? node.getAttribute('itemprop')
    const value = node.getAttribute('content')

    if (type && value) {
      res.set(type, value)
    }
  }

  return res
}

function extractLink(document: Document): Map<string, string> {
  const nodes = document.getElementsByTagName('link')

  const res = new Map<string, string>()

  for (const node of nodes) {
    const type = node.getAttribute('rel')
    const value = node.getAttribute('href')

    if (type && value) {
      res.set(type, value)
    }
  }

  return res
}

function toDate(timestamp: string): Date | undefined {
  const date = /^\d+$/.test(timestamp) ? new Date(parseInt(timestamp) * 1000) : new Date(timestamp)

  if (isNaN(date.getTime()) || date.getTime() <= 0) {
    return undefined
  }

  return date
}

function title(meta: Map<string, string>): string | undefined {
  return first(
    meta,
    'og:title',
    'twitter:title',
    'lp:title',
    'dcterms:title',
    'article:title',
    'headline',
    'article.headline',
    'parsely-title'
  )
}

function description(meta: Map<string, string>): string | undefined {
  return first(
    meta,
    'og:description',
    'twitter:description',
    'lp:description',
    'description',
    'article:description',
    'dcterms.description',
    'sailthru.description',
    'excerpt',
    'article.summary'
  )
}

function author(meta: Map<string, string>): string | undefined {
  return first(
    meta,
    'article:author',
    'book:author',
    'sailthru.author',
    'lp.article:author',
    'twitter:creator',
    'dcterms.creator',
    'author'
  )
}

function authorUrl(meta: Map<string, string>): string | undefined {
  if (meta.has('twitter:creator')) {
    const creator = meta.get('twitter:creator')!
    const username = creator.startsWith('@') ? creator.slice(1) : creator
    return `https://twitter.com/${username}`
  }

  return undefined
}

function image(meta: Map<string, string>): string | undefined {
  return first(
    meta,
    'og:image',
    'og:image:url',
    'og:image:secure_url',
    'twitter:image',
    'twitter:image:src',
    'lp:image'
  )
}

function favicon(link: Map<string, string>): string {
  return first(link, 'shortcut icon', 'icon') ?? '/favicon.ico'
}

function publishedAt(meta: Map<string, string>): Date | undefined {
  const timestamp = first(
    meta,
    'article:published_time',
    'created',
    'date',
    'datepublished',
    'music:release_date',
    'video:release_date',
    'newsrepublic:publish_date',
    'pagerender',
    'pub_date',
    'publication-date',
    'lp.article:published_time',
    'lp.article:modified_time',
    'publish-date',
    'rc.datecreation',
    'timestamp',
    'sailthru.date',
    'article:modified_time',
    'dcterms.date'
  )

  return timestamp ? toDate(timestamp) : undefined
}

function keywords(meta: Map<string, string>): string[] {
  const keys = [
    'og:video:tag',
    'og:article:tag',
    'og:video:tag',
    'og:book:tag',
    'lp.article:section',
    'dcterms.subject'
  ]

  const res = new Set<string>()
  const lists = keys.filter((key) => meta.has(key)).map((key) => meta.get(key)!)

  for (const list of lists) {
    const tags = list
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag && !tag.endsWith('...'))
      .map((tag) => tag.toLowerCase())

    for (const tag of tags) {
      res.add(tag)
    }
  }

  return Array.from(res)
}

export async function scrape(url: string): Promise<ScrapeResult> {
  const res = await JSDOM.fromURL(url)

  const document = res.window.document
  const meta = extractMeta(document)
  const link = extractLink(document)

  const reader = new Readability(document)
  const article = reader.parse()

  const auteur = author(meta)

  return {
    version: 0,
    id: ulid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    url,
    favicon: new URL(favicon(link), url).href,
    title: article?.title ?? title(meta) ?? document.title,
    description: article?.excerpt ?? description(meta),
    content: article?.textContent,
    htmlContent: article?.content ?? document.documentElement.outerHTML,
    image: image(meta),
    publishedAt: publishedAt(meta),
    author: auteur
      ? {
          name: auteur,
          url: authorUrl(meta)
        }
      : undefined,
    keywords: keywords(meta)
  }
}
