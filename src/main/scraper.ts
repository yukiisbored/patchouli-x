import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import invariant from 'tiny-invariant'
import { Meta } from './db'
import { ulid } from 'ulid'

export type ScrapeResult = Meta & { htmlContent: string }

export async function scrape(url: string): Promise<ScrapeResult> {
  const res = await JSDOM.fromURL(url)
  const reader = new Readability(res.window.document)
  const article = reader.parse()

  // TODO: fallback when readability fails
  invariant(article, 'article is null')
  const { title, excerpt: description, textContent: content, content: htmlContent } = article

  return {
    version: 0,
    id: ulid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    url,
    title,
    description,
    content,
    htmlContent,
    keywords: []
  }
}
